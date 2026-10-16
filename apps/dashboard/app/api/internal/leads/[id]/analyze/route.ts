import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { leadAnalysisResultSchema } from "@automation-hub/schemas";
import { getAiAdapter } from "@/lib/ai-adapter-factory";
import { getBusinessProfile } from "@/lib/repositories/business-profile";
import { getLeadById } from "@/lib/repositories/lead";
import { insertLeadAnalysis } from "@/lib/repositories/lead-analysis";
import { insertReplyDraft } from "@/lib/repositories/reply-draft";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: leadId } = await params;

  const lead = await getLeadById(leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  // Fail closed to manual review rather than draft with fabricated
  // business details (data-model.md's BusinessProfile validation rule,
  // FR-013a).
  const profile = await getBusinessProfile();
  if (!profile) {
    await insertWorkflowEvent({
      leadId,
      workflowName: "wf-01-lead-intake",
      eventType: "analysis",
      status: "failed",
      classification: "unexpected",
      safeMetadata: { reason: "business_profile_missing" },
    });
    return NextResponse.json({ leadId, analysisStatus: "failed_manual_review" });
  }

  let rawResult: unknown;
  try {
    const adapter = getAiAdapter();
    rawResult = await adapter.analyze({
      name: lead.name,
      message: lead.message,
      service: lead.service,
      budget: lead.budgetOriginal,
      timeline: lead.timeline,
    });
  } catch (error) {
    await insertWorkflowEvent({
      leadId,
      workflowName: "wf-01-lead-intake",
      eventType: "analysis",
      status: "failed",
      classification: "ai_provider",
      safeMetadata: { reason: error instanceof Error ? error.message : "ai_adapter_threw" },
    });
    return NextResponse.json({ leadId, analysisStatus: "failed_manual_review" });
  }

  // Validated identically regardless of which adapter produced it
  // (research.md §5) — malformed/out-of-range output fails closed, never
  // silently accepted (constitution Principle II, FR-009).
  const parsed = leadAnalysisResultSchema.safeParse(rawResult);
  if (!parsed.success) {
    await insertWorkflowEvent({
      leadId,
      workflowName: "wf-01-lead-intake",
      eventType: "analysis",
      status: "failed",
      classification: "ai_provider",
      safeMetadata: { reason: "schema_validation_failed", issues: parsed.error.issues.length },
    });
    return NextResponse.json({ leadId, analysisStatus: "failed_manual_review" });
  }

  const analysis = parsed.data;

  const analysisRow = await insertLeadAnalysis({
    leadId,
    modelProvider: "mock",
    modelName: null,
    category: analysis.category,
    intent: analysis.intent,
    urgency: analysis.urgency,
    budgetBand: analysis.budget_band,
    leadScore: analysis.lead_score,
    scoreFactors: analysis.score_factors,
    missingInformation: analysis.missing_information,
    recommendedNextAction: analysis.recommended_next_action,
    summary: analysis.summary,
  });

  const draft = await insertReplyDraft({
    leadId,
    version: 1,
    subject: analysis.draft_reply.subject,
    body: analysis.draft_reply.body,
    status: "pending_approval",
  });

  await insertWorkflowEvent({
    leadId,
    workflowName: "wf-01-lead-intake",
    eventType: "analysis",
    status: "success",
    safeMetadata: { analysisId: analysisRow.id, draftId: draft.id },
  });

  return NextResponse.json({
    leadId,
    analysisStatus: "completed",
    analysis,
    draftId: draft.id,
  });
}
