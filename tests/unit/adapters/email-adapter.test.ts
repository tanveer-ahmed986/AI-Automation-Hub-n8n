import { describe, expect, it } from "vitest";
import { FORCE_EMAIL_TRANSIENT_FAILURE_MARKER, MockEmailAdapter } from "@automation-hub/adapters";

describe("MockEmailAdapter", () => {
  it("clearly labels a simulated send as mock, never as a real delivery", async () => {
    const adapter = new MockEmailAdapter();
    const result = await adapter.send({
      to: "lead@example.com",
      subject: "Thanks for reaching out",
      body: "Hello there.",
    });
    expect(result.mock).toBe(true);
    expect(result.provider).toBe("mock");
  });

  it("returns safe, structured provider metadata only (no secrets/credentials)", async () => {
    const adapter = new MockEmailAdapter();
    const result = await adapter.send({
      to: "lead@example.com",
      subject: "Thanks for reaching out",
      body: "Hello there.",
    });
    expect(result.providerResponseSafe).toBeTruthy();
    expect(JSON.stringify(result.providerResponseSafe)).not.toMatch(/password|secret|api[_-]?key/i);
  });

  it("throws on the documented transient-failure test hook, without marking anything as sent itself", async () => {
    const adapter = new MockEmailAdapter();
    await expect(
      adapter.send({
        to: "lead@example.com",
        subject: "Thanks for reaching out",
        body: `Hello there. ${FORCE_EMAIL_TRANSIENT_FAILURE_MARKER}`,
      }),
    ).rejects.toThrow();
  });

  it("is deterministic — repeated sends of the same input never change the simulated outcome", async () => {
    const adapter = new MockEmailAdapter();
    const a = await adapter.send({ to: "lead@example.com", subject: "Hi", body: "Body" });
    const b = await adapter.send({ to: "lead@example.com", subject: "Hi", body: "Body" });
    expect(a).toEqual(b);
  });
});
