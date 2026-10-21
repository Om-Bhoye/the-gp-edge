"use client";

/**
 * app/dashboard/pricing/PricingPageClient.tsx
 *
 * Premium SaaS Redesign for The GP Edge Pricing Page.
 * UI/UX redesign with 0 changes to backend, Stripe API integration, or role-awareness logic.
 */

import { useState, useTransition } from "react";
import Image from "next/image";
import { useAuth } from "@clerk/nextjs";
import { CheckCircle2, Clock, Zap, Star, Repeat, AlertCircle, Calendar, Award, CreditCard, FileText, Loader2, X } from "lucide-react";
import DuplicatePurchaseModal from "@/components/dashboard/DuplicatePurchaseModal";
import CancellationSurveyModal from "@/components/dashboard/CancellationSurveyModal";
import { createBillingPortalSessionAction, getLatestInvoicePdfAction } from "@/actions/stripe.actions";

export interface PricingPlan {
  id: string;
  name: string;
  tagline: string;
  badge: string | null;
  priceDisplay: string;
  strikeThroughPrice?: string;
  priceNote: string;
  billingType: "one-time" | "monthly" | "yearly";
  amountAUD: number;
  highlight: boolean;
  features: string[];
  cta: string;
  priceId: string;
}

export interface Props {
  plans: PricingPlan[];
  userRole?: string;
  trainingStage?: "REGISTRAR" | "FELLOW" | "OTHER";
  currentAccessLevel?: string;
  accessExpiresAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  activePriceId?: string | null;
  hasPaidAccess?: boolean;
  hasPurchasedRegistrar?: boolean;
  activePlanName?: string | null;
  isLoggedIn?: boolean;
}

// ─── Checkout handler ─────────────────────────────────────────────────────────

async function startCheckout(priceId: string): Promise<void> {
  const res = await fetch("/api/stripe/create-checkout-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "An error occurred");
  }

  const { url } = await res.json();
  if (url) window.location.href = url;
}

// ─── Plan Card ────────────────────────────────────────────────────────────────

function PlanCard({
  plan,
  currentAccessLevel,
  hasPaidAccess,
  activePriceId,
  accessExpiresAt,
  cancelAtPeriodEnd,
  onAttemptActivePurchase,
  activePlanName,
  isLoggedIn = true,
}: {
  plan: PricingPlan;
  currentAccessLevel: string;
  hasPaidAccess?: boolean;
  activePriceId?: string | null;
  accessExpiresAt?: string | null;
  cancelAtPeriodEnd?: boolean;
  onAttemptActivePurchase: () => void;
  activePlanName?: string | null;
  isLoggedIn?: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const { isSignedIn } = useAuth();
  const isUserAuthenticated = isLoggedIn && (isSignedIn ?? true);

  // 1. Identify the EXACT plan card using the original Price ID or fallback Package Key or granular activePlanName
  const isThisSpecificPlan = Boolean(
    hasPaidAccess &&
      ((plan.priceId && plan.priceId === activePriceId) ||
        (plan.id === "registrar_6mo" && activePlanName === "Registrar 6-Month Package") ||
        (plan.id === "registrar_12mo" && activePlanName === "Registrar 12-Month Package") ||
        (plan.id === "post_registrar_upgrade" && (activePlanName === "Loyalty Monthly Plan" || activePlanName === "Post-Registrar Upgrade")) ||
        (plan.id === "fellowship_monthly" && activePlanName === "Fellowship Monthly Plan") ||
        (plan.id === "fellowship_yearly" && activePlanName === "Fellowship Annual Plan") ||
        (plan.id === "post_registrar_upgrade" && activePriceId === "MONTHLY_15") ||
        (plan.id === "fellowship_monthly" && activePriceId === "MONTHLY_30") ||
        (plan.id === "fellowship_yearly" && activePriceId === "YEARLY_300") ||
        (plan.id === "registrar_6mo" && activePriceId === "REGISTRAR_6MO") ||
        (plan.id === "registrar_12mo" && activePriceId === "REGISTRAR_12MO"))
  );

  // Formatting expiration string
  let expiryDisplay = null;
  if (isThisSpecificPlan && accessExpiresAt) {
    const expDate = new Date(accessExpiresAt);
    const formatter = new Intl.DateTimeFormat("en-AU", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
    const formattedDate = formatter.format(expDate);

    // Determine whether the plan auto-renews or expires
    const isRecurringAutoRenewing = plan.billingType !== "one-time" && !cancelAtPeriodEnd;
    
    if (isRecurringAutoRenewing) {
      expiryDisplay = `Renews on ${formattedDate}`;
    } else {
      expiryDisplay = `Expires on ${formattedDate}`;
    }
  }

  function handleClick() {
    setError(null);

    // If user is not logged in, redirect to login window
    if (!isUserAuthenticated || isSignedIn === false) {
      const returnUrl = typeof window !== "undefined" ? (window.location.pathname || "/pricing") : "/pricing";
      window.location.href = `/sign-in?redirect_url=${encodeURIComponent(returnUrl)}`;
      return;
    }

    // Active Subscription Guard: Block duplicate checkout if user already has an active paid plan
    if (hasPaidAccess) {
      onAttemptActivePurchase();
      return;
    }

    if (!plan.priceId || (plan.priceId.startsWith("price_") && plan.priceId.endsWith("_here"))) {
      console.error("[PricingPage] Stripe Price ID is not configured:", plan.id);
      setError("An error occurred");
      return;
    }

    startTransition(async () => {
      try {
        await startCheckout(plan.priceId);
      } catch (e) {
        console.error("[PricingPage] Checkout error:", e);
        const msg = e instanceof Error ? e.message : "";
        if (msg && msg.includes("already have an active subscription")) {
          setError(msg);
        } else {
          setError("An error occurred");
        }
      }
    });
  }

  return (
    <div
      className={`
        relative flex flex-col justify-between w-full max-w-md mx-auto p-6 md:p-7 
        transition-all duration-300 rounded-2xl select-none
        ${isThisSpecificPlan
          ? "bg-white dark:bg-slate-900 border-2 border-teal-600 dark:border-teal-500 shadow-md"
          : "bg-white dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 shadow-xs hover:border-slate-300 dark:hover:border-slate-700 hover:scale-[1.01]"
        }
      `}
    >
      {/* Top Badge for Active Plan */}
      {isThisSpecificPlan && (
        <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-[11px] font-semibold text-teal-700 dark:text-teal-300 bg-teal-50 dark:bg-teal-950/40 border border-teal-200/80 dark:border-teal-800/60 mb-3.5 self-start">
          <span className="w-1.5 h-1.5 rounded-full bg-teal-600 dark:bg-teal-400" />
          Current Active Plan
        </div>
      )}

      <div>
        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg md:text-xl font-bold text-slate-900 dark:text-slate-100 leading-snug">
              {plan.name}
            </h3>
          </div>
          {expiryDisplay && (
            <p className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mt-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 rounded-xl px-2.5 py-0.5 inline-block">
              {expiryDisplay}
            </p>
          )}
          <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            {plan.tagline}
          </p>
        </div>

        {/* Price Display */}
        <div className="my-5">
          <div className="flex items-baseline gap-2 mb-1.5 flex-wrap">
            {plan.strikeThroughPrice && (
              <span className="text-xl md:text-2xl font-bold text-slate-400 dark:text-slate-500 line-through decoration-red-500/80 mr-1">
                AUD {plan.strikeThroughPrice}
              </span>
            )}
            <span className="text-sm font-extrabold text-slate-600 dark:text-slate-400 uppercase tracking-wider">AUD</span>
            <span className="text-4xl md:text-5xl font-extrabold tracking-tight text-emerald-700 dark:text-emerald-400">
              {plan.priceDisplay}
            </span>
            {plan.billingType === "monthly" && (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/month</span>
            )}
            {plan.billingType === "yearly" && (
              <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">/year</span>
            )}
          </div>
          <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium mt-2">
            {plan.billingType === "one-time" ? (
              <CreditCard className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            ) : (
              <Calendar className="w-4 h-4 text-emerald-700 dark:text-emerald-400 shrink-0" />
            )}
            <span>{plan.priceNote}</span>
          </div>
        </div>

        {/* Divider */}
        <div className="h-px bg-slate-100 dark:bg-slate-800/80 my-5" />

        {/* Features list */}
        <ul className="space-y-3 mb-8">
          {plan.features.map((feature) => {
            const isMuted = feature.toLowerCase().startsWith("no ");
            return (
              <li
                key={feature}
                className={`flex items-start gap-3 text-xs md:text-sm ${
                  isMuted
                    ? "text-slate-400 dark:text-slate-600 line-through"
                    : "text-slate-700 dark:text-slate-300"
                }`}
              >
                <span
                  className={`w-1.5 h-1.5 rounded-full shrink-0 mt-2 ${
                    isMuted
                      ? "bg-slate-300 dark:bg-slate-700"
                      : "bg-emerald-600 dark:bg-emerald-400"
                  }`}
                />
                <span>{feature}</span>
              </li>
            );
          })}
        </ul>
      </div>

      {/* Error Message */}
      {error && (
        <div className="flex items-center gap-2 p-3 rounded-xl bg-red-50 dark:bg-red-950/30 border border-red-200/60 dark:border-red-800/40 text-red-600 dark:text-red-400 text-xs mb-4">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* CTA Button */}
      <button
        onClick={handleClick}
        disabled={isPending || isThisSpecificPlan}
        className={`
          w-full py-3.5 px-5 rounded-xl font-bold text-sm transition-all duration-200 cursor-pointer
          disabled:opacity-60 disabled:cursor-not-allowed active:scale-[0.99]
          ${isThisSpecificPlan
            ? "bg-slate-100 dark:bg-slate-800/90 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 shadow-2xs font-semibold cursor-default"
            : "bg-teal-600 hover:bg-teal-500 text-white shadow-sm hover:shadow"
          }
        `}
      >
        {isPending ? (
          <span className="flex items-center justify-center gap-2">
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" className="opacity-25" />
              <path d="M4 12a8 8 0 018-8v8z" fill="currentColor" className="opacity-75" />
            </svg>
            Redirecting to checkout…
          </span>
        ) : isThisSpecificPlan ? (
          "Current Active Plan"
        ) : (
          plan.cta
        )}
      </button>
    </div>
  );
}

// ─── Access level banner ──────────────────────────────────────────────────────

function AccessBanner({
  currentAccessLevel,
  accessExpiresAt,
  cancelAtPeriodEnd,
  isRecurring,
  activePlanName = null,
  isLoggedIn = true,
}: {
  currentAccessLevel: string;
  accessExpiresAt: string | null;
  cancelAtPeriodEnd?: boolean;
  isRecurring?: boolean;
  activePlanName?: string | null;
  isLoggedIn?: boolean;
}) {
  const [pendingAction, setPendingAction] = useState<"invoice" | "cancel" | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);

  function handlePortalRedirect(actionType: "invoice" | "cancel") {
    setError(null);
    setPendingAction(actionType);

    const actionPromise = actionType === "invoice" 
      ? getLatestInvoicePdfAction() 
      : createBillingPortalSessionAction();

    actionPromise.then((res) => {
      if (res.url) {
        if (actionType === "invoice") {
          window.open(res.url, '_blank');
          setPendingAction(null);
        } else {
          window.location.href = res.url;
        }
      } else {
        setError(res.error || (actionType === "invoice" ? "Could not fetch invoice PDF." : "Could not launch Stripe billing portal."));
        setPendingAction(null);
      }
    }).catch(() => {
      setError("An unexpected error occurred.");
      setPendingAction(null);
    });
  }

  if (!isLoggedIn || currentAccessLevel === "FREE") return null;

  const levelLabel: Record<string, string> = {
    REGISTRAR: "Registrar",
    FELLOWSHIP: "Fellowship",
    POST_REGISTRAR_UPGRADE: "Post-Registrar Upgrade",
  };

  const expiryText = accessExpiresAt
    ? `Expires ${new Date(accessExpiresAt).toLocaleDateString("en-AU", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })}`
    : null;

  return (
    <div className="w-full max-w-4xl mx-auto mb-6 sm:mb-8 select-none">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-5 sm:px-6 py-3 sm:py-3.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-500/30 dark:border-teal-500/30 shadow-2xs transition-all">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-100">
              Active Plan: <span className="text-teal-600 dark:text-teal-400 font-semibold">{activePlanName || levelLabel[currentAccessLevel] || currentAccessLevel}</span>
            </p>
            {cancelAtPeriodEnd && (
              <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-400 border border-amber-200/80 dark:border-amber-800/60 px-2 py-0.5 rounded-md">
                Canceled
              </span>
            )}
          </div>
          {expiryText && (
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">{expiryText}</p>
          )}
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto shrink-0">
          <button
            type="button"
            onClick={() => handlePortalRedirect("invoice")}
            disabled={pendingAction !== null}
            className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-slate-50 dark:bg-slate-800/80 border border-slate-200/90 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700 hover:border-teal-500 dark:hover:border-teal-400 text-slate-700 dark:text-slate-200 hover:text-teal-700 dark:hover:text-teal-300 text-xs font-semibold shadow-2xs transition-all disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            {pendingAction === "invoice" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileText className="w-3.5 h-3.5 text-teal-600 dark:text-teal-400" />}
            Download Invoices
          </button>
        </div>
      </div>

      {error && (
        <div className="fixed top-24 right-6 z-[100] max-w-sm p-4 rounded-xl bg-red-50/95 dark:bg-red-950/95 border border-red-500/50 text-red-700 dark:text-red-300 text-sm flex items-start gap-3 backdrop-blur-md shadow-2xl animate-in slide-in-from-top-4 fade-in duration-300">
          <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
          <div className="flex-1">
            <p className="font-semibold">Action failed</p>
            <p className="mt-1 opacity-90">{error}</p>
          </div>
          <button onClick={() => setError(null)} className="shrink-0 opacity-50 hover:opacity-100 transition-opacity mt-0.5">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <CancellationSurveyModal
        open={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        formattedExpiry={expiryText}
      />
    </div>
  );
}

// ─── Module access summary ────────────────────────────────────────────────────

const MODULE_ACCESS: Record<
  string,
  { page: string; free: string; paid: string; fullPaidOnly?: boolean }[]
> = {
  REGISTRAR: [
    { page: "Exam Prep (AKT & KFP)", free: "15 questions (lifetime)", paid: "Unlimited", fullPaidOnly: true },
    { page: "Note Templates", free: "5 templates (lifetime)", paid: "Full access" },
    { page: "Medical Library", free: "10 topics (lifetime)", paid: "Full access" },
    { page: "MBS Billing", free: "Locked", paid: "Full access" },
  ],
  FELLOW: [
    { page: "Exam Prep (AKT & KFP)", free: "15 questions (lifetime)", paid: "Not included" },
    { page: "Note Templates", free: "5 templates (lifetime)", paid: "Full access" },
    { page: "Medical Library", free: "10 topics (lifetime)", paid: "Full access" },
    { page: "MBS Billing", free: "Locked", paid: "Full access" },
  ],
};

// ─── Page Client Component ─────────────────────────────────────────────────────

export default function PricingPageClient({
  plans,
  userRole = "REGISTRAR",
  trainingStage = "REGISTRAR",
  currentAccessLevel = "FREE",
  accessExpiresAt = null,
  cancelAtPeriodEnd = false,
  activePriceId = null,
  hasPaidAccess = false,
  hasPurchasedRegistrar = false,
  activePlanName = null,
  isLoggedIn = true,
}: Props) {
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);

  const isFellow =
    String(trainingStage ?? "").toUpperCase() === "FELLOW" ||
    String(userRole ?? "").toUpperCase() === "FELLOW";

  // Show all provided plans (universally show only the 6-month and 12-month Exam Prep plans)
  const sanitizedPlans = plans;

  const orderedPlans = [...sanitizedPlans].sort((a, b) => a.amountAUD - b.amountAUD);
  
  const moduleRows = MODULE_ACCESS[isFellow ? "FELLOW" : "REGISTRAR"] ?? MODULE_ACCESS.REGISTRAR;

  // Determine if the active plan is recurring
  const activePlan = plans.find((p) => p.priceId === activePriceId);
  const isRecurring = activePlan ? activePlan.billingType !== "one-time" : (currentAccessLevel === "FELLOWSHIP" || currentAccessLevel === "POST_REGISTRAR_UPGRADE");

  return (
    <>
      <DuplicatePurchaseModal
        open={showDuplicateModal}
        accessExpiresAt={accessExpiresAt}
        onClose={() => setShowDuplicateModal(false)}
      />

      <div className="w-full pb-20 pt-4 px-4 md:px-8 max-w-7xl flex flex-col mx-auto">
        {/* ── Section 1: Hero Section ───────────────────────────────────────── */}
        <section className="mb-8 w-full flex flex-col items-center text-center justify-center max-w-3xl mx-auto">
          {/* Small Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-xl bg-emerald-50/90 dark:bg-[#151922] text-xs font-bold text-emerald-800 dark:text-emerald-300 border border-emerald-200/80 dark:border-[rgba(90,200,176,0.3)] shadow-[0_2px_8px_rgba(20,184,166,0.08)] dark:shadow-[0_2px_12px_rgba(0,0,0,0.3)] uppercase tracking-[0.12em] mb-4 transition-all">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Universal Exam Prep Plans
          </div>

          {/* Large Heading */}
          <h1 className="font-serif text-4xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.1] tracking-tight text-slate-900 dark:text-slate-50 max-w-2xl mx-auto">
            Invest in your <br />
            fellowship success
          </h1>
        </section>

        {/* ── Active Access Banner ───────────────────────────────────────────── */}
        <AccessBanner 
          currentAccessLevel={currentAccessLevel} 
          accessExpiresAt={accessExpiresAt} 
          cancelAtPeriodEnd={cancelAtPeriodEnd}
          isRecurring={isRecurring}
          activePlanName={activePlanName}
          isLoggedIn={isLoggedIn}
        />

        {/* ── Section 2: Pricing Cards ──────────────────────────────────────── */}
        <section className="mb-16 w-full flex justify-center">
          <div
            className={`grid gap-6 w-full mx-auto justify-center ${
              orderedPlans.length === 1
                ? "grid-cols-1 max-w-md"
                : orderedPlans.length === 2
                ? "grid-cols-1 md:grid-cols-2 max-w-4xl"
                : "grid-cols-1 md:grid-cols-3 max-w-7xl"
            }`}
          >
            {orderedPlans.map((plan) => (
              <PlanCard
                key={plan.id}
                plan={plan}
                currentAccessLevel={currentAccessLevel}
                hasPaidAccess={hasPaidAccess}
                activePriceId={activePriceId}
                accessExpiresAt={accessExpiresAt}
                cancelAtPeriodEnd={cancelAtPeriodEnd}
                onAttemptActivePurchase={() => setShowDuplicateModal(true)}
                activePlanName={activePlanName}
                isLoggedIn={isLoggedIn}
              />
            ))}
          </div>
        </section>

        {/* ── Section 3: What's Included Feature Grid ────────────────────────── */}
        <section className="w-full mt-12 sm:mt-16 border-t border-slate-200/80 dark:border-slate-800/80 pt-12 sm:pt-16">
          <div className="mb-8 text-center sm:text-left max-w-3xl">
            <h2 className="text-2xl md:text-3xl font-bold font-serif text-slate-900 dark:text-slate-50 mb-2 leading-tight">
              Built for GP Registrars: AKT &amp; KFP Exam Preparation
            </h2>
            <p className="text-slate-650 dark:text-slate-400 text-xs sm:text-sm font-sans leading-relaxed">
              A question bank for the RACGP written exams, built and maintained specifically for Australian general practice.
            </p>
            <div className="mt-3.5 inline-block px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-955/30 text-emerald-800 dark:text-emerald-300 text-xs font-semibold border border-emerald-100 dark:border-emerald-900/30">
              Start with 30 free questions (23 AKT &amp; 7 KFP) — no payment details required.
            </div>
          </div>

          {/* Grid Layout: 4 Compact Cards */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 max-w-7xl mx-auto">
            {/* Card 1 */}
            <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 font-sans">
                  High-Yield Question Bank &amp; Rigorous Explanations
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 pl-4 list-disc leading-relaxed">
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">AKT Questions:</strong> Written in Single Best Answer format with 5–10 options, set in Australian general practice and pitched at exam-level difficulty.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">KFP Questions:</strong> Built in the current select-X format with realistic option pools designed to test clinical discrimination.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Deep Explanations:</strong> Explains why correct answers are right, why wrong options fail, and references exact guidelines (document, edition, section, cut-offs, and last review date).
                </li>
              </ul>
            </div>

            {/* Card 2 */}
            <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 font-sans">
                  Three Flexible Ways to Practise
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 pl-4 list-disc leading-relaxed">
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Build Your Own Quiz:</strong> Customise by curriculum units, topics, subtopics, length, difficulty, and timed/untimed modes.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Sit a Mock Exam:</strong> Full-length, hand-assembled mocks with weighted topic coverage and scoring calibrated to the real RACGP exam.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Adaptive Practice (Let the Platform Pick):</strong> Quizzes dynamically generated from your performance, targeting weak spots and unattempted topics.
                </li>
              </ul>
            </div>

            {/* Card 3 */}
            <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 font-sans">
                  Smart Readiness &amp; Study Tracking
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 pl-4 list-disc leading-relaxed">
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Finds Where You&apos;re Thin:</strong> Flags both poorly answered topics and topics you haven&apos;t attempted yet to prevent hidden preparation blind spots.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Prevents Over-Studying:</strong> Identifies mastered topics so you stop repeating what you already know.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Real-Time Readiness Score:</strong> Track preparation by unit and benchmark your readiness against peers.
                </li>
              </ul>
            </div>

            {/* Card 4 */}
            <div className="p-5 rounded-2xl border border-slate-200/60 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-2xs hover:border-slate-300 dark:hover:border-slate-700/80 transition-all duration-200">
              <div className="flex items-center gap-2.5 mb-3">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-slate-50 font-sans">
                  Complete RACGP Curriculum Coverage
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-slate-600 dark:text-slate-400 pl-4 list-disc leading-relaxed">
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Proportional Weighting:</strong> Study time matches mark distribution—high-frequency GP conditions receive deeper question coverage.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Exam-Calibrated:</strong> Rebalanced continuously using published College exam performance reports.
                </li>
                <li>
                  <strong className="text-slate-800 dark:text-slate-300 font-semibold">Continuous Updates:</strong> Questions updated weekly and refreshed whenever clinical guidelines change.
                </li>
              </ul>
            </div>
          </div>
        </section>
      </div>
    </>
  );
}
