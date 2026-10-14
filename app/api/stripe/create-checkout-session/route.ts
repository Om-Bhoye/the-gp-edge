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
import { stripe, REGISTRAR_PRICE_IDS } from "@/lib/stripe";

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

    // ── Active Subscription Backend Guard ──────────────────────────────────────
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

    // ── Determine checkout mode ────────────────────────────────────────────────
    const isOneTimePayment = REGISTRAR_PRICE_IDS.has(priceId);
    const mode = isOneTimePayment ? "payment" : "subscription";

    // ── Build success / cancel URLs ───────────────────────────────────────────
    const baseUrl = getBaseUrl(req);
    const successUrl = `${baseUrl}/dashboard/pricing?success=true&session_id={CHECKOUT_SESSION_ID}`;
    const cancelUrl = `${baseUrl}/dashboard/pricing?canceled=true`;

    // ── Map Price IDs to granular names/durations ──────────────────────────────
    let packageName = "Unknown Plan";
    let planTitle = "Unknown Plan";
    let packageDurationMonths = "1";

    if (priceId === process.env.STRIPE_PRICE_REGISTRAR_6MONTH) {
      packageName = "Registrar 6-Month Package";
      planTitle = "Registrar 6-Month Package";
      packageDurationMonths = "6";
    } else if (priceId === process.env.STRIPE_PRICE_REGISTRAR_12MONTH) {
      packageName = "Registrar 12-Month Package";
      planTitle = "Registrar 12-Month Package";
      packageDurationMonths = "12";
    } else if (priceId === process.env.STRIPE_PRICE_POST_REGISTRAR_MONTHLY) {
      packageName = "Post-Registrar Upgrade";
      planTitle = "Loyalty Monthly Plan";
      packageDurationMonths = "1";
    } else if (priceId === process.env.STRIPE_PRICE_FELLOWSHIP_MONTHLY) {
      packageName = "Fellowship Monthly";
      planTitle = "Fellowship Monthly Plan";
      packageDurationMonths = "1";
    } else if (priceId === process.env.STRIPE_PRICE_FELLOWSHIP_YEARLY) {
      packageName = "Fellowship Annual";
      planTitle = "Fellowship Annual Plan";
      packageDurationMonths = "12";
    }

    // ── Create Checkout Session ────────────────────────────────────────────────
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

    if (dbUser.stripe_customer_id) {
      sessionConfig.customer = dbUser.stripe_customer_id;
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

    const session = await stripe.checkout.sessions.create(sessionConfig);

    return NextResponse.json({ url: session.url });
  } catch (err) {
    console.error("[stripe/create-checkout-session]", err);
    return NextResponse.json(
      { error: "An error occurred" },
      { status: 500 }
    );
  }
}
