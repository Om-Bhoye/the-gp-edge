/**
 * lib/stripe.ts
 *
 * Singleton Stripe server-side client & trusted plan configuration.
 * Import this in API routes and server actions — never in client components.
 */
import Stripe from "stripe";

// Do not throw at module evaluation time so Next.js static builds pass even if env is not loaded.
// Stripe will throw when actually used if the key is invalid.
export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "sk_test_dummy", {
  apiVersion: "2026-06-24.dahlia" as any,
  typescript: true,
});

/**
 * Deterministically adds calendar months to a Date with day-clamping.
 * If the target month has fewer days than the source date, it clamps to the
 * last valid day of that target month rather than overflowing into the next month.
 * Examples:
 *   - Jan 31 + 1 month  -> Feb 28 (or Feb 29 in leap year), NOT March 3
 *   - Aug 31 + 6 months -> Feb 28 (or Feb 29 in leap year), NOT March 3
 *   - Feb 29 + 12 months -> Feb 28, NOT March 1
 */
export function addMonths(date: Date, months: number): Date {
  const result = new Date(date);
  const originalDay = result.getDate();

  // Move to the 1st of the month first to prevent intermediate rollover
  result.setDate(1);
  result.setMonth(result.getMonth() + months);

  // Day 0 of the following month gives the last valid day of the target month
  const daysInTargetMonth = new Date(
    result.getFullYear(),
    result.getMonth() + 1,
    0
  ).getDate();

  // Clamp original day to the target month's maximum valid day
  result.setDate(Math.min(originalDay, daysInTargetMonth));

  return result;
}

export interface StripePlanConfig {
  priceId: string;
  packageName: string;
  planTitle: string;
  durationMonths: number;
  mode: "payment" | "subscription";
  accessLevel: "REGISTRAR" | "FELLOWSHIP" | "POST_REGISTRAR_UPGRADE";
  currency: "AUD";
  cycle: "monthly" | "annual";
}

/**
 * Returns trusted server-side configuration for any configured Stripe Price ID.
 * Returns null if the priceId is unknown or unsupported.
 */
export function getPlanConfigByPriceId(priceId: string): StripePlanConfig | null {
  if (!priceId) return null;

  if (priceId === process.env.STRIPE_PRICE_REGISTRAR_6MONTH) {
    return {
      priceId,
      packageName: "Registrar 6-Month Package",
      planTitle: "Registrar 6-Month Package",
      durationMonths: 6,
      mode: "payment",
      accessLevel: "REGISTRAR",
      currency: "AUD",
      cycle: "monthly",
    };
  }

  if (priceId === process.env.STRIPE_PRICE_REGISTRAR_12MONTH) {
    return {
      priceId,
      packageName: "Registrar 12-Month Package",
      planTitle: "Registrar 12-Month Package",
      durationMonths: 12,
      mode: "payment",
      accessLevel: "REGISTRAR",
      currency: "AUD",
      cycle: "monthly",
    };
  }

  if (priceId === process.env.STRIPE_PRICE_POST_REGISTRAR_MONTHLY) {
    return {
      priceId,
      packageName: "Post-Registrar Upgrade",
      planTitle: "Loyalty Monthly Plan",
      durationMonths: 1,
      mode: "subscription",
      accessLevel: "POST_REGISTRAR_UPGRADE",
      currency: "AUD",
      cycle: "monthly",
    };
  }

  if (priceId === process.env.STRIPE_PRICE_FELLOWSHIP_MONTHLY) {
    return {
      priceId,
      packageName: "Fellowship Monthly",
      planTitle: "Fellowship Monthly Plan",
      durationMonths: 1,
      mode: "subscription",
      accessLevel: "FELLOWSHIP",
      currency: "AUD",
      cycle: "monthly",
    };
  }

  if (priceId === process.env.STRIPE_PRICE_FELLOWSHIP_YEARLY) {
    return {
      priceId,
      packageName: "Fellowship Annual",
      planTitle: "Fellowship Annual Plan",
      durationMonths: 12,
      mode: "subscription",
      accessLevel: "FELLOWSHIP",
      currency: "AUD",
      cycle: "annual",
    };
  }

  return null;
}

/**
 * The set of Stripe Price IDs that correspond to one-time Registrar payments.
 */
export const REGISTRAR_PRICE_IDS = new Set(
  [
    process.env.STRIPE_PRICE_REGISTRAR_6MONTH,
    process.env.STRIPE_PRICE_REGISTRAR_12MONTH,
  ].filter(Boolean) as string[]
);

/**
 * How many months of access each Registrar price grants.
 */
export const REGISTRAR_ACCESS_MONTHS: Record<string, number> = {
  [process.env.STRIPE_PRICE_REGISTRAR_6MONTH ?? ""]: 6,
  [process.env.STRIPE_PRICE_REGISTRAR_12MONTH ?? ""]: 12,
};

/**
 * Maps a Stripe Price ID to its access_level_kind value.
 */
export function priceIdToAccessLevel(
  priceId: string
): "REGISTRAR" | "FELLOWSHIP" | "POST_REGISTRAR_UPGRADE" | null {
  const config = getPlanConfigByPriceId(priceId);
  return config?.accessLevel ?? null;
}

