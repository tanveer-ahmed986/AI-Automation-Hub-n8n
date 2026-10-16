import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { buildFollowUpMessage, evaluateFollowUpDue, isFollowUpCancellable } from "@automation-hub/business-rules";
import type { FollowUpEligible } from "@automation-hub/schemas";
import { getBusinessProfile } from "@/lib/repositories/business-profile";
import {
  listNonTerminalFollowUpsWithLead,
  markFollowUpCancelled,
  markFollowUpPendingApproval,
} from "@/lib/repositories/follow-up";
import { getLatestReplyDraftForLead, insertReplyDraft } from "@/lib/repositories/reply-draft";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

/**
 * Called by WF-03's Schedule Trigger (research.md §4). `asOf` is a
 * test-only override (ISO 8601) so the integration suite can simulate the
 * configured delay elapsing without a real wait — n8n's Schedule Trigger
 * never sends it, so production behavior always uses the real clock.
 */
export async function GET(request: NextRequest) {
  const asOfParam = request.nextUrl.searchParams.get("asOf");
  const now = asOfParam ? new Date(asOfParam) : new Date();

  const nonTerminal = await listNonTerminalFollowUpsWithLead();

  // Cancellation sweep first (FR-027) — a reply, closed status, or
  // opt-out always wins over a follow-up that would otherwise be due.
  const cancelledIds = new Set<string>();
  for (const { followUp, lead } of nonTerminal) {
    if (isFollowUpCancellable(lead.status, followUp.status)) {
      await markFollowUpCancelled(followUp.id);
      cancelledIds.add(followUp.id);
      await insertWorkflowEvent({
        leadId: lead.id,
        workflowName: "wf-03-follow-up-scheduler",
        eventType: "follow_up",
        status: "success",
        safeMetadata: { followUpId: followUp.id, attemptNumber: followUp.attemptNumber, outcome: "cancelled" },
      });
    }
  }

  const profile = await getBusinessProfile();
  const eligible: FollowUpEligible[] = [];

  for (const { followUp, lead } of nonTerminal) {
    if (followUp.status !== "scheduled" || cancelledIds.has(followUp.id)) continue; // already cancelled above, or mid-review
    const due = evaluateFollowUpDue({
      followUpStatus: followUp.status,
      scheduledAt: followUp.scheduledAt,
      now,
      leadStatus: lead.status,
    });
    if (!due.due) continue;

    if (!profile) {
      // Fail closed (data-model.md's BusinessProfile rule, FR-013a) —
      // never fabricate a signature/business name.
      await insertWorkflowEvent({
        leadId: lead.id,
        workflowName: "wf-03-follow-up-scheduler",
        eventType: "follow_up",
        status: "failed",
        classification: "unexpected",
        safeMetadata: { followUpId: followUp.id, reason: "business_profile_missing" },
      });
      continue;
    }

    const latestDraft = await getLatestReplyDraftForLead(lead.id);
    const originalSubject = latestDraft?.subject ?? `Re: your inquiry`;
    const message = buildFollowUpMessage({
      leadName: lead.name,
      originalSubject,
      attemptNumber: followUp.attemptNumber,
      businessName: profile.businessName,
      signature: profile.signature,
    });

    const nextVersion = (latestDraft?.version ?? 0) + 1;
    const draft = await insertReplyDraft({
      leadId: lead.id,
      version: nextVersion,
      subject: message.subject,
      body: message.body,
      status: "pending_approval",
    });

    await markFollowUpPendingApproval(followUp.id, draft.id);
    await insertWorkflowEvent({
      leadId: lead.id,
      workflowName: "wf-03-follow-up-scheduler",
      eventType: "follow_up",
      status: "success",
      safeMetadata: { followUpId: followUp.id, attemptNumber: followUp.attemptNumber, draftId: draft.id },
    });

    eligible.push({
      followUpId: followUp.id,
      leadId: lead.id,
      attemptNumber: followUp.attemptNumber,
      draftId: draft.id,
    });
  }

  return NextResponse.json(eligible);
}
