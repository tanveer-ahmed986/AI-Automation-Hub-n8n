import { and, desc, eq } from "drizzle-orm";
import { db } from "@database/client";
import { followUp } from "@database/schema/follow-up";
import { lead } from "@database/schema/lead";
import type { Lead } from "@database/schema/lead";
import { replyDraft } from "@database/schema/reply-draft";
import type { NewReplyDraft, ReplyDraft } from "@database/schema/reply-draft";

export async function insertReplyDraft(values: NewReplyDraft): Promise<ReplyDraft> {
  const [row] = await db.insert(replyDraft).values(values).returning();
  if (!row) {
    throw new Error("Failed to insert reply draft");
  }
  return row;
}

export async function getLatestReplyDraftForLead(leadId: string): Promise<ReplyDraft | null> {
  const rows = await db
    .select()
    .from(replyDraft)
    .where(eq(replyDraft.leadId, leadId))
    .orderBy(desc(replyDraft.version))
    .limit(1);
  return rows[0] ?? null;
}

export async function getReplyDraftById(id: string): Promise<ReplyDraft | null> {
  const rows = await db.select().from(replyDraft).where(eq(replyDraft.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function countReplyDraftsByStatus(status: ReplyDraft["status"]): Promise<number> {
  const rows = await db.select().from(replyDraft).where(eq(replyDraft.status, status));
  return rows.length;
}

export interface PendingApprovalDraft {
  draft: ReplyDraft;
  lead: Lead;
  /** Set when this draft is a follow-up's reviewable version, not the original reply (US3). */
  followUpAttemptNumber: number | null;
}

/** Backs the Approval Queue UI (T046/T053) — every draft still awaiting a reviewer decision. */
export async function listPendingApprovalDrafts(): Promise<PendingApprovalDraft[]> {
  const rows = await db
    .select({ draft: replyDraft, lead, followUpAttemptNumber: followUp.attemptNumber })
    .from(replyDraft)
    .innerJoin(lead, eq(lead.id, replyDraft.leadId))
    .leftJoin(followUp, eq(followUp.draftId, replyDraft.id))
    .where(eq(replyDraft.status, "pending_approval"))
    .orderBy(desc(replyDraft.createdAt));
  return rows.map((row) => ({ ...row, followUpAttemptNumber: row.followUpAttemptNumber ?? null }));
}

/**
 * Edit-and-approve's first step (FR-018): creates a new version row and,
 * in the same transaction, moves whatever was previously the lead's
 * latest non-terminal version out of `pending_approval`/`approved` into
 * `rejected` — it never mutates the prior version's own row otherwise,
 * preserving the audit trail (FR-020).
 */
export async function createEditedDraftVersion(params: {
  leadId: string;
  subject: string;
  body: string;
}): Promise<ReplyDraft> {
  return db.transaction(async (tx) => {
    const [latest] = await tx
      .select()
      .from(replyDraft)
      .where(eq(replyDraft.leadId, params.leadId))
      .orderBy(desc(replyDraft.version))
      .limit(1);

    if (latest && (latest.status === "pending_approval" || latest.status === "approved")) {
      await tx.update(replyDraft).set({ status: "rejected" }).where(eq(replyDraft.id, latest.id));
    }

    const [created] = await tx
      .insert(replyDraft)
      .values({
        leadId: params.leadId,
        version: (latest?.version ?? 0) + 1,
        subject: params.subject,
        body: params.body,
        status: "pending_approval",
      })
      .returning();
    if (!created) {
      throw new Error("Failed to create edited draft version");
    }
    return created;
  });
}

export async function approveDraft(params: {
  id: string;
  reviewerIdentity?: string | null;
}): Promise<ReplyDraft> {
  const [row] = await db
    .update(replyDraft)
    .set({ status: "approved", approvedBy: params.reviewerIdentity ?? null, approvedAt: new Date() })
    .where(eq(replyDraft.id, params.id))
    .returning();
  if (!row) {
    throw new Error(`Failed to approve draft ${params.id}`);
  }
  return row;
}

/** Terminal (FR-019) — a rejected draft can never transition anywhere else. */
export async function rejectDraft(id: string): Promise<ReplyDraft> {
  const [row] = await db.update(replyDraft).set({ status: "rejected" }).where(eq(replyDraft.id, id)).returning();
  if (!row) {
    throw new Error(`Failed to reject draft ${id}`);
  }
  return row;
}

/**
 * Atomic claim: only succeeds if this row is still `approved` at the
 * moment of the update. Returns `null` (not an error) when a concurrent
 * call already won the race — the caller reports `already_sent` rather
 * than attempting a second send (FR-023).
 */
export async function markDraftSent(id: string): Promise<ReplyDraft | null> {
  const [row] = await db
    .update(replyDraft)
    .set({ status: "sent", sentAt: new Date() })
    .where(and(eq(replyDraft.id, id), eq(replyDraft.status, "approved")))
    .returning();
  return row ?? null;
}
