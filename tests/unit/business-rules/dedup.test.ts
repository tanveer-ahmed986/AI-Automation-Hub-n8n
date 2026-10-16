import { describe, expect, it } from "vitest";
import { findDedupMatch, type DedupCandidate } from "@automation-hub/business-rules";

const now = new Date("2026-10-15T12:00:00Z");

function candidate(overrides: Partial<DedupCandidate> = {}): DedupCandidate {
  return {
    id: "existing-lead-id",
    idempotencyKey: null,
    emailNormalized: "ada@example.com",
    messageFingerprint: "fingerprint-a",
    createdAt: now,
    ...overrides,
  };
}

describe("findDedupMatch", () => {
  it("matches on idempotency key regardless of time elapsed", () => {
    const old = candidate({
      idempotencyKey: "client-key-1",
      createdAt: new Date("2020-01-01T00:00:00Z"),
    });
    const match = findDedupMatch(
      {
        idempotencyKey: "client-key-1",
        emailNormalized: "different@example.com",
        messageFingerprint: "different-fingerprint",
        now,
        dedupWindowHours: 24,
      },
      [old],
    );
    expect(match?.id).toBe("existing-lead-id");
  });

  it("does not fall back to fingerprint matching when an idempotency key is supplied but doesn't match", () => {
    const existing = candidate({ idempotencyKey: "some-other-key" });
    const match = findDedupMatch(
      {
        idempotencyKey: "client-key-1",
        emailNormalized: "ada@example.com",
        messageFingerprint: "fingerprint-a",
        now,
        dedupWindowHours: 24,
      },
      [existing],
    );
    expect(match).toBeNull();
  });

  it("falls back to normalized-email + message-fingerprint within the window when no idempotency key is supplied", () => {
    const existing = candidate({ createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 2) }); // 2h ago
    const match = findDedupMatch(
      {
        idempotencyKey: null,
        emailNormalized: "ada@example.com",
        messageFingerprint: "fingerprint-a",
        now,
        dedupWindowHours: 24,
      },
      [existing],
    );
    expect(match?.id).toBe("existing-lead-id");
  });

  it("does not match outside the configured window", () => {
    const existing = candidate({ createdAt: new Date(now.getTime() - 1000 * 60 * 60 * 25) }); // 25h ago
    const match = findDedupMatch(
      {
        idempotencyKey: null,
        emailNormalized: "ada@example.com",
        messageFingerprint: "fingerprint-a",
        now,
        dedupWindowHours: 24,
      },
      [existing],
    );
    expect(match).toBeNull();
  });

  it("does not match a different email even with the same fingerprint", () => {
    const existing = candidate({ emailNormalized: "someone-else@example.com" });
    const match = findDedupMatch(
      {
        idempotencyKey: null,
        emailNormalized: "ada@example.com",
        messageFingerprint: "fingerprint-a",
        now,
        dedupWindowHours: 24,
      },
      [existing],
    );
    expect(match).toBeNull();
  });

  it("does not match a different fingerprint even with the same email", () => {
    const existing = candidate({ messageFingerprint: "a-totally-different-fingerprint" });
    const match = findDedupMatch(
      {
        idempotencyKey: null,
        emailNormalized: "ada@example.com",
        messageFingerprint: "fingerprint-a",
        now,
        dedupWindowHours: 24,
      },
      [existing],
    );
    expect(match).toBeNull();
  });

  it("returns null when there are no candidates", () => {
    const match = findDedupMatch(
      {
        idempotencyKey: null,
        emailNormalized: "ada@example.com",
        messageFingerprint: "fingerprint-a",
        now,
        dedupWindowHours: 24,
      },
      [],
    );
    expect(match).toBeNull();
  });
});
