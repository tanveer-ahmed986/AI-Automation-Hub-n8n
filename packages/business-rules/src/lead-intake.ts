import { createHash } from "node:crypto";
import { leadIntakeRequestSchema, type LeadIntakeRequest } from "@automation-hub/schemas";

export interface ValidateLeadIntakeOk {
  ok: true;
  data: LeadIntakeRequest;
}
export interface ValidateLeadIntakeError {
  ok: false;
  error: string;
  fields: string[];
}
export type ValidateLeadIntakeResult = ValidateLeadIntakeOk | ValidateLeadIntakeError;

/**
 * Wraps the shared Zod schema (the single source of truth, per
 * constitution Principle II) and reshapes its result into a safe,
 * caller-friendly outcome — never a raw Zod error object, which could
 * leak internal schema details to a webhook response (FR-002).
 */
export function validateLeadIntake(input: unknown): ValidateLeadIntakeResult {
  const parsed = leadIntakeRequestSchema.safeParse(input);
  if (parsed.success) {
    return { ok: true, data: parsed.data };
  }
  const fields = [...new Set(parsed.error.issues.map((issue) => String(issue.path[0] ?? "")).filter(Boolean))];
  return {
    ok: false,
    error: "One or more fields failed validation.",
    fields,
  };
}

/**
 * Stable fingerprint of the normalized message — the fallback dedup key
 * when no idempotency_key is supplied (FR-005). Trimmed only (not
 * case-folded): a retried delivery resends identical bytes, so trimming
 * incidental whitespace is enough to make the fingerprint stable without
 * conflating genuinely different messages that merely share casing.
 */
export function computeMessageFingerprint(message: string): string {
  return createHash("sha256").update(message.trim()).digest("hex");
}

export interface DedupCandidate {
  id: string;
  idempotencyKey: string | null;
  emailNormalized: string;
  messageFingerprint: string;
  createdAt: Date;
}

export interface FindDedupMatchParams {
  idempotencyKey?: string | null;
  emailNormalized: string;
  messageFingerprint: string;
  now: Date;
  dedupWindowHours: number;
}

/**
 * FR-005: idempotency key takes absolute precedence when supplied — it is
 * a distinct lookup path, not a fallback blended with the fingerprint
 * rule. Only when no key is supplied does the normalized-email +
 * message-fingerprint + time-window rule apply.
 */
export function findDedupMatch(
  params: FindDedupMatchParams,
  candidates: DedupCandidate[],
): DedupCandidate | null {
  if (params.idempotencyKey) {
    return candidates.find((c) => c.idempotencyKey === params.idempotencyKey) ?? null;
  }

  const windowMs = params.dedupWindowHours * 60 * 60 * 1000;
  const matches = candidates.filter(
    (c) =>
      c.emailNormalized === params.emailNormalized &&
      c.messageFingerprint === params.messageFingerprint &&
      params.now.getTime() - c.createdAt.getTime() <= windowMs &&
      params.now.getTime() - c.createdAt.getTime() >= 0,
  );
  if (matches.length === 0) {
    return null;
  }
  return matches.reduce((latest, current) => (current.createdAt > latest.createdAt ? current : latest));
}
