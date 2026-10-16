// Pure follow-up eligibility rules (US3, FR-026–FR-030). No I/O — callers
// (the /followups/due route and the post-send scheduling step in
// /email/send) supply already-loaded state and persist the outcome.

export type LeadStatusForFollowUp = "pending_review" | "approved" | "sent" | "closed" | "spam";
export type FollowUpStatus = "scheduled" | "pending_approval" | "approved" | "sent" | "cancelled";

export interface ScheduleNextFollowUpInput {
  consentToFollowUp: boolean;
  /** 0 when the send being evaluated was the initial reply, not a follow-up. */
  lastAttemptNumber: number;
  maxAttempts: number;
}

export type ScheduleNextFollowUpOutcome =
  | { shouldSchedule: true; nextAttemptNumber: number }
  | { shouldSchedule: false; reason: "no_consent" | "max_attempts_reached" };

/**
 * Called right after any successful send (initial reply or a prior
 * follow-up) to decide whether, and at which attempt number, the next
 * follow-up should be scheduled (FR-026, FR-028).
 */
export function evaluateNextFollowUpSchedule(input: ScheduleNextFollowUpInput): ScheduleNextFollowUpOutcome {
  if (!input.consentToFollowUp) {
    return { shouldSchedule: false, reason: "no_consent" };
  }
  const nextAttemptNumber = input.lastAttemptNumber + 1;
  if (nextAttemptNumber > input.maxAttempts) {
    return { shouldSchedule: false, reason: "max_attempts_reached" };
  }
  return { shouldSchedule: true, nextAttemptNumber };
}

export interface FollowUpDueInput {
  followUpStatus: FollowUpStatus;
  scheduledAt: Date;
  now: Date;
  leadStatus: LeadStatusForFollowUp;
}

export type FollowUpDueOutcome =
  | { due: true }
  | { due: false; reason: "not_scheduled_state" | "delay_not_elapsed" | "lead_no_longer_eligible" };

/** Decides whether a `scheduled` follow-up is ready to become a reviewable draft (WF-03 step). */
export function evaluateFollowUpDue(input: FollowUpDueInput): FollowUpDueOutcome {
  if (input.followUpStatus !== "scheduled") {
    return { due: false, reason: "not_scheduled_state" };
  }
  if (input.leadStatus === "closed" || input.leadStatus === "spam") {
    return { due: false, reason: "lead_no_longer_eligible" };
  }
  if (input.scheduledAt.getTime() > input.now.getTime()) {
    return { due: false, reason: "delay_not_elapsed" };
  }
  return { due: true };
}

/**
 * A reply, closed status, or opt-out always surfaces as `leadStatus`
 * becoming `closed` (or `spam`) — this is the single check behind FR-027.
 * A follow-up that has already sent is never retroactively recalled.
 */
export function isFollowUpCancellable(leadStatus: LeadStatusForFollowUp, followUpStatus: FollowUpStatus): boolean {
  const nonTerminal =
    followUpStatus === "scheduled" || followUpStatus === "pending_approval" || followUpStatus === "approved";
  return nonTerminal && (leadStatus === "closed" || leadStatus === "spam");
}

export interface BuildFollowUpMessageInput {
  leadName: string;
  originalSubject: string;
  attemptNumber: number;
  businessName: string;
  signature: string;
}

/**
 * Deterministic follow-up content — a templated nudge, never a fabricated
 * claim (FR-014's honesty principle extends here): no new price, offer, or
 * availability promise beyond what the signature/business name convey.
 */
export function buildFollowUpMessage(input: BuildFollowUpMessageInput): { subject: string; body: string } {
  const subject = input.originalSubject.toLowerCase().startsWith("following up")
    ? input.originalSubject
    : `Following up: ${input.originalSubject}`;
  const body = [
    `Hi ${input.leadName},`,
    "",
    `Just following up on our previous message from ${input.businessName} — we'd still love to help. Let us know if you have any questions or if now isn't the right time.`,
    "",
    "Best,",
    input.signature,
  ].join("\n");
  return { subject, body };
}
