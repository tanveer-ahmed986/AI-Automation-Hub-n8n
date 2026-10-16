import { createHash } from "node:crypto";
import type { LeadAnalysisResult } from "@automation-hub/schemas";

export interface AiLeadAnalysisInput {
  name: string;
  message: string;
  service?: string | null;
  budget?: string | null;
  timeline?: string | null;
}

export interface AiLeadAnalysisAdapter {
  analyze(input: AiLeadAnalysisInput): Promise<LeadAnalysisResult>;
}

const SPAM_PATTERN = /(click here|buy now|cheap (watches|meds|viagra)|crypto giveaway|act now!!!)/i;

// Deterministic, documented test hooks for exercising the fail-closed
// paths (route handler schema validation, provider-error handling)
// without needing a real flaky AI provider — the whole point of a mock
// adapter is that failure modes are reproducible too.
export const FORCE_AI_SCHEMA_FAILURE_MARKER = "__FORCE_AI_SCHEMA_FAILURE__";
export const FORCE_AI_PROVIDER_ERROR_MARKER = "__FORCE_AI_PROVIDER_ERROR__";

function deterministicSeed(input: AiLeadAnalysisInput): number {
  const hash = createHash("sha256")
    .update(JSON.stringify(input))
    .digest("hex");
  return parseInt(hash.slice(0, 8), 16);
}

/**
 * Deterministic, seeded-by-input-hash mock — the default AI adapter
 * (constitution Principle IV). Produces the same analysis for the same
 * input every run (reproducible demos) and never calls out to any
 * external provider. Output always passes through the shared Zod schema
 * identically to the real adapter (research.md §5) — this function does
 * not special-case its own output to skip validation.
 *
 * Deliberately does not parse the message for instructions to act on —
 * only for signal used in its own fixed scoring heuristic. Lead message
 * content is untrusted data, never a command (constitution Principle II).
 */
export class MockAiAdapter implements AiLeadAnalysisAdapter {
  async analyze(input: AiLeadAnalysisInput): Promise<LeadAnalysisResult> {
    const seed = deterministicSeed(input);
    const message = input.message;

    if (message.includes(FORCE_AI_PROVIDER_ERROR_MARKER)) {
      throw new Error("Simulated AI provider error (test hook)");
    }
    if (message.includes(FORCE_AI_SCHEMA_FAILURE_MARKER)) {
      // Deliberately out-of-schema (score out of range, missing field) —
      // cast through unknown since this intentionally violates the
      // LeadAnalysisResult type to exercise the caller's schema check.
      return {
        category: "unknown",
        intent: "unknown",
        summary: "",
        urgency: "unknown",
        budget_band: "unknown",
        lead_score: 999,
        score_factors: [],
        missing_information: [],
        recommended_next_action: "manual_review",
      } as unknown as LeadAnalysisResult;
    }

    if (SPAM_PATTERN.test(message)) {
      return {
        category: "other",
        intent: "spam",
        summary: "Message matches common spam/unsolicited-marketing patterns.",
        urgency: "low",
        budget_band: "unknown",
        timeline: null,
        lead_score: seed % 10,
        score_factors: ["Message matches known spam patterns"],
        missing_information: [],
        recommended_next_action: "mark_spam",
        draft_reply: {
          subject: "Re: your inquiry",
          body: "Thank you for reaching out. This message has been flagged for manual review.",
        },
      };
    }

    const category = inferCategory(input.service, message);
    const urgency = inferUrgency(message, seed);
    const missingInformation: string[] = [];
    if (!input.budget) missingInformation.push("Budget");
    if (!input.timeline) missingInformation.push("Target timeline");

    const scoreFactors = ["Clear service interest"];
    let score = 50 + (seed % 20);
    if (input.budget) {
      score += 10;
      scoreFactors.push("Budget provided");
    } else {
      scoreFactors.push("Budget not provided");
    }
    if (input.timeline) {
      score += 10;
      scoreFactors.push("Timeline provided");
    } else {
      scoreFactors.push("Timeline not provided");
    }
    score = Math.max(0, Math.min(100, score));

    const recommendedNextAction = missingInformation.length > 0 ? "request_clarification" : "approve_reply";

    return {
      category,
      intent: "new_project",
      summary: `Prospect is asking about ${category.replace(/_/g, " ")}.`,
      urgency,
      budget_band: "unknown",
      timeline: input.timeline ?? null,
      lead_score: score,
      score_factors: scoreFactors,
      missing_information: missingInformation,
      recommended_next_action: recommendedNextAction,
      draft_reply: {
        subject: "Thanks for reaching out",
        body: buildDraftBody(input, missingInformation),
      },
    };
  }
}

function inferCategory(
  service: string | null | undefined,
  message: string,
): LeadAnalysisResult["category"] {
  const haystack = `${service ?? ""} ${message}`.toLowerCase();
  if (haystack.includes("website") || haystack.includes("web site") || haystack.includes("web dev")) {
    return "website_development";
  }
  if (haystack.includes("automat") || haystack.includes("ai ") || haystack.includes("workflow")) {
    return "ai_automation";
  }
  if (haystack.includes("consult")) {
    return "consulting";
  }
  return "unknown";
}

function inferUrgency(message: string, seed: number): LeadAnalysisResult["urgency"] {
  const haystack = message.toLowerCase();
  if (haystack.includes("urgent") || haystack.includes("asap") || haystack.includes("immediately")) {
    return "high";
  }
  return seed % 2 === 0 ? "medium" : "low";
}

/**
 * Never states a price, discount, guarantee, or availability that wasn't
 * explicitly configured (FR-014) — the mock adapter has no business
 * profile data to draw from at this layer, so it only ever asks a
 * clarifying question for genuinely missing information.
 */
function buildDraftBody(input: AiLeadAnalysisInput, missingInformation: string[]): string {
  const lines = [
    `Hi ${input.name.split(" ")[0] ?? input.name},`,
    "",
    "Thank you for reaching out — we'd love to help with your project.",
  ];
  if (missingInformation.length > 0) {
    lines.push("", `To get started, could you share a bit more about your ${missingInformation.join(" and ").toLowerCase()}?`);
  }
  lines.push("", "We'll follow up shortly with next steps.");
  return lines.join("\n");
}
