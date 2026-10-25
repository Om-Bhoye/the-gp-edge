/**
 * app/api/webhooks/stripe/route.ts
 *
 * POST /api/webhooks/stripe
 *
 * Receives and processes Stripe webhook events.
 *
 * ⚠️  IMPORTANT — Raw body requirement:
 *   Stripe's signature verification (stripe.webhooks.constructEvent) requires
 *   the EXACT raw bytes of the request body — NOT the parsed JSON object.
 *   We use `await req.text()` to get the raw string before any parsing.
 *
 * Events handled:
 *   checkout.session.completed        — new purchase (payment or subscription)
 *   customer.subscription.created     — initial subscription object creation
 *   customer.subscription.updated     — renewals, plan changes
 *   customer.subscription.deleted     — cancellation / non-renewal
 *   invoice.payment_failed            — failed recurring charge
 *
 * ─── WHY upsert({ where: { provider_sub_id } }) instead of { user_id } ─────
 *   The subscriptions.user_id column has a PARTIAL unique index
 *   (WHERE status IN ['active','trialing','past_due']). Prisma's upsert()
 *   requires a FULL unique constraint — partial indexes are not supported.
 *   Using provider_sub_id (which is a full @unique) as the upsert key
 *   is the correct approach for recurring subscriptions.
 *   For one-time payments, stripe_checkout_session_id (also @unique) is used.
 */

import { NextResponse } from "next/server";
import {
  stripe,
  addMonths,
  getPlanConfigByPriceId,
  REGISTRAR_PRICE_IDS,
  REGISTRAR_ACCESS_MONTHS,
  priceIdToAccessLevel,
} from "@/lib/stripe";
import { forfeitFreeQuota } from "@/lib/module-gates";
import prisma from "@/lib/prisma";
import type Stripe from "stripe";

/**
 * Resolve the Neon DB user ID from a Stripe event payload using
 * a 3-tier fallback strategy.
 *
 * Tier 1: client_reference_id / metadata.userId (set at checkout creation)
 * Tier 2: match by stripe_customer_id persisted on the users record
 * Tier 3: fetch customer email from Stripe API → match users.email
 */
async function resolveUserId(
  tier1Id: string | null | undefined,
  stripeCustomerId: string | null | undefined,
  customerDetailsEmail?: string | null
): Promise<string | null> {
  // Tier 1
  if (tier1Id) {
    console.log("[webhook/resolveUserId] ✅ Tier 1: userId from metadata:", tier1Id);
    return tier1Id;
  }

  // Tier 2: match by stripe_customer_id in DB
  if (stripeCustomerId) {
    const matched = await prisma.users.findUnique({
      where: { stripe_customer_id: stripeCustomerId },
      select: { id: true },
    });
    if (matched) {
      console.log("[webhook/resolveUserId] ✅ Tier 2: userId via stripe_customer_id:", matched.id);
      return matched.id;
    }
  }

  // Tier 3a: match by customer_details.email (checkout sessions)
  if (customerDetailsEmail) {
    const matched = await prisma.users.findUnique({
      where: { email: customerDetailsEmail },
      select: { id: true },
    });
    if (matched) {
      console.log("[webhook/resolveUserId] ✅ Tier 3a: userId via customer_details.email:", matched.id);
      return matched.id;
    }
  }

  // Tier 3b: fetch customer from Stripe API and match by email
  if (stripeCustomerId) {
    try {
      const stripeCustomer = await stripe.customers.retrieve(stripeCustomerId);
      if (!stripeCustomer.deleted) {
        const email = (stripeCustomer as Stripe.Customer).email;
        if (email) {
          const matched = await prisma.users.findUnique({
            where: { email },
            select: { id: true },
          });
          if (matched) {
            console.log("[webhook/resolveUserId] ✅ Tier 3b: userId via Stripe customer email:", matched.id);
            return matched.id;
          }
        }
      }
    } catch (err) {
      console.warn("[webhook/resolveUserId] Stripe customer email lookup failed:", err);
    }
  }

  console.error(
    "[webhook/resolveUserId] ❌ All tiers exhausted — could not resolve userId.",
    { stripeCustomerId, customerDetailsEmail }
  );
  return null;
}

/**
 * Look up a real plan_id from the DB by slug, with fallback to first plan.
 * Returns null if no plans exist (should never happen in production).
 */
async function resolvePlanId(slug: string): Promise<string | null> {
  const plan = await prisma.plans.findUnique({ where: { slug }, select: { id: true } });
  if (plan) return plan.id;

  // Fallback: any active plan
  const fallback = await prisma.plans.findFirst({
    where: { is_active: true },
    select: { id: true },
    orderBy: { sort_order: "asc" },
  });
  if (fallback) {
    console.warn(`[webhook/resolvePlanId] Slug "${slug}" not found; falling back to plan ${fallback.id}`);
    return fallback.id;
  }

  console.error("[webhook/resolvePlanId] ❌ No plans exist in the database!");
  return null;
}

// ─── Stripe status → DB status mapping ────────────────────────────────────────

const STATUS_MAP: Record<
  string,
  "active" | "trialing" | "past_due" | "canceled" | "expired"
> = {
  active: "active",
  trialing: "trialing",
  past_due: "past_due",
  canceled: "canceled",
  unpaid: "past_due",
  incomplete: "past_due",
  incomplete_expired: "expired",
  paused: "past_due",
};

// ─── Webhook route ────────────────────────────────────────────────────────────

export async function POST(req: Request) {
  console.log("[webhook] ▶ Received POST request");

  // ── 1. Raw body extraction ────────────────────────────────────────────────
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");

  if (!signature) {
    console.error("[webhook] ❌ Missing stripe-signature header");
    return new Response("Missing stripe-signature header", { status: 400 });
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    console.error("[webhook] ❌ STRIPE_WEBHOOK_SECRET is not configured");
    return new Response("Webhook secret not configured", { status: 500 });
  }

  // ── 2. Signature verification ─────────────────────────────────────────────
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      body,
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
    console.log(`[webhook] ✅ Event verified: ${event.type} (id: ${event.id})`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[webhook] ❌ Signature verification failed:", msg);
    return new Response(`Webhook Error: ${msg}`, { status: 400 });
  }

  // ── 3. Event-level Idempotency Enforcement ────────────────────────────────
  try {
    await prisma.stripe_webhook_events.create({
      data: {
        event_id: event.id,
        event_type: event.type,
      },
    });
  } catch (dupErr: any) {
    // If duplicate key error (code P2002 in Prisma), event was already processed or is processing concurrently
    if (dupErr.code === "P2002" || dupErr.message?.includes("Unique constraint")) {
      console.log(`[webhook] ℹ️ Duplicate event ${event.id} (${event.type}) already processed — skipping execution`);
      return NextResponse.json({ received: true, duplicate: true });
    }
    console.warn(`[webhook] Could not record event ID ${event.id}:`, dupErr.message);
  }

  // ── 4. Route event to the appropriate handler ─────────────────────────────
  try {
    switch (event.type) {
      case "checkout.session.completed":
      case "checkout.session.async_payment_succeeded":
        await handleCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;

      case "checkout.session.async_payment_failed":
        await handleCheckoutAsyncPaymentFailed(event.data.object as Stripe.Checkout.Session);
        break;

      case "customer.subscription.created":
      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object as Stripe.Subscription);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object as Stripe.Invoice);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object as Stripe.Invoice);
        break;

      default:
        console.log(`[webhook] ℹ️ Unhandled event type: ${event.type} — ignoring`);
    }
  } catch (err) {
    console.error(`[webhook] ❌ Handler error for ${event.type}:`, err);
    return new Response("Handler error — check logs", { status: 500 });
  }

  return NextResponse.json({ received: true });
}

// ─── Event handlers ───────────────────────────────────────────────────────────

/**
 * checkout.session.completed & checkout.session.async_payment_succeeded
 *
 * Fires when a user completes a checkout flow for EITHER:
 *   - mode: 'payment'       → one-time Registrar purchase ($1500/$2500)
 *   - mode: 'subscription'  → Fellowship or Post-Registrar Upgrade
 */
async function handleCheckoutCompleted(session: Stripe.Checkout.Session) {
  console.log(`[webhook/checkout.completed] Processing session ${session.id}, mode: ${session.mode}, payment_status: ${session.payment_status}`);

  const stripeCustomerId =
    typeof session.customer === "string"
      ? session.customer
      : session.customer?.id ?? null;

  const userId = await resolveUserId(
    session.client_reference_id ?? session.metadata?.userId,
    stripeCustomerId,
    session.customer_details?.email
  );

  if (!userId) {
    console.error(
      "[webhook/checkout.completed] ❌ Could not resolve userId — aborting",
      { sessionId: session.id, customerId: stripeCustomerId }
    );
    return;
  }

  // 1. Payment Confirmation: Withhold active access if payment is pending/unpaid
  if (session.payment_status !== "paid" && session.payment_status !== "no_payment_required") {
    console.log(
      `[webhook/checkout.completed] ⏳ Payment status is "${session.payment_status}" (not paid) — access withheld until payment settles.`
    );
    const paymentIntentId =
      typeof session.payment_intent === "string"
        ? session.payment_intent
        : session.payment_intent?.id;
    const providerRef = paymentIntentId || session.id;

    if (providerRef) {
      await prisma.payments
        .upsert({
          where: { provider_ref: providerRef },
          create: {
            user_id: userId,
            amount: (session.amount_total ?? 0) / 100,
            currency: (session.currency ?? "aud").toUpperCase() as "AUD",
            status: "pending",
            provider_ref: providerRef,
            stripe_price_id: session.metadata?.priceId ?? null,
          },
          update: {
            status: "pending",
          },
        })
        .catch((e) =>
          console.warn("[webhook/checkout.completed] Warning recording pending payment:", e.message)
        );
    }
    return;
  }

  // 2. Currency Validation: Reject unsupported currencies
  if (session.currency && session.currency.toLowerCase() !== "aud") {
    console.error(
      `[webhook/checkout.completed] ❌ Unsupported currency "${session.currency}" — expected "aud". Aborting.`
    );
    return;
  }

  // Persist stripe_customer_id on users record
  if (stripeCustomerId) {
    await prisma.users
      .update({
        where: { id: userId },
        data: { stripe_customer_id: stripeCustomerId },
      })
      .catch((err) =>
        console.warn("[webhook/checkout.completed] Could not save stripe_customer_id:", err.message)
      );
  }

  const priceId =
    session.metadata?.priceId ??
    (session.line_items?.data[0]?.price?.id ?? null);

  if (!priceId) {
    console.error("[webhook/checkout.completed] ❌ No priceId found in metadata or line_items — aborting");
    return;
  }

  // 3. Plan Configuration Validation against trusted server config
  const planConfig = getPlanConfigByPriceId(priceId);
  if (!planConfig) {
    console.error(`[webhook/checkout.completed] ❌ Unknown or invalid priceId "${priceId}" — aborting`);
    return;
  }

  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id ?? null;
  const checkoutSessionId = session.id;

  // 4. Session-level Deduplication: Check if checkout session or payment was already fulfilled
  const alreadyProcessedSub = await prisma.subscriptions.findUnique({
    where: { stripe_checkout_session_id: checkoutSessionId },
  });
  const existingPayment = paymentIntentId
    ? await prisma.payments.findUnique({ where: { provider_ref: paymentIntentId } })
    : null;

  if (alreadyProcessedSub || (existingPayment && existingPayment.status === "succeeded")) {
    console.log(
      `[webhook/checkout.completed] ℹ️ Checkout session ${checkoutSessionId} or payment ${paymentIntentId} already fulfilled — skipping duplicate processing.`
    );
    return;
  }

  const now = new Date();

  if (session.mode === "payment" && (REGISTRAR_PRICE_IDS.has(priceId) || planConfig.accessLevel === "REGISTRAR")) {
    // ── One-time Registrar purchase ───────────────────────────────────────────
    console.log("[webhook/checkout.completed] → One-time Registrar payment branch");

    const months = planConfig.durationMonths ?? REGISTRAR_ACCESS_MONTHS[priceId] ?? 6;

    // Check for existing active subscription
    const existingActiveSub = await prisma.subscriptions.findFirst({
      where: {
        user_id: userId,
        status: { in: ["active", "trialing", "past_due"] },
      },
      orderBy: { access_expires_at: "desc" },
    });

    const metaPkg = session.metadata?.package_name;
    const metaTitle = session.metadata?.plan_title;
    const resolvedPkg = metaPkg || planConfig.packageName || "Registrar Package";
    const resolvedTitle = metaTitle || planConfig.planTitle || resolvedPkg;

    const planId = await resolvePlanId("registrar");
    if (!planId) {
      console.error("[webhook/checkout.completed] ❌ Could not resolve plan_id — aborting subscription processing");
      return;
    }

    const providerRef = paymentIntentId || checkoutSessionId;

    if (existingActiveSub && existingActiveSub.access_level === "REGISTRAR") {
      // ── EXTENSION CASE: Active Registrar subscriber extending their existing subscription ──
      // Calculate clamped calendar extension based on remaining duration or now
      const baseDate =
        existingActiveSub.access_expires_at && new Date(existingActiveSub.access_expires_at) > now
          ? new Date(existingActiveSub.access_expires_at)
          : now;
      const accessExpiresAt = addMonths(baseDate, months);

      console.log(
        `[webhook/checkout.completed] Extending active subscription ${existingActiveSub.id} from ${baseDate.toISOString()} to ${accessExpiresAt.toISOString()}`
      );

      // Execute atomically in a Prisma transaction:
      // Updates existing row directly — prevents uq_user_active_subscription constraint conflict!
      await prisma.$transaction(async (tx) => {
        await tx.subscriptions.update({
          where: { id: existingActiveSub.id },
          data: {
            access_expires_at: accessExpiresAt,
            current_period_end: accessExpiresAt,
            stripe_price_id: priceId,
            plan_name: resolvedTitle,
            purchased_package_type: resolvedPkg,
            updated_at: now,
          },
        });

        await tx.users.update({
          where: { id: userId },
          data: {
            has_purchased_registrar: true,
            purchased_package_type: resolvedPkg,
          },
        });

        await tx.payments.upsert({
          where: { provider_ref: providerRef },
          create: {
            user_id: userId,
            subscription_id: existingActiveSub.id,
            amount: (session.amount_total ?? 0) / 100,
            currency: "AUD",
            status: "succeeded",
            provider_ref: providerRef,
            stripe_price_id: priceId,
            paid_at: now,
          },
          update: {
            subscription_id: existingActiveSub.id,
            status: "succeeded",
            paid_at: now,
          },
        });

        await forfeitFreeQuota(userId, tx);
      });

      console.log(`[webhook/checkout.completed] ✅ Extension successfully applied to subscription ${existingActiveSub.id}`);
    } else {
      // ── INITIAL PURCHASE OR UPGRADE CASE ──
      const accessExpiresAt = addMonths(now, months);

      // If user had an active recurring subscription (e.g. Fellowship), cancel it in Stripe first
      if (existingActiveSub?.provider_sub_id && existingActiveSub.payment_mode === "subscription") {
        console.log(`[webhook/checkout.completed] Canceling previous recurring Stripe subscription ${existingActiveSub.provider_sub_id}`);
        try {
          await stripe.subscriptions.cancel(existingActiveSub.provider_sub_id);
        } catch (cancelErr: any) {
          console.warn(`[webhook/checkout.completed] Could not cancel previous Stripe subscription:`, cancelErr.message);
        }
      }

      await prisma.$transaction(async (tx) => {
        // Cancel any old active subscription row in DB so uq_user_active_subscription is preserved
        if (existingActiveSub) {
          await tx.subscriptions.update({
            where: { id: existingActiveSub.id },
            data: {
              status: "canceled",
              canceled_at: now,
              updated_at: now,
            },
          });
        }

        const newSub = await tx.subscriptions.create({
          data: {
            user_id: userId,
            plan_id: planId,
            cycle: "monthly",
            status: "active",
            provider: "stripe",
            provider_sub_id: paymentIntentId ?? null,
            access_level: "REGISTRAR",
            access_expires_at: accessExpiresAt,
            payment_mode: "payment",
            stripe_price_id: priceId,
            stripe_checkout_session_id: checkoutSessionId,
            current_period_start: now,
            current_period_end: accessExpiresAt,
            plan_name: resolvedTitle,
            purchased_package_type: resolvedPkg,
          },
        });

        await tx.users.update({
          where: { id: userId },
          data: {
            has_purchased_registrar: true,
            purchased_package_type: resolvedPkg,
          },
        });

        await tx.payments.upsert({
          where: { provider_ref: providerRef },
          create: {
            user_id: userId,
            subscription_id: newSub.id,
            amount: (session.amount_total ?? 0) / 100,
            currency: "AUD",
            status: "succeeded",
            provider_ref: providerRef,
            stripe_price_id: priceId,
            paid_at: now,
          },
          update: {
            subscription_id: newSub.id,
            status: "succeeded",
            paid_at: now,
          },
        });

        await forfeitFreeQuota(userId, tx);
      });

      console.log(`[webhook/checkout.completed] ✅ New Registrar purchase successfully activated for user ${userId}`);
    }

    // Ensure invoice is marked as paid if open/draft
    if (session.invoice && session.payment_intent) {
      try {
        const invoiceId = typeof session.invoice === "string" ? session.invoice : session.invoice.id;
        const invoice = await stripe.invoices.retrieve(invoiceId);

        if (invoice.status === "open" || invoice.status === "draft") {
          console.log(`[webhook/checkout.completed] Paying open/draft invoice ${invoiceId}`);
          await stripe.invoices.pay(invoiceId, {
            paid_out_of_band: true,
          });
        }
      } catch (err: any) {
        console.warn("[webhook/checkout.completed] Could not auto-pay invoice:", err.message);
      }
    }
  } else if (session.mode === "subscription" && session.subscription) {
    // ── Recurring subscription ────────────────────────────────────────────────
    console.log("[webhook/checkout.completed] → Recurring subscription branch");
    const subId =
      typeof session.subscription === "string"
        ? session.subscription
        : session.subscription.id;

    const stripeSub = await stripe.subscriptions.retrieve(subId);
    console.log(`[webhook/checkout.completed] Retrieved Stripe subscription ${stripeSub.id}, status: ${stripeSub.status}`);

    await upsertSubscriptionRow(userId, stripeSub, priceId, session.id, session.amount_total);
  } else {
    console.warn(`[webhook/checkout.completed] Unhandled mode "${session.mode}" or missing subscription — skipping`);
  }

  console.log(`[webhook/checkout.completed] ✅ Done for user ${userId}`);
}

/**
 * checkout.session.async_payment_failed
 * Marks pending payment record as failed if asynchronous payment method fails.
 */
async function handleCheckoutAsyncPaymentFailed(session: Stripe.Checkout.Session) {
  console.log(`[webhook/checkout.async_payment_failed] Processing failed checkout ${session.id}`);
  const paymentIntentId =
    typeof session.payment_intent === "string"
      ? session.payment_intent
      : session.payment_intent?.id;
  const providerRef = paymentIntentId || session.id;

  if (providerRef) {
    await prisma.payments
      .updateMany({
        where: { provider_ref: providerRef },
        data: { status: "failed" },
      })
      .catch((e) =>
        console.warn("[webhook/async_payment_failed] Error updating payment status:", e.message)
      );
  }
}

/**
 * customer.subscription.created / customer.subscription.updated
 * Handles renewals, plan switches, and trial conversions.
 */
async function handleSubscriptionUpdated(stripeSub: Stripe.Subscription) {
  console.log(`[webhook/subscription.updated] Processing sub ${stripeSub.id}, status: ${stripeSub.status}`);

  const stripeCustomerId =
    typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : stripeSub.customer?.id ?? null;

  const userId = await resolveUserId(
    stripeSub.metadata?.userId,
    stripeCustomerId,
    null
  );

  if (!userId) {
    console.error(
      "[webhook/subscription.updated] ❌ No matching userId found — aborting",
      { subId: stripeSub.id, customerId: stripeCustomerId }
    );
    return;
  }

  const priceId = stripeSub.items.data[0]?.price.id;
  if (!priceId) {
    console.error("[webhook/subscription.updated] ❌ No priceId on subscription — aborting");
    return;
  }

  await upsertSubscriptionRow(userId, stripeSub, priceId, null);
}

/**
 * customer.subscription.deleted
 * Reverts access to FREE. Preserves has_purchased_registrar permanently.
 */
async function handleSubscriptionDeleted(stripeSub: Stripe.Subscription) {
  console.log(`[webhook/subscription.deleted] Processing sub ${stripeSub.id}`);

  const existing = await prisma.subscriptions.findUnique({
    where: { provider_sub_id: stripeSub.id },
    select: { id: true },
  });

  if (!existing) {
    const stripeCustomerId =
      typeof stripeSub.customer === "string"
        ? stripeSub.customer
        : stripeSub.customer?.id ?? null;

    const userId = await resolveUserId(
      stripeSub.metadata?.userId,
      stripeCustomerId,
      null
    );

    if (userId) {
      await prisma.subscriptions.updateMany({
        where: { user_id: userId },
        data: {
          status: "canceled",
          access_level: "FREE",
          canceled_at: new Date(),
          updated_at: new Date(),
        },
      });
      console.log(`[webhook/subscription.deleted] Updated subscriptions for user ${userId} to canceled`);
    }
    return;
  }

  await prisma.subscriptions.update({
    where: { id: existing.id },
    data: {
      status: "canceled",
      access_level: "FREE",
      canceled_at: new Date(),
      updated_at: new Date(),
    },
  });
  console.log(`[webhook/subscription.deleted] ✅ Subscription ${existing.id} marked canceled`);
}

/**
 * invoice.payment_succeeded
 * Syncs successful recurring subscription renewals to the database.
 */
async function handleInvoicePaymentSucceeded(invoice: Stripe.Invoice) {
  if (invoice.billing_reason !== "subscription_cycle" && invoice.billing_reason !== "subscription_create") {
    return;
  }

  const subscriptionId = (invoice as any).subscription as string | null;
  if (!subscriptionId) return;

  console.log(`[webhook/invoice.payment_succeeded] Processing renewal for sub ${subscriptionId}`);

  try {
    const stripeSub = await stripe.subscriptions.retrieve(subscriptionId);
    
    const existing = await prisma.subscriptions.findUnique({
      where: { provider_sub_id: subscriptionId },
      select: { user_id: true, stripe_price_id: true, stripe_checkout_session_id: true, id: true },
    });

    if (existing && existing.stripe_price_id) {
      await upsertSubscriptionRow(
        existing.user_id,
        stripeSub,
        existing.stripe_price_id,
        existing.stripe_checkout_session_id
      );

      // Record renewal invoice payment
      if (invoice.id) {
        await prisma.payments
          .upsert({
            where: { provider_ref: invoice.id },
            create: {
              user_id: existing.user_id,
              subscription_id: existing.id,
              amount: (invoice.amount_paid ?? 0) / 100,
              currency: "AUD",
              status: "succeeded",
              provider_ref: invoice.id,
              stripe_price_id: existing.stripe_price_id,
              paid_at: new Date(),
            },
            update: {
              subscription_id: existing.id,
              status: "succeeded",
              paid_at: new Date(),
            },
          })
          .catch((e) =>
            console.warn("[webhook/invoice.payment_succeeded] Invoice payment record warning:", e.message)
          );
      }

      console.log(`[webhook/invoice.payment_succeeded] ✅ Synced renewal for ${subscriptionId}`);
    } else {
      console.warn(`[webhook/invoice.payment_succeeded] Could not find existing subscription in DB for ${subscriptionId}`);
    }
  } catch (err) {
    console.error(`[webhook/invoice.payment_succeeded] Error syncing renewal for sub ${subscriptionId}:`, err);
  }
}

/**
 * invoice.payment_failed
 * Marks subscription past_due and reverts access to FREE.
 */
async function handleInvoicePaymentFailed(invoice: Stripe.Invoice) {
  const subscriptionId = (invoice as any).subscription as string | null;
  if (!subscriptionId) return;

  console.log(`[webhook/invoice.payment_failed] Marking sub ${subscriptionId} as past_due`);

  const existing = await prisma.subscriptions.findUnique({
    where: { provider_sub_id: subscriptionId },
    select: { id: true },
  });

  if (existing) {
    await prisma.subscriptions.update({
      where: { id: existing.id },
      data: {
        status: "past_due",
        access_level: "FREE",
        updated_at: new Date(),
      },
    });
    console.log(`[webhook/invoice.payment_failed] ✅ Subscription ${existing.id} marked past_due`);
  } else {
    console.warn(`[webhook/invoice.payment_failed] No subscription found for provider_sub_id ${subscriptionId}`);
  }
}

// ─── Shared upsert logic for recurring subscriptions ─────────────────────────

/**
 * Upsert a subscription row for a recurring Stripe Subscription object.
 *
 * KEY FIX:
 * 1. Checks and cancels older active recurring subscriptions in Stripe and marks them
 *    as 'canceled' in PostgreSQL BEFORE or in the same transaction as upserting the
 *    new row, preventing uq_user_active_subscription violations.
 * 2. Uses prisma.$transaction for atomic multi-table updates.
 */
async function upsertSubscriptionRow(
  userId: string,
  stripeSub: Stripe.Subscription,
  priceId: string,
  checkoutSessionId: string | null,
  amountTotal?: number | null
) {
  console.log(`[webhook/upsertSubscriptionRow] userId=${userId}, subId=${stripeSub.id}, priceId=${priceId}`);

  const planConfig = getPlanConfigByPriceId(priceId);
  const accessLevel = planConfig?.accessLevel ?? priceIdToAccessLevel(priceId) ?? "FELLOWSHIP";

  const rawSub = stripeSub as any;
  const now = new Date();

  const currentPeriodEndSec: number =
    rawSub.current_period_end ??
    rawSub.items?.data?.[0]?.current_period_end ??
    Math.floor(now.getTime() / 1000);

  const currentPeriodStartSec: number =
    rawSub.current_period_start ??
    rawSub.items?.data?.[0]?.current_period_start ??
    Math.floor(now.getTime() / 1000);

  const periodEnd = new Date(currentPeriodEndSec * 1000);
  const periodStart = new Date(currentPeriodStartSec * 1000);

  const normalizedStripeStatus = (stripeSub.status ?? "").toLowerCase();
  const dbStatus = STATUS_MAP[normalizedStripeStatus] ?? "active";

  const interval = stripeSub.items?.data?.[0]?.price?.recurring?.interval;
  const dbCycle: "monthly" | "annual" = interval === "year" ? "annual" : "monthly";

  const isActive = dbStatus === "active" || dbStatus === "trialing";
  const effectiveAccessLevel = isActive ? accessLevel : "FREE";

  const stripeCustomerId =
    typeof stripeSub.customer === "string"
      ? stripeSub.customer
      : (stripeSub.customer as any)?.id ?? null;

  const planId = await resolvePlanId("fellowship");
  if (!planId) {
    console.error("[webhook/upsertSubscriptionRow] ❌ Could not resolve plan_id — aborting");
    return;
  }

  const metaPkg = stripeSub.metadata?.package_name;
  const metaTitle = stripeSub.metadata?.plan_title;
  const resolvedPkg = metaPkg || planConfig?.packageName || "Fellowship Subscription";
  const resolvedTitle = metaTitle || planConfig?.planTitle || resolvedPkg;

  // ── Concurrency safeguard: Auto-cancel older active recurring subscriptions ──
  if (isActive) {
    const olderActiveSubs = await prisma.subscriptions.findMany({
      where: {
        user_id: userId,
        status: { in: ["active", "trialing", "past_due"] },
        provider_sub_id: { not: stripeSub.id },
      },
    });

    for (const oldSub of olderActiveSubs) {
      if (oldSub.provider_sub_id && oldSub.payment_mode === "subscription") {
        console.log(`[webhook/upsertSubscriptionRow] Canceling older Stripe subscription ${oldSub.provider_sub_id}`);
        try {
          await stripe.subscriptions.cancel(oldSub.provider_sub_id);
        } catch (cancelErr: any) {
          console.warn(
            `[webhook/upsertSubscriptionRow] Could not cancel older Stripe subscription ${oldSub.provider_sub_id}:`,
            cancelErr.message
          );
        }
      }
    }

    // Atomic transaction: cancel old DB subscriptions and upsert new active subscription
    await prisma.$transaction(async (tx) => {
      for (const oldSub of olderActiveSubs) {
        await tx.subscriptions.update({
          where: { id: oldSub.id },
          data: {
            status: "canceled",
            canceled_at: now,
            updated_at: now,
          },
        });
      }

      const upserted = await tx.subscriptions.upsert({
        where: { provider_sub_id: stripeSub.id },
        create: {
          user_id: userId,
          plan_id: planId,
          cycle: dbCycle,
          status: dbStatus,
          provider: "stripe",
          provider_sub_id: stripeSub.id,
          access_level: effectiveAccessLevel,
          access_expires_at: periodEnd,
          payment_mode: "subscription",
          stripe_price_id: priceId,
          stripe_checkout_session_id: checkoutSessionId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
          plan_name: resolvedTitle,
          purchased_package_type: resolvedPkg,
        },
        update: {
          status: dbStatus,
          access_level: effectiveAccessLevel,
          access_expires_at: periodEnd,
          payment_mode: "subscription",
          stripe_price_id: priceId,
          current_period_start: periodStart,
          current_period_end: periodEnd,
          cancel_at: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
          canceled_at: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
          updated_at: now,
          plan_name: resolvedTitle,
          purchased_package_type: resolvedPkg,
        },
      });

      if (amountTotal && checkoutSessionId) {
        await tx.payments.upsert({
          where: { provider_ref: checkoutSessionId },
          create: {
            user_id: userId,
            subscription_id: upserted.id,
            amount: amountTotal / 100,
            currency: "AUD",
            status: "succeeded",
            provider_ref: checkoutSessionId,
            stripe_price_id: priceId,
            paid_at: now,
          },
          update: {
            subscription_id: upserted.id,
            status: "succeeded",
            paid_at: now,
          },
        });
      }

      await tx.users.update({
        where: { id: userId },
        data: {
          ...(stripeCustomerId ? { stripe_customer_id: stripeCustomerId } : {}),
          purchased_package_type: resolvedPkg,
        },
      });

      await forfeitFreeQuota(userId, tx);
      console.log(`[webhook/upsertSubscriptionRow] ✅ Subscription Table Updated in Neon: ${upserted.id}`);
    });
  } else {
    // Non-active status (e.g. past_due, canceled)
    await prisma.subscriptions.upsert({
      where: { provider_sub_id: stripeSub.id },
      create: {
        user_id: userId,
        plan_id: planId,
        cycle: dbCycle,
        status: dbStatus,
        provider: "stripe",
        provider_sub_id: stripeSub.id,
        access_level: effectiveAccessLevel,
        access_expires_at: periodEnd,
        payment_mode: "subscription",
        stripe_price_id: priceId,
        stripe_checkout_session_id: checkoutSessionId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
        plan_name: resolvedTitle,
        purchased_package_type: resolvedPkg,
      },
      update: {
        status: dbStatus,
        access_level: effectiveAccessLevel,
        access_expires_at: periodEnd,
        payment_mode: "subscription",
        stripe_price_id: priceId,
        current_period_start: periodStart,
        current_period_end: periodEnd,
        cancel_at: stripeSub.cancel_at ? new Date(stripeSub.cancel_at * 1000) : null,
        canceled_at: stripeSub.canceled_at ? new Date(stripeSub.canceled_at * 1000) : null,
        updated_at: now,
        plan_name: resolvedTitle,
        purchased_package_type: resolvedPkg,
      },
    });
    console.log(`[webhook/upsertSubscriptionRow] ✅ Inactive Subscription Updated in Neon: ${stripeSub.id}`);
  }
}
