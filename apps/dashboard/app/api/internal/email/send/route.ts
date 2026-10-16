import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { emailSendRequestSchema } from "@automation-hub/schemas";
import { evaluateNextFollowUpSchedule } from "@automation-hub/business-rules";
import { getFollowupDelayHours, getFollowupMaxAttempts, isMockEmail } from "@/lib/config";
import { getEmailAdapter } from "@/lib/email-adapter-factory";
import { getFollowUpByDraftId, insertScheduledFollowUp, markFollowUpSent } from "@/lib/repositories/follow-up";
import { getLeadById, updateLeadStatus } from "@/lib/repositories/lead";
import { getReplyDraftById, markDraftSent } from "@/lib/repositories/reply-draft";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const parsed = emailSendRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body." }, { status: 400 });
  }

  const draft = await getReplyDraftById(parsed.data.draftId);
  if (!draft) {
    return NextResponse.json({ error: "Draft not found" }, { status: 404 });
  }

  // Idempotent no-ops (FR-023) — the system behaving correctly by
  // refusing a second send, not a failure.
  if (draft.status === "sent") {
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "delivery",
      status: "success",
      safeMetadata: { draftId: draft.id, outcome: "already_sent" },
    });
    return NextResponse.json({ status: "already_sent", mock: isMockEmail(), providerResponseSafe: null });
  }
  if (draft.status !== "approved" || draft.version !== parsed.data.draftVersion) {
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "delivery",
      status: "success",
      safeMetadata: { draftId: draft.id, outcome: "rejected_stale_version" },
    });
    return NextResponse.json({ status: "rejected_stale_version", mock: isMockEmail(), providerResponseSafe: null });
  }

  const lead = await getLeadById(draft.leadId);
  if (!lead) {
    return NextResponse.json({ error: "Lead not found" }, { status: 404 });
  }

  let sendResult;
  try {
    const adapter = getEmailAdapter();
    sendResult = await adapter.send({ to: lead.emailNormalized, subject: draft.subject, body: draft.body });
  } catch (error) {
    // Left as `approved` (not claimed) — safe for n8n's own HTTP-node
    // retry-with-backoff to call this route again (FR-025); never
    // reaches here having already recorded `sent`.
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "delivery",
      status: "failed",
      classification: "email_delivery",
      safeMetadata: { draftId: draft.id, reason: error instanceof Error ? error.message : "email_adapter_threw" },
    });
    return NextResponse.json({ error: "Email delivery failed." }, { status: 502 });
  }

  // Atomic claim — only the first caller to reach here for this draft
  // transitions it to `sent`; a concurrent duplicate gets `already_sent`
  // instead of reporting a second send (FR-023).
  const sentRow = await markDraftSent(draft.id);
  if (!sentRow) {
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "delivery",
      status: "success",
      safeMetadata: { draftId: draft.id, outcome: "already_sent" },
    });
    return NextResponse.json({ status: "already_sent", mock: isMockEmail(), providerResponseSafe: null });
  }

  await updateLeadStatus(draft.leadId, "sent");
  await insertWorkflowEvent({
    leadId: draft.leadId,
    workflowName: "wf-02-approval-email",
    eventType: "delivery",
    status: "success",
    safeMetadata: { draftId: draft.id, provider: sendResult.provider, mock: sendResult.mock },
  });

  // This send may itself have been a follow-up attempt — if so, close
  // that attempt's own row out, then decide (FR-026/FR-028) whether a
  // further attempt should be scheduled (US3).
  const linkedFollowUp = await getFollowUpByDraftId(draft.id);
  if (linkedFollowUp) {
    await markFollowUpSent(linkedFollowUp.id);
  }
  const lastAttemptNumber = linkedFollowUp?.attemptNumber ?? 0;
  const schedule = evaluateNextFollowUpSchedule({
    consentToFollowUp: lead.consentToFollowUp,
    lastAttemptNumber,
    maxAttempts: getFollowupMaxAttempts(),
  });
  if (schedule.shouldSchedule) {
    const scheduledAt = new Date(Date.now() + getFollowupDelayHours() * 60 * 60 * 1000);
    const scheduledFollowUp = await insertScheduledFollowUp({
      leadId: draft.leadId,
      attemptNumber: schedule.nextAttemptNumber,
      scheduledAt,
    });
    await insertWorkflowEvent({
      leadId: draft.leadId,
      workflowName: "wf-02-approval-email",
      eventType: "follow_up",
      status: "success",
      safeMetadata: { followUpId: scheduledFollowUp.id, attemptNumber: schedule.nextAttemptNumber, outcome: "scheduled" },
    });
  }

  return NextResponse.json({
    status: "sent",
    mock: sendResult.mock,
    providerResponseSafe: sendResult.providerResponseSafe,
  });
}
