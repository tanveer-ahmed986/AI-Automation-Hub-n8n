import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { draftApproveRequestSchema } from "@automation-hub/schemas";
import { evaluateApproval } from "@automation-hub/business-rules";
import { getFollowUpByDraftId, markFollowUpApproved } from "@/lib/repositories/follow-up";
import { updateLeadStatus } from "@/lib/repositories/lead";
import { approveDraft, getLatestReplyDraftForLead, getReplyDraftById } from "@/lib/repositories/reply-draft";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id: draftId } = await params;

  const body = await request.json().catch(() => null);
  const parsed = draftApproveRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const draft = await getReplyDraftById(draftId);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // The lead's current latest version — not necessarily this draft row —
  // is what decides staleness (FR-017/FR-018).
  const latest = await getLatestReplyDraftForLead(draft.leadId);
  const latestVersion = latest?.version ?? draft.version;

  const outcome = evaluateApproval(
    { id: draft.id, leadId: draft.leadId, version: draft.version, status: draft.status },
    parsed.data.draftVersion,
    latestVersion,
  );

  // Every outcome here — including a stale/duplicate rejection — is the
  // system behaving correctly, not a failure (FR-023); it is logged as a
  // successful workflow outcome with the outcome recorded in metadata.
  if (outcome !== "approved") {
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "approval",
      status: "success",
      safeMetadata: { draftId: draft.id, requestedVersion: parsed.data.draftVersion, outcome },
    });
    return NextResponse.json({ result: outcome });
  }

  const updated = await approveDraft({ id: draft.id, reviewerIdentity: parsed.data.reviewerIdentity ?? null });
  await updateLeadStatus(updated.leadId, "approved");

  // If this draft is a follow-up's reviewable version, approving it
  // advances that attempt's own status in lockstep (US3).
  const linkedFollowUp = await getFollowUpByDraftId(draft.id);
  if (linkedFollowUp) {
    await markFollowUpApproved(linkedFollowUp.id);
  }
  await insertWorkflowEvent({
    leadId: draft.leadId,
    workflowName: "wf-02-approval-email",
    eventType: "approval",
    status: "success",
    safeMetadata: { draftId: draft.id, version: draft.version, outcome: "approved" },
  });

  return NextResponse.json({ result: "approved" });
}
