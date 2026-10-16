import { beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.DASHBOARD_BASE_URL ?? "http://localhost:3100";
const SECRET = process.env.INTERNAL_API_SECRET ?? "test-secret-value-for-dev-run";

function headers() {
  return { "Content-Type": "application/json", "X-Internal-Api-Secret": SECRET };
}

async function call(path: string, body?: unknown, method: "GET" | "POST" = "POST") {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function createPendingDraft(message: string, consentToFollowUp: boolean) {
  const unique = `follow-up-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const intake = await call("/api/internal/leads/intake", {
    name: "Follow-up Subject",
    email: unique,
    message,
    consent_to_follow_up: consentToFollowUp,
  });
  expect(intake.status).toBe(200);
  const leadId: string = intake.json.leadId;

  const analyzed = await call(`/api/internal/leads/${leadId}/analyze`);
  expect(analyzed.status).toBe(200);
  expect(analyzed.json.analysisStatus).toBe("completed");

  return { leadId, draftId: analyzed.json.draftId as string };
}

async function approveAndSend(draftId: string, draftVersion: number) {
  const approved = await call(`/api/internal/drafts/${draftId}/approve`, { draftVersion });
  expect(approved.json.result).toBe("approved");
  const sent = await call("/api/internal/email/send", { draftId, draftVersion });
  expect(sent.json.status).toBe("sent");
  return sent;
}

/** Comfortably past the default 48h FOLLOWUP_DELAY_HOURS for any send made "now" during this test run. */
function farFutureAsOf(hoursAhead = 50): string {
  return new Date(Date.now() + hoursAhead * 60 * 60 * 1000).toISOString();
}

async function due(asOf?: string): Promise<Array<{ followUpId: string; leadId: string; attemptNumber: number; draftId: string }>> {
  const path = asOf ? `/api/internal/followups/due?asOf=${encodeURIComponent(asOf)}` : "/api/internal/followups/due";
  const res = await call(path, undefined, "GET");
  expect(res.status).toBe(200);
  return res.json;
}

describe("follow-up scheduling (integration, requires a running dashboard + Postgres)", () => {
  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!res || !res.ok) {
      throw new Error(
        `Dashboard not reachable at ${BASE_URL}/api/health — start it before running integration tests`,
      );
    }
  });

  it("schedules a follow-up only for a consented lead, and never before the configured delay elapses", async () => {
    const { leadId, draftId } = await createPendingDraft("We'd like a quote for an app rebuild.", true);
    await approveAndSend(draftId, 1);

    // Not due immediately — the default delay (48h) hasn't elapsed.
    const notYetDue = await due();
    expect(notYetDue.find((item) => item.leadId === leadId)).toBeUndefined();

    const nowDue = await due(farFutureAsOf());
    const entry = nowDue.find((item) => item.leadId === leadId);
    expect(entry).toBeDefined();
    expect(entry?.attemptNumber).toBe(1);
  });

  it("never schedules a follow-up for a lead without explicit consent (FR-026)", async () => {
    const { leadId, draftId } = await createPendingDraft("We'd like to automate invoicing.", false);
    await approveAndSend(draftId, 1);

    const nowDue = await due(farFutureAsOf());
    expect(nowDue.find((item) => item.leadId === leadId)).toBeUndefined();
  });

  it("cancels a scheduled follow-up the moment an opt-out is recorded, before it ever sends (FR-027)", async () => {
    const { leadId, draftId } = await createPendingDraft("Interested in a chatbot for our site.", true);
    await approveAndSend(draftId, 1);

    const closeResult = await call(`/api/internal/leads/${leadId}/close`, { reason: "opted_out" });
    expect(closeResult.status).toBe(200);
    expect(closeResult.json.status).toBe("closed");
    expect(closeResult.json.cancelledFollowUpIds.length).toBeGreaterThan(0);

    const nowDue = await due(farFutureAsOf());
    expect(nowDue.find((item) => item.leadId === leadId)).toBeUndefined();
  });

  it("enforces the configured maximum attempts — no third follow-up is ever created past the cap", async () => {
    const { leadId, draftId } = await createPendingDraft("Can you help with our onboarding flow?", true);
    await approveAndSend(draftId, 1);

    // Attempt 1 becomes due and reviewable.
    const dueForAttempt1 = await due(farFutureAsOf());
    const attempt1 = dueForAttempt1.find((item) => item.leadId === leadId);
    expect(attempt1).toBeDefined();
    expect(attempt1?.attemptNumber).toBe(1);
    await approveAndSend(attempt1!.draftId, 2);

    // Attempt 2 becomes due and reviewable (default max attempts is 2).
    const dueForAttempt2 = await due(farFutureAsOf(100));
    const attempt2 = dueForAttempt2.find((item) => item.leadId === leadId);
    expect(attempt2).toBeDefined();
    expect(attempt2?.attemptNumber).toBe(2);
    await approveAndSend(attempt2!.draftId, 3);

    // No attempt 3 is ever scheduled, however far forward we look.
    const dueForAttempt3 = await due(farFutureAsOf(500));
    expect(dueForAttempt3.find((item) => item.leadId === leadId)).toBeUndefined();
  });
});
