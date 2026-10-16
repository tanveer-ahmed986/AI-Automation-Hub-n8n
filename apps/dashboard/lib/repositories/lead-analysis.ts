import { eq } from "drizzle-orm";
import { db } from "@database/client";
import { leadAnalysis } from "@database/schema/lead-analysis";
import type { LeadAnalysis, NewLeadAnalysis } from "@database/schema/lead-analysis";

export async function insertLeadAnalysis(values: NewLeadAnalysis): Promise<LeadAnalysis> {
  const [row] = await db.insert(leadAnalysis).values(values).returning();
  if (!row) {
    throw new Error("Failed to insert lead analysis");
  }
  return row;
}

export async function getLeadAnalysisByLeadId(leadId: string): Promise<LeadAnalysis | null> {
  const rows = await db.select().from(leadAnalysis).where(eq(leadAnalysis.leadId, leadId)).limit(1);
  return rows[0] ?? null;
}
