/**
 * lib/module-gates.ts
 *
 * Module access guard helpers based on dynamic is_free flags and user tier.
 * Replaces legacy quota decrement counters.
 */

import prisma from "@/lib/prisma";
import {
  getUserAccess,
  canAccessQuizItem,
  canAccessTemplateItem,
  canAccessMedicalLibraryItem,
  canAccessMBS,
} from "@/lib/access";

// ─── Page 1 — Exam Prep & Quizzes ──────────────────────────────────────────────

export async function consumeExamPrepQuestion(
  userId: string,
  isFreeItem: boolean = false
): Promise<{ granted: boolean }> {
  const granted = await canAccessQuizItem(userId, isFreeItem);
  return { granted };
}

// ─── Page 2 — Note Templates ──────────────────────────────────────────────────

export async function consumeTemplateAccess(
  userId: string,
  isFreeItem: boolean = false
): Promise<{ granted: boolean }> {
  const granted = await canAccessTemplateItem(userId, isFreeItem);
  return { granted };
}

// ─── Page 3 — Study / Medical Library ─────────────────────────────────────────

export async function consumeStudyTopicAccess(
  userId: string,
  isFreeItem: boolean = false
): Promise<{ granted: boolean }> {
  const granted = await canAccessMedicalLibraryItem(userId, isFreeItem);
  return { granted };
}

// ─── Page 4 — MBS Billing ─────────────────────────────────────────────────────

export async function checkMBSAccess(userId: string): Promise<{
  granted: boolean;
}> {
  const { hasFullAccess } = await canAccessMBS(userId);
  return { granted: hasFullAccess };
}

// ─── Quota forfeiture compatibility helper ──────────────────────────────────

export async function forfeitFreeQuota(userId: string, tx: any = prisma): Promise<void> {
  // Free quota counters are deprecated in favor of dynamic is_free flags.
  await tx.users.update({
    where: { id: userId },
    data: {
      free_questions_left: 0,
      free_templates_left: 0,
      free_topics_left: 0,
    },
  });
}
