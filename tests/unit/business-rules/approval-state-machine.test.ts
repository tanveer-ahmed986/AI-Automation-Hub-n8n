import { describe, expect, it } from "vitest";
import { evaluateApproval, evaluateRejection, type DraftVersionState } from "@automation-hub/business-rules";

function draft(overrides: Partial<DraftVersionState> = {}): DraftVersionState {
  return {
    id: "draft-1",
    leadId: "lead-1",
    version: 1,
    status: "pending_approval",
    ...overrides,
  };
}

describe("evaluateApproval", () => {
  it("approves a pending draft that is the current (latest) version", () => {
    expect(evaluateApproval(draft(), 1, 1)).toBe("approved");
  });

  it("ties approval to the exact version requested (FR-017) — rejects a mismatched version", () => {
    expect(evaluateApproval(draft({ version: 2 }), 1, 2)).toBe("stale_version_rejected");
  });

  it("rejects as stale once a newer version exists (edit supersedes the prior version, FR-018)", () => {
    expect(evaluateApproval(draft({ version: 1 }), 1, 2)).toBe("stale_version_rejected");
  });

  it("never allows a rejected draft to become approved, even if still nominally the latest (FR-019, terminal)", () => {
    expect(evaluateApproval(draft({ status: "rejected" }), 1, 1)).toBe("stale_version_rejected");
  });

  it("reports already_sent for a draft that has already been sent, regardless of version match", () => {
    expect(evaluateApproval(draft({ status: "sent" }), 1, 1)).toBe("already_sent");
  });

  it("is idempotent for a duplicate approval of an already-approved (not yet sent) current version", () => {
    expect(evaluateApproval(draft({ status: "approved" }), 1, 1)).toBe("approved");
  });
});

describe("evaluateRejection", () => {
  it("rejects a pending draft that is the current version", () => {
    expect(evaluateRejection(draft(), 1, 1)).toBe("rejected");
  });

  it("rejects as stale once a newer version exists", () => {
    expect(evaluateRejection(draft({ version: 1 }), 1, 2)).toBe("stale_version_rejected");
  });

  it("is idempotent for a draft already rejected (terminal, FR-019)", () => {
    expect(evaluateRejection(draft({ status: "rejected" }), 1, 1)).toBe("rejected");
  });

  it("reports already_sent rather than rejecting a draft that was already sent", () => {
    expect(evaluateRejection(draft({ status: "sent" }), 1, 1)).toBe("already_sent");
  });
});
