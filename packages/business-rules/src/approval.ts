export type DraftStatus = "pending_approval" | "approved" | "rejected" | "sent";

export interface DraftVersionState {
  id: string;
  leadId: string;
  version: number;
  status: DraftStatus;
}

export type ApprovalOutcome = "approved" | "stale_version_rejected" | "already_sent";
export type RejectionOutcome = "rejected" | "stale_version_rejected" | "already_sent";

/**
 * A draft is stale once it is no longer both the exact version requested
 * (FR-017) and the lead's current latest version — an edit immediately
 * supersedes every prior version (FR-018), whatever that prior version's
 * own status still says.
 */
function isStale(draft: DraftVersionState, requestedVersion: number, latestVersionNumber: number): boolean {
  return draft.version !== requestedVersion || draft.version !== latestVersionNumber;
}

/**
 * Pure state-machine core for `POST /drafts/{id}/approve` (T041) — no I/O,
 * so every transition (version-tied approval, stale rejection, terminal
 * reject, exactly-once approved→sent) is unit-testable without a database.
 */
export function evaluateApproval(
  draft: DraftVersionState,
  requestedVersion: number,
  latestVersionNumber: number,
): ApprovalOutcome {
  if (draft.status === "sent") {
    return "already_sent";
  }
  if (isStale(draft, requestedVersion, latestVersionNumber)) {
    return "stale_version_rejected";
  }
  // A rejected draft is permanently unsendable (FR-019) even if, by
  // version number alone, it would still look "current".
  if (draft.status === "rejected") {
    return "stale_version_rejected";
  }
  return "approved";
}

/** Mirrors `evaluateApproval` for the reject path. */
export function evaluateRejection(
  draft: DraftVersionState,
  requestedVersion: number,
  latestVersionNumber: number,
): RejectionOutcome {
  if (draft.status === "sent") {
    return "already_sent";
  }
  if (isStale(draft, requestedVersion, latestVersionNumber)) {
    return "stale_version_rejected";
  }
  return "rejected";
}
