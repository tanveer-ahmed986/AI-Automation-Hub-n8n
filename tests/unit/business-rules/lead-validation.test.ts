import { describe, expect, it } from "vitest";
import { validateLeadIntake, computeMessageFingerprint } from "@automation-hub/business-rules";

describe("validateLeadIntake", () => {
  it("accepts a complete, valid submission and normalizes email casing/whitespace", () => {
    const result = validateLeadIntake({
      name: "  Ada Lovelace  ",
      email: "  ADA@Example.COM ",
      message: "We need a new business website with online booking.",
      consent_to_follow_up: true,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.email).toBe("ada@example.com");
      expect(result.data.name).toBe("Ada Lovelace");
    }
  });

  it("rejects a submission missing the required name field", () => {
    const result = validateLeadIntake({
      email: "ada@example.com",
      message: "hello",
      consent_to_follow_up: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toContain("name");
    }
  });

  it("rejects an invalid email format", () => {
    const result = validateLeadIntake({
      name: "Ada",
      email: "not-an-email",
      message: "hello",
      consent_to_follow_up: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toContain("email");
    }
  });

  it("rejects a message over the 5,000-character cap", () => {
    const result = validateLeadIntake({
      name: "Ada",
      email: "ada@example.com",
      message: "x".repeat(5001),
      consent_to_follow_up: true,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toContain("message");
    }
  });

  it("rejects an empty message", () => {
    const result = validateLeadIntake({
      name: "Ada",
      email: "ada@example.com",
      message: "",
      consent_to_follow_up: true,
    });
    expect(result.ok).toBe(false);
  });

  it("rejects a missing consent_to_follow_up boolean", () => {
    const result = validateLeadIntake({
      name: "Ada",
      email: "ada@example.com",
      message: "hello there",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.fields).toContain("consent_to_follow_up");
    }
  });

  it("never exposes a stack trace or internal detail in the error message", () => {
    const result = validateLeadIntake({ email: "bad" });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toMatch(/at [A-Za-z]+\.[A-Za-z]+ \(/); // stack-trace-like line
      expect(result.error.length).toBeLessThan(300);
    }
  });
});

describe("computeMessageFingerprint", () => {
  it("is stable for the same message content", () => {
    const a = computeMessageFingerprint("We need a new business website with online booking.");
    const b = computeMessageFingerprint("We need a new business website with online booking.");
    expect(a).toBe(b);
  });

  it("differs for different message content", () => {
    const a = computeMessageFingerprint("message one");
    const b = computeMessageFingerprint("message two");
    expect(a).not.toBe(b);
  });

  it("ignores only leading/trailing whitespace differences (same trimmed content)", () => {
    const a = computeMessageFingerprint("hello world");
    const b = computeMessageFingerprint("  hello world  ");
    expect(a).toBe(b);
  });

  it("produces a fixed-length hex string that fits the varchar(64) column", () => {
    const fp = computeMessageFingerprint("anything");
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });
});
