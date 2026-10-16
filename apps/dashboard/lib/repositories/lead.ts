import { and, desc, eq, gte } from "drizzle-orm";
import { db } from "@database/client";
import { lead } from "@database/schema/lead";
import type { Lead, NewLead } from "@database/schema/lead";
import { leadAnalysis } from "@database/schema/lead-analysis";

export async function listLeads(): Promise<Lead[]> {
  return db.select().from(lead).orderBy(desc(lead.createdAt));
}

export interface LeadWithAnalysis {
  lead: Lead;
  analysis: {
    category: string;
    leadScore: number;
    urgency: string;
  } | null;
}

export async function listLeadsWithAnalysis(): Promise<LeadWithAnalysis[]> {
  const rows = await db
    .select({
      lead,
      category: leadAnalysis.category,
      leadScore: leadAnalysis.leadScore,
      urgency: leadAnalysis.urgency,
    })
    .from(lead)
    .leftJoin(leadAnalysis, eq(leadAnalysis.leadId, lead.id))
    .orderBy(desc(lead.createdAt));

  return rows.map((row) => ({
    lead: row.lead,
    analysis:
      row.category && row.leadScore !== null && row.urgency
        ? { category: row.category, leadScore: row.leadScore, urgency: row.urgency }
        : null,
  }));
}

export async function countLeads(): Promise<number> {
  const rows = await db.select().from(lead);
  return rows.length;
}

export async function insertLead(values: NewLead): Promise<Lead> {
  const [row] = await db.insert(lead).values(values).returning();
  if (!row) {
    throw new Error("Failed to insert lead");
  }
  return row;
}

export async function findLeadByIdempotencyKey(idempotencyKey: string): Promise<Lead | null> {
  const rows = await db.select().from(lead).where(eq(lead.idempotencyKey, idempotencyKey)).limit(1);
  return rows[0] ?? null;
}

/**
 * Indexed range query backing the fallback dedup rule (`lead_dedup_idx`
 * on `(email_normalized, message_fingerprint, created_at)`) — returns
 * the candidate set for `findDedupMatch` (packages/business-rules) to
 * make the final decision, per FR-005.
 */
export async function findDedupCandidates(
  emailNormalized: string,
  messageFingerprint: string,
  windowStart: Date,
): Promise<Lead[]> {
  return db
    .select()
    .from(lead)
    .where(
      and(
        eq(lead.emailNormalized, emailNormalized),
        eq(lead.messageFingerprint, messageFingerprint),
        gte(lead.createdAt, windowStart),
      ),
    );
}

export async function getLeadById(id: string): Promise<Lead | null> {
  const rows = await db.select().from(lead).where(eq(lead.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateLeadStatus(id: string, status: Lead["status"]): Promise<Lead> {
  const [row] = await db
    .update(lead)
    .set({ status, updatedAt: new Date() })
    .where(eq(lead.id, id))
    .returning();
  if (!row) {
    throw new Error(`Failed to update lead ${id}`);
  }
  return row;
}
