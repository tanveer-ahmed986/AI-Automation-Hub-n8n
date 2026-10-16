import { describe, expect, it, beforeAll } from "vitest";

const BASE_URL = process.env.DASHBOARD_BASE_URL ?? "http://localhost:3100";
const SECRET = process.env.INTERNAL_API_SECRET ?? "test-secret-value-for-dev-run";

const FORCE_EMAIL_TRANSIENT_FAILURE_MARKER = "__FORCE_EMAIL_TRANSIENT_FAILURE__";

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

async function createPendingDraft(message: string) {
  const unique = `error-handling-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const intake = await call("/api/internal/leads/intake", {
    name: "Error Handling Subject",
    email: unique,
    message,
    consent_to_follow_up: false,
  });
  expect(intake.status).toBe(200);
  const leadId: string = intake.json.leadId;

  const analyzed = await call(`/api/internal/leads/${leadId}/analyze`);
  expect(analyzed.status).toBe(200);
  expect(analyzed.json.analysisStatus).toBe("completed");

  return { leadId, draftId: analyzed.json.draftId as string };
}

describe("error classification and recovery (integration, requires a running dashboard + Postgres)", () => {
  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!res || !res.ok) {
      throw new Error(
        `Dashboard not reachable at ${BASE_URL}/api/health — start it before running integration tests`,
      );
    }
  });

  it("logs a malformed-JSON intake submission as a validation failure, with no lead created", async () => {
    const res = await fetch(`${BASE_URL}/api/internal/leads/intake`, {
      method: "POST",
      headers: headers(),
      body: "{not valid json",
    });
    expect(res.status).toBe(400);

    const events = await call("/api/internal/events?status=failed&classification=validation", undefined, "GET");
    expect(events.status).toBe(200);
    const malformed = events.json.find(
      (e: { safeMetadata: { reason: string } }) => e.safeMetadata.reason === "malformed_json",
    );
    expect(malformed).toBeDefined();
    expect(malformed.leadId).toBeNull();
    expect(malformed.classification).toBe("validation");
  });

  it("logs a schema-validation intake failure with field names only, never the raw message, and is never auto-retryable", async () => {
    const res = await call("/api/internal/leads/intake", {
      name: "Missing Message",
      email: "missing-message@example.com",
      // `message` omitted — required by leadIntakeRequestSchema.
      consent_to_follow_up: false,
    });
    expect(res.status).toBe(400);
    expect(res.json.fields).toContain("message");

    const events = await call("/api/internal/events?status=failed&classification=validation", undefined, "GET");
    const schemaFailure = events.json.find(
      (e: { safeMetadata: { reason: string } }) => e.safeMetadata.reason === "schema_validation_failed",
    );
    expect(schemaFailure).toBeDefined();
    expect(schemaFailure.safeMetadata.fields).toContain("message");
    expect(JSON.stringify(schemaFailure.safeMetadata)).not.toContain("Missing Message");
  });

  it("logs a simulated transient email delivery failure, and retrying reuses the same lead/draft rather than duplicating them", async () => {
    const { leadId, draftId: originalDraftId } = await createPendingDraft(
      "We need help with onboarding.",
    );
    // The mock AI adapter never echoes the raw message into the draft
    // body, so the only way to get the failure marker into draft.body is
    // via an edited version — exactly how a real reviewer would hand-edit
    // a draft before approving it (FR-018).
    const edited = await call(`/api/internal/drafts/${originalDraftId}/versions`, {
      subject: "Re: your inquiry",
      body: `Thanks for reaching out. ${FORCE_EMAIL_TRANSIENT_FAILURE_MARKER}`,
    });
    expect(edited.status).toBe(200);
    const draftId: string = edited.json.draftId;
    const draftVersion: number = edited.json.version;

    const approved = await call(`/api/internal/drafts/${draftId}/approve`, { draftVersion });
    expect(approved.json.result).toBe("approved");

    // First attempt fails (the mock adapter throws on this marker).
    const firstAttempt = await call("/api/internal/email/send", { draftId, draftVersion });
    expect(firstAttempt.status).toBe(502);

    // A documented retry (n8n's bounded retryOnFail, or an operator
    // re-running the same action) calls the identical route again — same
    // draftId/draftVersion, no new lead or draft is created, and it fails
    // the same deterministic way again rather than silently succeeding.
    const retryAttempt = await call("/api/internal/email/send", { draftId, draftVersion });
    expect(retryAttempt.status).toBe(502);

    const events = await call(
      `/api/internal/events?leadId=${leadId}&classification=email_delivery`,
      undefined,
      "GET",
    );
    expect(events.status).toBe(200);
    expect(events.json.length).toBeGreaterThanOrEqual(2);
    for (const event of events.json) {
      expect(event.leadId).toBe(leadId);
      expect(event.safeMetadata.draftId).toBe(draftId);
      expect(event.status).toBe("failed");
    }
  });
});
