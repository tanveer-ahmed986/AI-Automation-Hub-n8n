import { isFollowUpCancellable } from "@automation-hub/business-rules";
import { listNonTerminalFollowUpsWithLead, markFollowUpCancelled } from "@/lib/repositories/follow-up";
import { updateLeadStatus } from "@/lib/repositories/lead";
import { insertWorkflowEvent } from "@/lib/repositories/workflow-event";

/**
 * Shared by the internal API route (called by the integration suite over
 * plain HTTP) and the dashboard's own server action (called in-process,
 * same pattern as Settings) — this demo has no inbound-reply-detection
 * channel, so a reply/opt-out/manual close is always recorded here by a
 * human, which is what FR-027 actually keys cancellation off of.
 */
export async function closeLead(
  leadId: string,
  reason: "replied" | "opted_out" | "manual",
): Promise<{ leadId: string; status: string; cancelledFollowUpIds: string[] }> {
  const updated = await updateLeadStatus(leadId, "closed");

  const nonTerminal = await listNonTerminalFollowUpsWithLead();
  const cancelledFollowUpIds: string[] = [];
  for (const { followUp, lead } of nonTerminal) {
    if (lead.id === leadId && isFollowUpCancellable(updated.status, followUp.status)) {
      await markFollowUpCancelled(followUp.id);
      cancelledFollowUpIds.push(followUp.id);
    }
  }

  await insertWorkflowEvent({
    leadId,
    workflowName: "dashboard",
    eventType: "follow_up",
    status: "success",
    safeMetadata: { action: "lead_closed", reason, cancelledFollowUpIds },
  });

  return { leadId, status: updated.status, cancelledFollowUpIds };
}
