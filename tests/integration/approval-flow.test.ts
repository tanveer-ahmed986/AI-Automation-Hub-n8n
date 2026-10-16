import { beforeAll, describe, expect, it } from "vitest";

const BASE_URL = process.env.DASHBOARD_BASE_URL ?? "http://localhost:3100";
const SECRET = process.env.INTERNAL_API_SECRET ?? "test-secret-value-for-dev-run";

function headers() {
  return { "Content-Type": "application/json", "X-Internal-Api-Secret": SECRET };
}

async function call(path: string, body?: unknown) {
  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, json: await res.json() };
}

async function createPendingDraft(message: string) {
  const unique = `approval-flow-${Date.now()}-${Math.random().toString(36).slice(2)}@example.com`;
  const intake = await call("/api/internal/leads/intake", {
    name: "Flow Subject",
    email: unique,
    message,
    consent_to_follow_up: true,
  });
  expect(intake.status).toBe(200);
  const leadId: string = intake.json.leadId;

  const analyzed = await call(`/api/internal/leads/${leadId}/analyze`);
  expect(analyzed.status).toBe(200);
  expect(analyzed.json.analysisStatus).toBe("completed");

  return { leadId, draftId: analyzed.json.draftId as string, version: 1 };
}

describe("approval + email delivery flow (integration, requires a running dashboard + Postgres)", () => {
  beforeAll(async () => {
    const res = await fetch(`${BASE_URL}/api/health`).catch(() => null);
    if (!res || !res.ok) {
      throw new Error(
        `Dashboard not reachable at ${BASE_URL}/api/health — start it before running integration tests`,
      );
    }
  });

  it("approve then send delivers exactly once; a retry reports already_sent, never a second send", async () => {
    const { draftId } = await createPendingDraft("We'd like a quote for a new website.");

    const approved = await call(`/api/internal/drafts/${draftId}/approve`, { draftVersion: 1 });
    expect(approved.json.result).toBe("approved");

    const sent = await call("/api/internal/email/send", { draftId, draftVersion: 1 });
    expect(sent.json.status).toBe("sent");
    expect(sent.json.mock).toBe(true);

    const sentAgain = await call("/api/internal/email/send", { draftId, draftVersion: 1 });
    expect(sentAgain.json.status).toBe("already_sent");
  });

  it("edit-and-approve requires fresh approval on the new version; the prior version becomes permanently unsendable", async () => {
    const { draftId: v1Id } = await createPendingDraft("Interested in AI automation for support.");

    const newVersion = await call(`/api/internal/drafts/${v1Id}/versions`, {
      subject: "Edited subject",
      body: "Edited body with more detail.",
    });
    expect(newVersion.status).toBe(200);
    const v2Id: string = newVersion.json.draftId;
    expect(newVersion.json.version).toBe(2);

    // The superseded version can never be approved again, even though
    // its own row status didn't change to "sent" or "rejected" by name —
    // it is stale the moment a newer version exists (FR-018).
    const approveOld = await call(`/api/internal/drafts/${v1Id}/approve`, { draftVersion: 1 });
    expect(approveOld.json.result).toBe("stale_version_rejected");

    const approveNew = await call(`/api/internal/drafts/${v2Id}/approve`, { draftVersion: 2 });
    expect(approveNew.json.result).toBe("approved");

    const sendOld = await call("/api/internal/email/send", { draftId: v1Id, draftVersion: 1 });
    expect(sendOld.json.status).toBe("rejected_stale_version");

    const sendNew = await call("/api/internal/email/send", { draftId: v2Id, draftVersion: 2 });
    expect(sendNew.json.status).toBe("sent");
  });

  it("reject is terminal — never sent under any retry, and can never later be approved", async () => {
    const { draftId } = await createPendingDraft("Please remove me from your list.");

    const rejected = await call(`/api/internal/drafts/${draftId}/reject`, { draftVersion: 1 });
    expect(rejected.json.result).toBe("rejected");

    const rejectedAgain = await call(`/api/internal/drafts/${draftId}/reject`, { draftVersion: 1 });
    expect(rejectedAgain.json.result).toBe("rejected");

    const approveAfterReject = await call(`/api/internal/drafts/${draftId}/approve`, { draftVersion: 1 });
    expect(approveAfterReject.json.result).toBe("stale_version_rejected");

    const sendAfterReject = await call("/api/internal/email/send", { draftId, draftVersion: 1 });
    expect(sendAfterReject.json.status).toBe("rejected_stale_version");
  });

  it("a duplicate approval request against an already-sent draft reports already_sent, with no second delivery", async () => {
    const { draftId } = await createPendingDraft("We'd like to automate our onboarding emails.");

    await call(`/api/internal/drafts/${draftId}/approve`, { draftVersion: 1 });
    await call("/api/internal/email/send", { draftId, draftVersion: 1 });

    const duplicateApprove = await call(`/api/internal/drafts/${draftId}/approve`, { draftVersion: 1 });
    expect(duplicateApprove.json.result).toBe("already_sent");

    const duplicateSend = await call("/api/internal/email/send", { draftId, draftVersion: 1 });
    expect(duplicateSend.json.status).toBe("already_sent");
  });
});
