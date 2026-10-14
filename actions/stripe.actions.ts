"use server";

import { auth } from "@clerk/nextjs/server";
import { headers } from "next/headers";
import { stripe } from "@/lib/stripe";
import prisma from "@/lib/prisma";
import { ensureDbUser } from "@/lib/user";

async function getBaseUrl(): Promise<string> {
  try {
    const headerList = await headers();
    const origin = headerList.get("origin");
    if (origin && origin !== "null") {
      return origin;
    }
    const host = headerList.get("x-forwarded-host") || headerList.get("host");
    if (host) {
      const proto =
        headerList.get("x-forwarded-proto") ||
        (host.includes("localhost") || host.includes("127.0.0.1") ? "http" : "https");
      return `${proto}://${host}`;
    }
  } catch (e) {
    // Ignore error if called outside request context
  }

  if (process.env.NEXT_PUBLIC_APP_URL) {
    let appUrl = process.env.NEXT_PUBLIC_APP_URL.trim();
    if (!appUrl.startsWith("http://") && !appUrl.startsWith("https://")) {
      appUrl = `https://${appUrl}`;
    }
    return appUrl;
  }

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`;
  }

  return "http://localhost:3000";
}

async function getOrFetchStripeCustomerId(dbUser: { id: string; stripe_customer_id: string | null; email: string }): Promise<string | null> {
  if (dbUser.stripe_customer_id) return dbUser.stripe_customer_id;
  if (!dbUser.email) return null;

  try {
    const searchRes = await stripe.customers.list({ email: dbUser.email, limit: 1 });
    if (searchRes.data.length > 0) {
      const customerId = searchRes.data[0].id;
      await prisma.users.update({
        where: { id: dbUser.id },
        data: { stripe_customer_id: customerId }
      });
      return customerId;
    }
  } catch (err) {
    console.error("[getOrFetchStripeCustomerId] Failed to search Stripe:", err);
  }
  return null;
}

export async function createBillingPortalSessionAction(): Promise<{ url?: string; error?: string }> {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return { error: "Not authenticated" };

    const dbUser = await ensureDbUser();
    if (!dbUser) return { error: "User profile not found" };

    const customerId = await getOrFetchStripeCustomerId(dbUser);

    if (!customerId) {
      return { error: "No billing history found for this account email." };
    }

    const baseUrl = await getBaseUrl();

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/profile`,
    });

    return { url: portalSession.url };
  } catch (err) {
    console.error("[createBillingPortalSessionAction] Error:", err);
    return { error: "Failed to open billing portal. Please try again later." };
  }
}

export async function submitCancellationFeedbackAction(reason: string, feedback?: string): Promise<{ success?: boolean; error?: string }> {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return { error: "Not authenticated" };

    const dbUser = await ensureDbUser();
    if (!dbUser || !dbUser.id) return { error: "User profile not found" };

    const feedbackModel = (prisma as any).cancellationFeedback || (prisma as any).cancellation_feedback;
    
    if (!feedbackModel) {
      throw new Error("Prisma cancellation model is undefined. Please restart your Next.js dev server or run 'npx prisma generate'.");
    }

    await feedbackModel.create({
      data: {
        user_id: dbUser.id,
        reason,
        feedback: feedback || null,
      },
    });

    return { success: true };
  } catch (err: any) {
    console.error("❌ Cancellation Feedback DB Error:", err);
    return { error: "An error occurred" };
  }
}

export async function getLatestInvoicePdfAction(): Promise<{ url?: string; error?: string }> {
  try {
    const { userId: clerkUserId } = await auth();
    if (!clerkUserId) return { error: "Not authenticated" };

    const dbUser = await ensureDbUser();
    if (!dbUser) return { error: "User profile not found" };

    const customerId = await getOrFetchStripeCustomerId(dbUser);
    if (!customerId) {
      return { error: "No billing history found for this account email." };
    }

    // 1. Check for paid invoices
    const invoices = await stripe.invoices.list({
      customer: customerId,
      limit: 10,
    });

    let invoiceToReturn = invoices.data.find(
      (inv) => inv.status === "paid" && (inv.hosted_invoice_url || inv.invoice_pdf)
    );

    if (invoiceToReturn) {
      // Return direct PDF if available, otherwise hosted invoice page
      const invoiceUrl = invoiceToReturn.invoice_pdf || invoiceToReturn.hosted_invoice_url;
      if (invoiceUrl) return { url: invoiceUrl };
    }

    // 2. Fallback: Launch Stripe Customer Portal (contains native PDF download buttons)
    const baseUrl = await getBaseUrl();
    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/dashboard/profile`,
    });

    if (portalSession?.url) {
      return { url: portalSession.url };
    }

    return { error: "No invoices found for this account." };
  } catch (err) {
    console.error("[getLatestInvoicePdfAction] Error:", err);
    return { error: "Failed to fetch invoice. Please try again later." };
  }
}
