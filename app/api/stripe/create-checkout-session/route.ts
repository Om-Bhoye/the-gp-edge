/**
 * app/api/stripe/create-checkout-session/route.ts
 *
 * POST /api/stripe/create-checkout-session
 *
 * Creates a Stripe Checkout Session for any of the five pricing plans.
 * Returns { url: string } — the client redirects to this URL.
 *
 * Payment mode is determined automatically:
 *   - Registrar $1500 / $2500 → mode: 'payment'   (one-time)
 *   - Fellowship / Post-Reg   → mode: 'subscription' (recurring)
 */

import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";
import prisma from "@/lib/prisma";
import { stripe, getPlanConfigByPriceId } from "@/lib/stripe";
import { getUserAccess } from "@/lib/access";

function getBaseUrl(req: Request): string {
  // 1. Check origin header from browser request
  const origin = req.headers.get("origin");
  if (origin && origin !== "null") {
    return origin;
  }

  // 2. Check host header + forwarded protocol
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  if (host) {
    const proto =
      req.headers.get("x-forwarded-proto") ||
      (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
    return `${proto}://${host}`;
  }

  // 3. Fallback to NEXT_PUBLIC_APP_URL environment variable
  if (process.env.NEXT_PUBLIC_APP_URL) {
    let appUrl = process.env.NEXT_PUBLIC_APP_URL.trim();
    if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
      appUrl = `https://${appUrl}`;
    }
    return appUrl;
  }

  // 4. Fallback to VERCEL_URL environment variable
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

export async function POST(req: Request) {
  try {
    // ── Auth ──────────────────────────────────────────────────────────────────
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { priceId } = body as { priceId?: string };

    if (!priceId) {
      return NextResponse.json({ error: "priceId is required" }, { status: 400 });
    }

    // ── Resolve DB user ───────────────────────────────────────────────────────
    const dbUser = await prisma.users.findUnique({
      where: { clerk_user_id: clerkUserId },
      select: { id: true, email: true, stripe_customer_id: true },
    });

    if (!dbUser) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // ── Validate Plan and Price ID against trusted server config ──────────────
    const planConfig = getPlanConfigByPriceId(priceId);
    if (!planConfig) {
      return NextResponse.json({ error: "Invalid or unsupported plan" }, { status: 400 });
    }

    // ── Active Subscription Backend Guard ──────────────────────────────────────
    // Check both getUserAccess and active subscriptions table
    const userAccess = await getUserAccess(dbUser.id);
    if (userAccess?.hasPaidAccess) {
      return NextResponse.json(
        { error: "You already have an active subscription. Please manage your subscription from your Profile page." },
        { status: 400 }
      );
    }

    const activeSub = await prisma.subscriptions.findFirst({
      where: {
        user_id: dbUser.id,
        status: { in: ["active", "trialing"] },
      },
    });

    if (activeSub && activeSub.access_expires_at && new Date(activeSub.access_expires_at) > new Date()) {
      return NextResponse.json(
        { error: "You already have an active subscription. Please manage your subscription from your Profile page." },
        { status: 400 }
      );
    }

    // ── Ensure Stripe Customer Exists ──────────────────────────────────────────
    let stripeCustomerId = dbUser.stripe_customer_id;
    if (!stripeCustomerId) {
      try {
        const existingCustomers = await stripe.customers.list({
          email: dbUser.email,
          limit: 1,
        });
        if (existingCustomers.data.length > 0) {
          stripeCustomerId = existingCustomers.data[0].id;
        } else {
          const newCust = await stripe.customers.create({
            email: dbUser.email,
            metadata: { userId: dbUser.id },
          });
          stripeCustomerId = newCust.id;
        }
        await prisma.users.update({
          where: { id: dbUser.id },
          data: { stripe_customer_id: stripeCustomerId },
        });
      } catch (custErr) {
        console.warn("[create-checkout-session] Customer resolution error:", custErr);
      }
    }

    // ── Session Deduplication / Concurrency Guard ──────────────────────────────
    // If the customer already has an open checkout session for this priceId created within the last 30 minutes, reuse it
    if (stripeCustomerId) {
      try {
        const openSessions = await stripe.checkout.sessions.list({
          customer: stripeCustomerId,
          status: "open",
          limit: 5,
        });

        const nowSeconds = Math.floor(Date.now() / 1000);
        const reusableSession = openSessions.data.find((s) => {
          const matchesPrice = s.metadata?.priceId === priceId;
          const isRecent = s.created && (nowSeconds - s.created < 1800); // 30 minutes
          const notExpired = !s.expires_at || s.expires_at > nowSeconds;
          return matchesPrice && isRecent && notExpired && Boolean(s.url);
        });

        if (reusableSession?.url) {
          console.log(`[create-checkout-session] Reusing existing open session ${reusableSession.id} for price ${priceId}`);
          return NextResponse.json({ url: reusableSession.url });
        }
      } catch (listErr) {
        console.warn("[create-checkout-session] Error listing open sessions:", listErr);
      }
    }

    // ── Determine checkout mode & URLs ─────────────────────────────────────────
    const mode = planConfig.mode;
    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/dashboard/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/dashboard/pricing?canceled=true`;

    const packageName = planConfig.packageName;
    const planTitle = planConfig.planTitle;
    const packageDurationMonths = String(planConfig.durationMonths);

    // ── Create Checkout Session with Stripe Idempotency Key ────────────────────
    const sessionConfig: any = {
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      client_reference_id: dbUser.id,
      metadata: {
        userId: dbUser.id,
        priceId,
        package_name: packageName,
        plan_title: planTitle,
        package_duration_months: packageDurationMonths,
      },
      success_url: successUrl,
      cancel_url: cancelUrl,
      allow_promotion_codes: true,
    };

    if (stripeCustomerId) {
      sessionConfig.customer = stripeCustomerId;
    } else {
      sessionConfig.customer_email = dbUser.email;
    }

    if (mode === "payment") {
      sessionConfig.invoice_creation = { 
        enabled: true,
        invoice_data: {
          description: `Payment for The GP Edge ${planTitle}`,
          metadata: { 
            userId: dbUser.id,
            package_name: packageName,
            plan_title: planTitle,
          },
        },
      };
    } else if (mode === "subscription") {
      sessionConfig.subscription_data = {
        metadata: {
          userId: dbUser.id,
          priceId,
          package_name: packageName,
          plan_title: planTitle,
          package_duration_months: packageDurationMonths,
        },
      };
      sessionConfig.billing_address_collection = "auto";
    }

    // Atomicity key: 10-minute window bucket prevents concurrent duplicate session creation in Stripe
    const timeBucket = Math.floor(Date.now() / (10 * 60 * 1000));
    const idempotencyKey = `cs_${dbUser.id}_${priceId}_${timeBucket}`;

    const session = await stripe.checkout.sessions.create(sessionConfig, {
      idempotencyKey,
    });

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/create-checkout-session]", err);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
