import { describe, expect, it } from "vitest";
import {
  evaluateFollowUpDue,
  evaluateNextFollowUpSchedule,
  isFollowUpCancellable,
  buildFollowUpMessage,
} from "@automation-hub/business-rules";

describe("evaluateNextFollowUpSchedule (FR-026, FR-028)", () => {
  it("never schedules a follow-up without explicit consent", () => {
    expect(evaluateNextFollowUpSchedule({ consentToFollowUp: false, lastAttemptNumber: 0, maxAttempts: 2 })).toEqual(
      { shouldSchedule: false, reason: "no_consent" },
    );
  });

  it("schedules attempt 1 right after the initial reply is sent, given consent", () => {
    expect(evaluateNextFollowUpSchedule({ consentToFollowUp: true, lastAttemptNumber: 0, maxAttempts: 2 })).toEqual({
      shouldSchedule: true,
      nextAttemptNumber: 1,
    });
  });

  it("schedules attempt 2 after attempt 1 has sent, while under the configured max", () => {
    expect(evaluateNextFollowUpSchedule({ consentToFollowUp: true, lastAttemptNumber: 1, maxAttempts: 2 })).toEqual({
      shouldSchedule: true,
      nextAttemptNumber: 2,
    });
  });

  it("never schedules past the configured maximum number of attempts (FR-028)", () => {
    expect(evaluateNextFollowUpSchedule({ consentToFollowUp: true, lastAttemptNumber: 2, maxAttempts: 2 })).toEqual({
      shouldSchedule: false,
      reason: "max_attempts_reached",
    });
  });
});

describe("evaluateFollowUpDue", () => {
  const now = new Date("2026-01-10T00:00:00.000Z");

  it("is not due while still in a non-scheduled state", () => {
    expect(
      evaluateFollowUpDue({ followUpStatus: "pending_approval", scheduledAt: new Date("2026-01-01"), now, leadStatus: "sent" }),
    ).toEqual({ due: false, reason: "not_scheduled_state" });
  });

  it("is not due before the configured delay has elapsed", () => {
    expect(
      evaluateFollowUpDue({ followUpStatus: "scheduled", scheduledAt: new Date("2026-02-01"), now, leadStatus: "sent" }),
    ).toEqual({ due: false, reason: "delay_not_elapsed" });
  });

  it("is no longer eligible once the lead has closed (reply or opt-out, FR-027)", () => {
    expect(
      evaluateFollowUpDue({ followUpStatus: "scheduled", scheduledAt: new Date("2026-01-01"), now, leadStatus: "closed" }),
    ).toEqual({ due: false, reason: "lead_no_longer_eligible" });
  });

  it("is no longer eligible if the lead was reclassified as spam", () => {
    expect(
      evaluateFollowUpDue({ followUpStatus: "scheduled", scheduledAt: new Date("2026-01-01"), now, leadStatus: "spam" }),
    ).toEqual({ due: false, reason: "lead_no_longer_eligible" });
  });

  it("is due once scheduled, delay elapsed, and the lead is still awaiting a reply", () => {
    expect(
      evaluateFollowUpDue({ followUpStatus: "scheduled", scheduledAt: new Date("2026-01-01"), now, leadStatus: "sent" }),
    ).toEqual({ due: true });
  });
});

describe("isFollowUpCancellable (FR-027)", () => {
  it("cancels a scheduled follow-up once the lead closes", () => {
    expect(isFollowUpCancellable("closed", "scheduled")).toBe(true);
  });

  it("cancels a pending-approval follow-up once the lead closes", () => {
    expect(isFollowUpCancellable("closed", "pending_approval")).toBe(true);
  });

  it("cancels an approved-but-not-yet-sent follow-up once the lead opts out", () => {
    expect(isFollowUpCancellable("closed", "approved")).toBe(true);
  });

  it("never recalls a follow-up that has already sent, even if the lead later closes", () => {
    expect(isFollowUpCancellable("closed", "sent")).toBe(false);
  });

  it("leaves a follow-up alone while the lead is still awaiting a reply", () => {
    expect(isFollowUpCancellable("sent", "scheduled")).toBe(false);
  });
});

describe("buildFollowUpMessage", () => {
  it("never fabricates business details — only uses the supplied business profile fields", () => {
    const message = buildFollowUpMessage({
      leadName: "Grace Hopper",
      originalSubject: "Re: your website project",
      attemptNumber: 1,
      businessName: "Z&T Web Studio",
      signature: "The Z&T Team",
    });
    expect(message.subject).toContain("your website project");
    expect(message.body).toContain("Grace Hopper");
    expect(message.body).toContain("The Z&T Team");
  });

  it("is deterministic for the same input", () => {
    const input = {
      leadName: "Grace Hopper",
      originalSubject: "Re: your website project",
      attemptNumber: 1,
      businessName: "Z&T Web Studio",
      signature: "The Z&T Team",
    };
    expect(buildFollowUpMessage(input)).toEqual(buildFollowUpMessage(input));
  });
});
