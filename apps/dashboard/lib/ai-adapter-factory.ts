import { MockAiAdapter, type AiLeadAnalysisAdapter } from "@automation-hub/adapters";
import { isMockAi } from "./config";

/**
 * No real HTTP-based AI provider adapter exists yet in this version
 * (tasks.md never schedules one — the demo path is required to work
 * without paid credentials, per constitution Principle IV). If
 * `MOCK_AI=false` is set without a real adapter implementation, fail
 * closed rather than silently falling back to the mock — silently
 * substituting mock output for a requested live call would be dishonest
 * (constitution Principle VII), not merely degraded.
 */
export function getAiAdapter(): AiLeadAnalysisAdapter {
  if (isMockAi()) {
    return new MockAiAdapter();
  }
  throw new Error(
    "MOCK_AI=false but no real AI provider adapter is implemented in this version. " +
      "Set MOCK_AI=true, or see docs/security.md for the documented path to add a real provider.",
  );
}
