import { describe, expect, it } from "vitest";
import {
  WORKFLOW_EVENT_CLASSIFICATIONS,
  getRecoveryGuidance,
  isAutoRetryable,
  redactEventMetadata,
  type WorkflowEventClassification,
} from "@automation-hub/business-rules";

describe("isAutoRetryable (FR-025, FR-040)", () => {
  it("never auto-retries a validation failure", () => {
    expect(isAutoRetryable("validation")).toBe(false);
  });

  it("auto-retries a transient AI provider failure", () => {
    expect(isAutoRetryable("ai_provider")).toBe(true);
  });

  it("auto-retries a transient email delivery failure", () => {
    expect(isAutoRetryable("email_delivery")).toBe(true);
  });

  it("never auto-retries a persistence failure", () => {
    expect(isAutoRetryable("persistence")).toBe(false);
  });

  it("never auto-retries an approval (stale-version) failure", () => {
    expect(isAutoRetryable("approval")).toBe(false);
  });

  it("never auto-retries an unexpected/unclassified failure", () => {
    expect(isAutoRetryable("unexpected")).toBe(false);
  });

  it("never auto-retries when there is no classification at all", () => {
    expect(isAutoRetryable(null)).toBe(false);
  });
});

describe("getRecoveryGuidance (FR-042)", () => {
  it("returns non-empty, distinct guidance for every classification", () => {
    const guidance = WORKFLOW_EVENT_CLASSIFICATIONS.map((c) => getRecoveryGuidance(c));
    for (const text of guidance) {
      expect(typeof text).toBe("string");
      expect(text.length).toBeGreaterThan(0);
    }
    expect(new Set(guidance).size).toBe(WORKFLOW_EVENT_CLASSIFICATIONS.length);
  });

  it("documents that a validation failure is never retried automatically", () => {
    expect(getRecoveryGuidance("validation")).toMatch(/not retried|never retried/i);
  });
});

describe("redactEventMetadata (FR-041)", () => {
  it("strips a stack trace entirely rather than truncating it", () => {
    const result = redactEventMetadata({ stack: "Error: boom\n at foo (/app/secret/path.ts:1:1)" });
    expect(result.stack).toBe("[REDACTED]");
  });

  it("strips keys that look like secrets, tokens, or passwords", () => {
    const result = redactEventMetadata({
      apiKey: "sk-live-abc123",
      password: "hunter2",
      authorization: "Bearer xyz",
      secretValue: "shh",
    });
    expect(result.apiKey).toBe("[REDACTED]");
    expect(result.password).toBe("[REDACTED]");
    expect(result.authorization).toBe("[REDACTED]");
    expect(result.secretValue).toBe("[REDACTED]");
  });

  it("truncates long free-text values rather than dropping the field", () => {
    const longValue = "x".repeat(600);
    const result = redactEventMetadata({ reason: longValue });
    expect(typeof result.reason).toBe("string");
    expect((result.reason as string).length).toBeLessThan(600);
    expect(result.reason as string).toMatch(/truncated/);
  });

  it("leaves short, safe values untouched", () => {
    const result = redactEventMetadata({ reason: "schema_validation_failed", attemptNumber: 2, retried: true });
    expect(result).toEqual({ reason: "schema_validation_failed", attemptNumber: 2, retried: true });
  });

  it("is case-insensitive when matching dangerous key names", () => {
    const result = redactEventMetadata({ StackTrace: "oops", API_KEY: "abc" });
    expect(result.StackTrace).toBe("[REDACTED]");
    expect(result.API_KEY).toBe("[REDACTED]");
  });

  it("strips a stack trace nested inside another object, not just at the top level", () => {
    const result = redactEventMetadata({
      execution: { id: "231", error: { message: "boom", stack: "Error: boom\n at /app/secret.ts:1:1" } },
    });
    const execution = result.execution as { error: { message: string; stack: string } };
    expect(execution.error.stack).toBe("[REDACTED]");
    expect(execution.error.message).toBe("boom");
  });
});

describe("WORKFLOW_EVENT_CLASSIFICATIONS (FR-039)", () => {
  it("matches the six-category taxonomy exactly", () => {
    const expected: WorkflowEventClassification[] = [
      "validation",
      "ai_provider",
      "persistence",
      "approval",
      "email_delivery",
      "unexpected",
    ];
    expect(WORKFLOW_EVENT_CLASSIFICATIONS).toEqual(expected);
  });
});
