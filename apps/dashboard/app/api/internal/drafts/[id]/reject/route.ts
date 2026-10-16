import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { draftApproveRequestSchema } from "@automation-hub/schemas";
import { evaluateRejection } from "@automation-hub/business-rules";
import { getFollowUpByDraftId, markFollowUpCancelled } from "@/lib/repositories/follow-up";
import { getLatestReplyDraftForLead, getReplyDraftById, rejectDraft } from "@/lib/repositories/reply-draft";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

/**
 * Sibling to `/drafts/{id}/approve`, not in the OpenAPI doc verbatim —
 * contracts/n8n-webhooks.md explicitly leaves the reject path as an
 * implementation-time choice between folding it into `/approve`'s result
 * enum or a dedicated endpoint; a dedicated endpoint keeps `/approve`'s
 * response matching the committed `draftApproveResponseSchema` exactly
 * (`approved | stale_version_rejected | already_sent`, no `rejected`
 * member) while still reusing the same request shape and the same
 * version-staleness rule (FR-017/FR-019).
 */
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

  const latest = await getLatestReplyDraftForLead(draft.leadId);
  const latestVersion = latest?.version ?? draft.version;

  const outcome = evaluateRejection(
    { id: draft.id, leadId: draft.leadId, version: draft.version, status: draft.status },
    parsed.data.draftVersion,
    latestVersion,
  );

  if (outcome !== "rejected") {
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "approval",
      status: "success",
      safeMetadata: { draftId: draft.id, requestedVersion: parsed.data.draftVersion, outcome },
    });
    return NextResponse.json({ result: outcome });
  }

  await rejectDraft(draft.id);

  // If this draft was a follow-up's reviewable version, rejecting it
  // cancels that attempt too (US3) — it is never sent, and no later
  // attempt is scheduled from a rejected one.
  const linkedFollowUp = await getFollowUpByDraftId(draft.id);
  if (linkedFollowUp) {
    await markFollowUpCancelled(linkedFollowUp.id);
  }

  await insertWorkflowEvent({
    leadId: draft.leadId,
    workflowName: "wf-02-approval-email",
    eventType: "approval",
    status: "success",
    safeMetadata: { draftId: draft.id, version: draft.version, outcome: "rejected" },
  });

  return NextResponse.json({ result: "rejected" });
}
