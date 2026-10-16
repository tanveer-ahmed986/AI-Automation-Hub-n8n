import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { followUp } from "@database/schema/follow-up";
import type { FollowUp, NewFollowUp } from "@database/schema/follow-up";
import { lead } from "@database/schema/lead";
import type { Lead } from "@database/schema/lead";

export interface FollowUpWithLead {
  followUp: FollowUp;
  lead: Lead;
}

export async function getFollowUpByDraftId(draftId: string): Promise<FollowUp | null> {
  const rows = await db.select().from(followUp).where(eq(followUp.draftId, draftId)).limit(1);
  return rows[0] ?? null;
}

export async function insertScheduledFollowUp(params: {
  leadId: string;
  attemptNumber: number;
  scheduledAt: Date;
}): Promise<FollowUp> {
  const values: NewFollowUp = {
    leadId: params.leadId,
    attemptNumber: params.attemptNumber,
    scheduledAt: params.scheduledAt,
    status: "scheduled",
  };
  const [row] = await db.insert(followUp).values(values).returning();
  if (!row) {
    throw new Error("Failed to insert scheduled follow-up");
  }
  return row;
}

/** Every non-terminal follow-up, joined with its lead — backs both the due-scan and the cancellation sweep. */
export async function listNonTerminalFollowUpsWithLead(): Promise<FollowUpWithLead[]> {
  const rows = await db
    .select({ followUp, lead })
    .from(followUp)
    .innerJoin(lead, eq(lead.id, followUp.leadId))
    .where(
      // scheduled | pending_approval | approved — anything not yet sent or cancelled.
      eq(followUp.status, "scheduled"),
    );
  const pendingApproval = await db
    .select({ followUp, lead })
    .from(followUp)
    .innerJoin(lead, eq(lead.id, followUp.leadId))
    .where(eq(followUp.status, "pending_approval"));
  const approved = await db
    .select({ followUp, lead })
    .from(followUp)
    .innerJoin(lead, eq(lead.id, followUp.leadId))
    .where(eq(followUp.status, "approved"));
  return [...rows, ...pendingApproval, ...approved];
}

export async function markFollowUpPendingApproval(id: string, draftId: string): Promise<FollowUp> {
  const [row] = await db
    .update(followUp)
    .set({ status: "pending_approval", draftId })
    .where(eq(followUp.id, id))
    .returning();
  if (!row) {
    throw new Error(`Failed to update follow-up ${id}`);
  }
  return row;
}

export async function markFollowUpApproved(id: string): Promise<FollowUp> {
  const [row] = await db.update(followUp).set({ status: "approved" }).where(eq(followUp.id, id)).returning();
  if (!row) {
    throw new Error(`Failed to approve follow-up ${id}`);
  }
  return row;
}

export async function markFollowUpSent(id: string): Promise<FollowUp> {
  const [row] = await db
    .update(followUp)
    .set({ status: "sent", sentAt: new Date() })
    .where(eq(followUp.id, id))
    .returning();
  if (!row) {
    throw new Error(`Failed to mark follow-up ${id} sent`);
  }
  return row;
}

/** Terminal (FR-027) — cancels regardless of which non-terminal state it was in. */
export async function markFollowUpCancelled(id: string): Promise<FollowUp> {
  const [row] = await db
    .update(followUp)
    .set({ status: "cancelled", cancelledAt: new Date() })
    .where(eq(followUp.id, id))
    .returning();
  if (!row) {
    throw new Error(`Failed to cancel follow-up ${id}`);
  }
  return row;
}
