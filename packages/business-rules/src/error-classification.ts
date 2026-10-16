// FR-039 — every workflow failure is classified into exactly one of these
// six categories; mirrors database/schema/workflow-event.ts's
// workflow_event_classification enum exactly (kept in sync by hand, since
// the enum lives in a different package with no shared source of truth).
export const WORKFLOW_EVENT_CLASSIFICATIONS = [
  "validation",
  "ai_provider",
  "persistence",
  "approval",
  "email_delivery",
  "unexpected",
] as const;

export type WorkflowEventClassification = (typeof WORKFLOW_EVENT_CLASSIFICATIONS)[number];

// FR-040: a validation failure is a definite rejection, never retried.
// FR-025: only a transient provider/delivery failure is retried, and only
// a bounded number of times (n8n HTTP-node retryOnFail) before falling
// back to manual review. `persistence`/`approval`/`unexpected` are not
// blindly retried either — a DB error needs operator attention, a stale
// approval needs the lead's current state re-read, and an unclassified
// failure is by definition not understood well enough to retry safely.
const AUTO_RETRYABLE_CLASSIFICATIONS: ReadonlySet<WorkflowEventClassification> = new Set([
  "ai_provider",
  "email_delivery",
]);

export function isAutoRetryable(classification: WorkflowEventClassification | null): boolean {
  return classification !== null && AUTO_RETRYABLE_CLASSIFICATIONS.has(classification);
}

// FR-042 — documented per-classification recovery steps for the execution
// log UI (T059) and docs/runbook.md (T061), kept as data here so both stay
// in sync with the taxonomy above instead of drifting independently.
const RECOVERY_GUIDANCE: Record<WorkflowEventClassification, string> = {
  validation:
    "Not retried automatically — no lead/draft was created or changed. Ask the submitter to correct and resubmit.",
  ai_provider:
    "Retried automatically a bounded number of times. If still failing, check the AI provider/config, then re-run analysis for this lead from its detail page.",
  persistence:
    "Indicates a database-layer failure. Check the database connection and that migrations are up to date, then retry the same operation — it is safe to repeat.",
  approval:
    "The requested draft version is no longer current (already sent, rejected, or superseded by a newer edit). Refresh the lead and act on its latest draft version instead of retrying the same request.",
  email_delivery:
    "Retried automatically a bounded number of times. The draft stays 'approved' and un-sent after every failed attempt, so re-running the send for the same draft is always safe and never duplicates delivery.",
  unexpected:
    "An unclassified failure escaped normal handling. Check the execution reference in n8n and the dashboard logs; once the cause is understood it is safe to retry the originating action.",
};

export function getRecoveryGuidance(classification: WorkflowEventClassification): string {
  return RECOVERY_GUIDANCE[classification];
}

// Matches credential-shaped keys (secret/token/password/authorization/
// api_key/cookie) AND stack/trace keys — a stack trace can leak internal
// file paths and is never safe to persist even redacted-by-truncation
// (FR-041 explicitly calls out "never raw secrets or stack traces").
const DANGEROUS_KEY_PATTERN = /stack|trace|secret|token|password|authorization|api[_-]?key|cookie/i;
const MAX_METADATA_STRING_LENGTH = 500;

function redactValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.length > MAX_METADATA_STRING_LENGTH
      ? `${value.slice(0, MAX_METADATA_STRING_LENGTH)}…[truncated]`
      : value;
  }
  if (Array.isArray(value)) {
    return value.map(redactValue);
  }
  if (value !== null && typeof value === "object") {
    return redactEventMetadata(value as Record<string, unknown>);
  }
  return value;
}

/**
 * Canonical redaction policy (FR-041), formalizing the Phase 2 baseline
 * that `apps/dashboard/lib/repositories/workflow-event.ts` applied before
 * every insert. A dangerous-looking key is replaced outright, at any
 * nesting depth (not just the top level) — WF-04's native Error Trigger
 * payload nests `error.stack` under `execution.error`, so a shallow-only
 * check would let a stack trace through unredacted. Other long free-text
 * values are capped, not dropped, so a safe summary survives.
 */
export function redactEventMetadata(metadata: Record<string, unknown>): Record<string, unknown> {
  const redacted: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(metadata)) {
    redacted[key] = DANGEROUS_KEY_PATTERN.test(key) ? "[REDACTED]" : redactValue(value);
  }
  return redacted;
}
