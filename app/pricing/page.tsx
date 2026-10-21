/**
 * app/pricing/page.tsx
 *
 * Public Pricing Page.
 * Visible and accessible to all visitors without requiring authentication.
 * - Authenticated users see their active plan, access level, and can purchase or upgrade.
 * - Unauthenticated visitors can view all plans, prices, and features.
 * - If an unauthenticated user clicks any purchase button, they are redirected to /sign-in.
 */

import { ensureDbUser } from "@/lib/user";
import { getUserAccess, type PlanId } from "@/lib/access";
import PricingPageClient, { type PricingPlan } from "@/app/dashboard/pricing/PricingPageClient";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Pricing & Plans | The GP Edge",
  description:
    "Invest in your RACGP & ACRRM fellowship exam success. Comprehensive exam prep question banks and clinical tools for GP Registrars across Australia.",
};

const ALL_PLANS: Record<PlanId, PricingPlan> = {
  free_plan: {
    id: "free_plan",
    name: "Free",
    tagline: "Try the platform before you commit",
    badge: null,
    priceDisplay: "0",
    priceNote: "No payment details · No time limit",
    billingType: "one-time",
    amountAUD: 0,
    highlight: false,
    features: [
      "A sample of AKT and KFP questions",
      "Full explanations on every sample question",
      "The same formats as the full bank",
    ],
    cta: "Start free",
    priceId: "",
  },
  registrar_6mo: {
    id: "registrar_6mo",
    name: "6-Month Exam Prep Plan",
    tagline: "Full exam prep access for your placement",
    badge: null,
    priceDisplay: "880",
    priceNote: "One-time payment · 6 months access",
    billingType: "one-time",
    amountAUD: 880,
    highlight: false,
    features: [
      "Unlimited AKT & KFP exam-level questions",
      "Deep explanations with guidelines reference",
      "Custom quiz builder, mocks & adaptive mode",
      "Full curriculum tracking & peer benchmarking",
      "Weekly updates when clinical guidelines change",
      "6 months of uninterrupted access",
    ],
    cta: "Get 6-Month Access",
    priceId: process.env.STRIPE_PRICE_REGISTRAR_6MONTH ?? "",
  },
  registrar_12mo: {
    id: "registrar_12mo",
    name: "12-Month Exam Prep Plan",
    tagline: "Best value - full year of exam prep",
    badge: "BEST VALUE",
    priceDisplay: "1,250",
    priceNote: "One-time payment · 12 months access",
    billingType: "one-time",
    amountAUD: 1250,
    highlight: true,
    features: [
      "Everything in the 6-Month plan",
      "12 months of uninterrupted access",
      "Save $510 vs two 6-month purchases",
      "Priority clinical support",
    ],
    cta: "Get 12-Month Access",
    priceId: process.env.STRIPE_PRICE_REGISTRAR_12MONTH ?? "",
  },
  fellowship_monthly: {
    id: "fellowship_monthly",
    name: "Fellowship",
    tagline: "Monthly access for Fellows",
    badge: null,
    priceDisplay: "30",
    priceNote: "AUD / month · Cancel any time",
    billingType: "monthly",
    amountAUD: 30,
    highlight: false,
    features: [
      "Full Note Templates library",
      "Full Medical Library access",
      "MBS Billing page - full access",
      "Cancel any time",
    ],
    cta: "Start Monthly Plan",
    priceId: process.env.STRIPE_PRICE_FELLOWSHIP_MONTHLY ?? "",
  },
  fellowship_yearly: {
    id: "fellowship_yearly",
    name: "Fellowship - Annual",
    tagline: "Save with a full year upfront",
    badge: "SAVE 17%",
    priceDisplay: "300",
    priceNote: "AUD / year · Save $60 vs monthly",
    billingType: "yearly",
    amountAUD: 300,
    highlight: true,
    features: [
      "Everything in Fellowship Monthly",
      "Pay once, save $60 per year",
      "Annual billing",
    ],
    cta: "Start Annual Plan",
    priceId: process.env.STRIPE_PRICE_FELLOWSHIP_YEARLY ?? "",
  },
  post_registrar_upgrade: {
    id: "post_registrar_upgrade",
    name: "Post-Registrar Upgrade",
    tagline: "Keep your clinical tools after fellowship",
    badge: null,
    priceDisplay: "15",
    priceNote: "AUD / month · Cancel any time",
    billingType: "monthly",
    amountAUD: 15,
    highlight: false,
    features: [
      "Full Note Templates library",
      "Full Medical Library access",
      "MBS Billing page - full access",
      "No exam prep (not included at this tier)",
      "Cancel any time",
    ],
    cta: "Start Upgrade Plan",
    priceId: process.env.STRIPE_PRICE_POST_REGISTRAR_MONTHLY ?? "",
  },
};

export default async function PricingPage() {
  let dbUser = null;
  try {
    dbUser = await ensureDbUser();
  } catch {
    dbUser = null;
  }

  const accessInfo = dbUser ? await getUserAccess(dbUser) : null;

  const isFellow = dbUser
    ? String(dbUser.training_stage ?? "").toUpperCase() === "FELLOW" ||
      String(dbUser.user_role ?? "").toUpperCase() === "FELLOW" ||
      String(dbUser.role_title ?? "").toLowerCase().includes("fellow") ||
      String(dbUser.role_title ?? "").toLowerCase().includes("post-reg")
    : false;

  const trainingStage = isFellow ? "FELLOW" : "REGISTRAR";

  // Build ordered plan list (showing the Free, 6-month, and 12-month Exam Prep plans)
  const visiblePlanIds: PlanId[] = ["free_plan", "registrar_6mo", "registrar_12mo"];
  const plans = visiblePlanIds.map((id) => ({ ...ALL_PLANS[id] }));

  const currentAccessLevel =
    accessInfo?.accessLevel ?? (dbUser?.has_purchased_registrar ? "REGISTRAR" : "FREE");

  return (
    <PricingPageClient
      plans={plans}
      userRole={dbUser?.user_role ?? "REGISTRAR"}
      trainingStage={trainingStage}
      currentAccessLevel={currentAccessLevel}
      accessExpiresAt={accessInfo?.currentPeriodEnd ? new Date(accessInfo.currentPeriodEnd).toISOString() : null}
      cancelAtPeriodEnd={accessInfo?.cancelAtPeriodEnd ?? false}
      activePriceId={accessInfo?.activePriceId ?? null}
      hasPaidAccess={accessInfo?.hasPaidAccess ?? (currentAccessLevel !== "FREE" || Boolean(dbUser?.has_purchased_registrar))}
      hasPurchasedRegistrar={Boolean(dbUser?.has_purchased_registrar)}
      activePlanName={accessInfo?.planName ?? null}
      isLoggedIn={Boolean(dbUser)}
    />
  );
}
