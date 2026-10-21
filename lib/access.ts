/**
 * lib/access.ts
 *
 * Server-side access control helpers.
 * All functions query Postgres via Prisma — never call these from client components.
 *
 * Key rules encoded here:
 *  - canAccessExamPrep:  ONLY active, non-expired Registrar purchase grants full access.
 *                        has_purchased_registrar alone is NOT sufficient — expiry is checked.
 *  - hasPaidAccess:      Any active paid tier ($1500, $2500, $15/mo, $30/mo, $300/yr).
 *  - getVisiblePlans:    The four visibility rules from the pricing requirements.
 */

import prisma from "@/lib/prisma";
import { unstable_noStore } from "next/cache";
import { cache } from "react";
import { readAccessCookie, writeAccessCookie } from "@/lib/access-cookie";

// ─── Types ────────────────────────────────────────────────────────────────────

export type UserRole = "REGISTRAR" | "FELLOW";
export type TrainingStage = "REGISTRAR" | "FELLOW" | "OTHER";
export type AccessLevel = "FREE" | "REGISTRAR" | "FELLOWSHIP" | "POST_REGISTRAR_UPGRADE";

export interface UserAccessInfo {
  /** Internal DB user ID */
  userId: string;
  userRole: UserRole;
  trainingStage: TrainingStage;
  hasPurchasedRegistrar: boolean;
  roleReevaluated: boolean;
  /** Current effective access level (from active subscription row) */
  accessLevel: AccessLevel;
  /**
   * True ONLY when:
   *   - access_level === 'REGISTRAR'
   *   - AND access_expires_at is in the future
   * This is the guard for Page 1 (Exam Prep) full access.
   */
  isRegistrarActive: boolean;
  /**
   * True when any paid plan is currently active.
   * Grants access to Pages 2, 3, 4.
   */
  hasPaidAccess: boolean;
  freeQuestionsLeft: number;
  freeTemplatesLeft: number;
  freeTopicsLeft: number;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: Date | null;
  activePriceId: string | null;
  currentPeriodStart: Date | null;
  planName: string | null;
  purchasedPackageType: string | null;
}

export type DbUserAccessInput = {
  id: string;
  clerk_user_id?: string | null;
  email?: string | null;
  user_role: string;
  training_stage?: string | null;
  has_purchased_registrar?: boolean | null;
  role_reevaluated?: boolean | null;
  free_questions_left?: number | null;
  free_templates_left?: number | null;
  free_topics_left?: number | null;
  [key: string]: unknown;
};

// ─── Core access resolver ─────────────────────────────────────────────────────

/**
 * Fetch all access-control data for a user in a single DB call.
 * Accepts either a user ID string or an already-loaded DB user record to avoid redundant queries.
 * Returns null if the user does not exist.
 */
export const getUserAccess = cache(async (userOrId: string | DbUserAccessInput | null | undefined): Promise<UserAccessInfo | null> => {
  // Opt out of all caching — access expiry must be evaluated against live DB data.
  // This prevents Next.js from serving stale access decisions from its data cache.
  unstable_noStore();

  if (!userOrId) return null;

  const isObject = typeof userOrId === "object" && userOrId !== null;
  const lookupId = isObject ? (userOrId.id || userOrId.clerk_user_id || userOrId.email) : userOrId;

  if (!lookupId) return null;

  // 0. Fast path: serve from the signed access cookie when it is fresh and the
  //    subscription has not expired — this avoids the DB queries below on the
  //    vast majority of authenticated requests. See lib/access-cookie.ts.
  const cached = await readAccessCookie(lookupId);
  if (cached) return cached;

  // 1. Fetch user by internal Postgres ID, Clerk ID, or Email address (or reuse already-loaded user object)
  let user: DbUserAccessInput | null = null;
  if (isObject && userOrId.id && userOrId.user_role !== undefined) {
    user = userOrId;
  } else {
    try {
      user = await prisma.users.findFirst({
        where: {
          OR: [
            { id: lookupId },
            { clerk_user_id: lookupId },
            { email: lookupId },
          ],
        },
        select: {
          id: true,
          clerk_user_id: true,
          email: true,
          user_role: true,
          training_stage: true,
          has_purchased_registrar: true,
          role_reevaluated: true,
          free_questions_left: true,
          free_templates_left: true,
          free_topics_left: true,
        },
      });
    } catch (err) {
      console.warn("[getUserAccess] training_stage / role_reevaluated column fallback triggered:", err);
      user = await prisma.users.findFirst({
        where: {
          OR: [
            { id: lookupId },
            { clerk_user_id: lookupId },
            { email: lookupId },
          ],
        },
        select: {
          id: true,
          clerk_user_id: true,
          email: true,
          user_role: true,
          has_purchased_registrar: true,
          free_questions_left: true,
          free_templates_left: true,
          free_topics_left: true,
        },
      });
    }
  }

  if (!user) {
    console.log(`[getUserAccess] No user found matching ID/ClerkID/Email: "${lookupId}"`);
    return null;
  }

  const now = new Date();

  // 2. Query all subscription records for this user
  const subs = await prisma.subscriptions.findMany({
    where: { user_id: user.id },
    orderBy: { created_at: "desc" },
  });

  console.log(
    `[getUserAccess] User "${user.id}" (role=${user.user_role}, purchasedRegistrar=${user.has_purchased_registrar}). Subscriptions count: ${subs.length}`,
    subs.map((s) => ({
      id: s.id,
      status: s.status,
      access_level: s.access_level,
      access_expires_at: s.access_expires_at,
    }))
  );

  // 3. Auto-expire subscriptions whose access_expires_at has passed.
  //
  //    Neon/Postgres has no background job to flip 'active' → 'expired' when
  //    access_expires_at passes. We do it here on the first request after expiry
  //    so that status becomes the single source of truth for every downstream
  //    code path (pricing page, checkout guard, profile billing card, etc.).
  //    Without this, every reader must independently check access_expires_at,
  //    which is error-prone and was the root cause of this bug.
  const nowExpired = subs.filter((s) => {
    const st = (s.status ?? "").toString().toLowerCase();
    const isStillMarkedActive = st === "active" || st === "trialing";
    const hasPastExpiry =
      s.access_expires_at != null && new Date(s.access_expires_at) <= now;
    return isStillMarkedActive && hasPastExpiry;
  });

  if (nowExpired.length > 0) {
    const expiredIds = nowExpired.map((s) => s.id);
    console.log(`[getUserAccess] ⏰ Auto-expiring ${expiredIds.length} subscription(s):`, expiredIds);
    try {
      // NOTE: Do NOT include updated_at here — it is an @updatedAt field managed
      // by Prisma automatically. Setting it manually in updateMany causes a
      // validation error that silently fails (previously swallowed by .catch()).
      const result = await prisma.subscriptions.updateMany({
        where: { id: { in: expiredIds } },
        data: { status: "expired" },
      });
      console.log(`[getUserAccess] ✅ Expired ${result.count} subscription row(s) in Neon`);
    } catch (err: any) {
      console.error("[getUserAccess] ❌ Failed to auto-expire subscriptions:", err?.message ?? err);
    }
    // Reflect the new status in our local array so the filter below sees it
    nowExpired.forEach((s) => {
      (s as any).status = "expired";
    });
  }


  // 4. Filter to only genuinely valid subscriptions.
  //    At this point status is accurate (auto-expiry ran above), so we
  //    only need to check status — access_expires_at is the trailing guard.
  const validSubs = subs.filter((s) => {
    const st = (s.status ?? "").toString().toLowerCase();
    const isActiveStatus = st === "active" || st === "trialing";
    // Belt-and-suspenders: also require access_expires_at to be in the future.
    // This catches any edge case where status wasn't updated (e.g. concurrent requests).
    const isUnexpired =
      s.access_expires_at != null &&
      new Date(s.access_expires_at) > now;
    return isActiveStatus && isUnexpired;
  });

  // Prioritize active sub by access_level (REGISTRAR > POST_REGISTRAR_UPGRADE > FELLOWSHIP)
  let activeSub = validSubs[0] || null;
  if (validSubs.length > 1) {
    const registrarSub = validSubs.find((s) => String(s.access_level).toUpperCase() === "REGISTRAR");
    const postRegSub = validSubs.find((s) => String(s.access_level).toUpperCase() === "POST_REGISTRAR_UPGRADE");
    const fellowshipSub = validSubs.find((s) => String(s.access_level).toUpperCase() === "FELLOWSHIP");
    activeSub = registrarSub || postRegSub || fellowshipSub || validSubs[0];
  }

  const isSubValid = activeSub != null;
  let accessLevel: AccessLevel = "FREE";

  let planName = activeSub?.plan_name ?? null;
  let purchasedPackageType = activeSub?.purchased_package_type ?? null;

  if (activeSub && (!planName || !purchasedPackageType)) {
    const priceId = activeSub.stripe_price_id;
    if (priceId === process.env.STRIPE_PRICE_REGISTRAR_6MONTH) {
      planName = planName || "Registrar 6-Month Package";
      purchasedPackageType = purchasedPackageType || "Registrar 6-Month Package";
    } else if (priceId === process.env.STRIPE_PRICE_REGISTRAR_12MONTH) {
      planName = planName || "Registrar 12-Month Package";
      purchasedPackageType = purchasedPackageType || "Registrar 12-Month Package";
    } else if (priceId === process.env.STRIPE_PRICE_POST_REGISTRAR_MONTHLY) {
      planName = planName || "Loyalty Monthly Plan";
      purchasedPackageType = purchasedPackageType || "Post-Registrar Upgrade";
    } else if (priceId === process.env.STRIPE_PRICE_FELLOWSHIP_MONTHLY) {
      planName = planName || "Fellowship Monthly Plan";
      purchasedPackageType = purchasedPackageType || "Fellowship Monthly";
    } else if (priceId === process.env.STRIPE_PRICE_FELLOWSHIP_YEARLY) {
      planName = planName || "Fellowship Annual Plan";
      purchasedPackageType = purchasedPackageType || "Fellowship Annual";
    } else if (activeSub.access_level === "REGISTRAR" && activeSub.current_period_start && activeSub.access_expires_at) {
      const start = new Date(activeSub.current_period_start);
      const end = new Date(activeSub.access_expires_at);
      const diffMonths = Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 30));
      if (diffMonths > 9) {
        planName = planName || "Registrar 12-Month Package";
        purchasedPackageType = purchasedPackageType || "Registrar 12-Month Package";
      } else {
        planName = planName || "Registrar 6-Month Package";
        purchasedPackageType = purchasedPackageType || "Registrar 6-Month Package";
      }
    }
  }

  if (isSubValid && activeSub) {
    const lvl = String(activeSub.access_level ?? "").toUpperCase();
    if (lvl === "REGISTRAR" || lvl === "FELLOWSHIP" || lvl === "POST_REGISTRAR_UPGRADE") {
      accessLevel = lvl as AccessLevel;
    } else {
      accessLevel = "FELLOWSHIP"; // fallback if valid active sub exists
    }
  }
  // NOTE: We deliberately do NOT fall back to 'REGISTRAR' from has_purchased_registrar alone.
  // has_purchased_registrar is a PERMANENT flag and does not indicate current access.
  // Access is ONLY granted through a valid, non-expired subscription row.

  // ── isRegistrarActive ──────────────────────────────────────────────────────
  // STRICT RULE: A user is only isRegistrarActive if ALL of:
  //   1. There is a valid (active status + non-expired) subscription row
  //   2. That subscription's access_level is REGISTRAR
  //   3. access_expires_at is explicitly set and in the future
  // Changing access_expires_at to the past in Neon IMMEDIATELY revokes this.
  const isRegistrarActive =
    isSubValid &&
    accessLevel === "REGISTRAR" &&
    activeSub?.access_expires_at != null &&
    new Date(activeSub.access_expires_at) > now;

  // ── hasPaidAccess ──────────────────────────────────────────────────────────
  // STRICT RULE: hasPaidAccess requires an active, non-expired subscription row.
  // has_purchased_registrar alone does NOT grant hasPaidAccess (it is permanent
  // and does not reflect current subscription state).
  const hasPaidAccess = isSubValid;

  console.log(`[getUserAccess] Computed flags for user "${user.id}":`, {
    accessLevel,
    isRegistrarActive,
    hasPaidAccess,
    activeSubId: activeSub?.id,
    activeSubStatus: activeSub?.status,
    activeSubLevel: activeSub?.access_level,
    activeSubExpiresAt: activeSub?.access_expires_at,
  });

  const stage = (user.training_stage || (user.user_role === "FELLOW" ? "FELLOW" : "REGISTRAR")) as TrainingStage;

  const result: UserAccessInfo = {
    userId: user.id,
    userRole: user.user_role as UserRole,
    trainingStage: stage,
    hasPurchasedRegistrar: Boolean(user.has_purchased_registrar),
    roleReevaluated: user.role_reevaluated ?? false,
    accessLevel,
    isRegistrarActive,
    hasPaidAccess,
    freeQuestionsLeft: Number(user.free_questions_left ?? 0),
    freeTemplatesLeft: Number(user.free_templates_left ?? 0),
    freeTopicsLeft: Number(user.free_topics_left ?? 0),
    cancelAtPeriodEnd: activeSub?.cancel_at != null,
    currentPeriodEnd: activeSub?.current_period_end ?? null,
    activePriceId: activeSub?.stripe_price_id ?? null,
    currentPeriodStart: activeSub?.current_period_start ?? activeSub?.created_at ?? null,
    planName,
    purchasedPackageType,
  };

  // Refresh the signed cookie so subsequent requests can skip the DB. This is a
  // no-op when we're in a pure Server Component render (writes are only allowed
  // in Server Actions / Route Handlers); the correct result is still returned.
  // `activeSub.access_expires_at` is embedded so expiry is re-checked on read.
  await writeAccessCookie(
    result,
    {
      internalId: user.id,
      clerkUserId: user.clerk_user_id ?? null,
      email: user.email ?? null,
    },
    activeSub?.access_expires_at ?? null,
  );

  return result;
});

// ─── Per-module & Item access checks ──────────────────────────────────────────

/**
 * Exam Prep / Quizzes Access:
 *  - Registrar (6mo / 12mo active): FULL ACCESS to all quizzes and questions.
 *  - Subscription ($15/mo, $30/mo, $300/yr) & Free Tier: Accessible ONLY if is_free == true.
 */
export async function canAccessExamPrep(userId: string): Promise<{
  hasFullAccess: boolean;
}> {
  const access = await getUserAccess(userId);
  if (!access) return { hasFullAccess: false };
  return { hasFullAccess: access.isRegistrarActive };
}

export async function canAccessQuizItem(userId: string, isFree: boolean): Promise<boolean> {
  if (isFree) return true;
  const access = await getUserAccess(userId);
  if (!access) return false;
  return access.isRegistrarActive;
}

/**
 * Medical Library / Clinical Notes Access:
 *  - Any active paid plan (Subscription or Registrar): FULL ACCESS to all items.
 *  - Free Tier: Accessible ONLY if is_free == true.
 */
export async function canAccessStudy(userId: string): Promise<{
  hasFullAccess: boolean;
}> {
  const access = await getUserAccess(userId);
  if (!access) return { hasFullAccess: false };
  return { hasFullAccess: access.hasPaidAccess };
}

export async function canAccessMedicalLibraryItem(userId: string, isFree: boolean): Promise<boolean> {
  if (isFree) return true;
  const access = await getUserAccess(userId);
  if (!access) return false;
  return access.hasPaidAccess;
}

/**
 * Note Templates / Clinical Autofills Access:
 *  - Any active paid plan (Subscription or Registrar): FULL ACCESS to all templates.
 *  - Free Tier: Accessible ONLY if is_free == true.
 */
export async function canAccessTemplates(userId: string): Promise<{
  hasFullAccess: boolean;
}> {
  const access = await getUserAccess(userId);
  if (!access) return { hasFullAccess: false };
  return { hasFullAccess: access.hasPaidAccess };
}

export async function canAccessTemplateItem(userId: string, isFree: boolean): Promise<boolean> {
  if (isFree) return true;
  const access = await getUserAccess(userId);
  if (!access) return false;
  return access.hasPaidAccess;
}

/**
 * Page 4 — MBS Billing Access:
 *  - Any active paid plan: FULL ACCESS.
 *  - Free users: FULLY LOCKED (0 access / 403).
 */
export async function canAccessMBS(userId: string): Promise<{
  hasFullAccess: boolean;
}> {
  const access = await getUserAccess(userId);
  if (!access) return { hasFullAccess: false };
  return { hasFullAccess: access.hasPaidAccess };
}

export async function canAccessMockTestItem(userId: string, isFree: boolean): Promise<boolean> {
  if (isFree) return true;
  const access = await getUserAccess(userId);
  if (!access) return false;
  return access.isRegistrarActive;
}

// ─── Pricing visibility rules ─────────────────────────────────────────────────

export type PlanId =
  | "free_plan"
  | "registrar_6mo"
  | "registrar_12mo"
  | "fellowship_monthly"
  | "fellowship_yearly"
  | "post_registrar_upgrade";

/**
 * Returns the ordered list of plan IDs a user is allowed to see on the
 * pricing page, enforcing the strict visibility matrix:
 *
 * 1. REGISTRAR Users (training_stage === 'REGISTRAR'):
 *    - Default (has_purchased=false): ['registrar_6mo', 'registrar_12mo']
 *    - Unlocked Loyalty (has_purchased=true): ['post_registrar_upgrade', 'registrar_6mo', 'registrar_12mo']
 *    - NEVER SHOW: $30/mo or $300/yr Fellowship plans.
 *
 * 2. FELLOW Users (training_stage === 'FELLOW'):
 *    - Default (has_purchased=false): ['fellowship_monthly', 'fellowship_yearly']
 *    - Unlocked Loyalty (has_purchased=true): ['post_registrar_upgrade', 'fellowship_monthly', 'fellowship_yearly']
 *    - NEVER SHOW: $1,500 or $2,500 Registrar plans.
 */
export function getVisiblePlans(
  userRole: UserRole,
  hasPurchasedRegistrar: boolean,
  trainingStage: TrainingStage = "REGISTRAR"
): PlanId[] {
  const isFellow =
    String(trainingStage ?? "").toUpperCase() === "FELLOW" ||
    String(userRole ?? "").toUpperCase() === "FELLOW";

  if (isFellow) {
    if (hasPurchasedRegistrar) {
      // Loyalty Fellow: Show $15/mo Loyalty Upgrade + $300/yr Annual. Hide standard $30/mo!
      return ["post_registrar_upgrade", "fellowship_yearly"];
    }
    // Standard Fellow: Show $30/mo + $300/yr
    return ["fellowship_monthly", "fellowship_yearly"];
  }

  // REGISTRAR user
  if (hasPurchasedRegistrar) {
    return ["post_registrar_upgrade", "registrar_6mo", "registrar_12mo"];
  }
  return ["registrar_6mo", "registrar_12mo"];
}

/**
 * Convert full UserAccessInfo into plain JSON-serializable SerializedUserAccess
 * suitable for passing across RSC server-to-client boundary.
 */
export function serializeUserAccess(access: UserAccessInfo | null | undefined) {
  if (!access) return null;
  return {
    userId: access.userId,
    accessLevel: access.accessLevel,
    trainingStage: access.trainingStage,
    hasPaidAccess: access.hasPaidAccess,
    isRegistrarActive: access.isRegistrarActive,
    hasPurchasedRegistrar: access.hasPurchasedRegistrar,
    cancelAtPeriodEnd: access.cancelAtPeriodEnd,
    currentPeriodEnd: access.currentPeriodEnd ? access.currentPeriodEnd.toISOString() : null,
  };
}

