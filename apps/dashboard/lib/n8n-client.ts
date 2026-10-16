import { INTERNAL_API_SECRET_HEADER } from "./internal-api-auth";
import { getN8nInternalBaseUrl } from "./config";

export interface ApprovalActionWebhookPayload {
  action: "approve" | "edit_and_approve" | "reject";
  draftId: string;
  draftVersion: number;
  reviewerIdentity?: string | null;
}

export interface ApprovalActionWebhookResult {
  result: "sent" | "already_sent" | "rejected" | "stale_version_rejected";
  mock: boolean;
}

/**
 * The one place the dashboard calls into n8n rather than the other way
 * around (research.md §4) — WF-02 re-validates the version and performs
 * the actual send, so the real "is this safe to send" decision never
 * lives in this HTTP call itself.
 */
export async function callApprovalActionWebhook(
  payload: ApprovalActionWebhookPayload,
): Promise<ApprovalActionWebhookResult> {
  const secret = process.env.INTERNAL_API_SECRET;
  if (!secret) {
    throw new Error("INTERNAL_API_SECRET is not set.");
  }
  const response = await fetch(`${getN8nInternalBaseUrl()}/webhook/approval-action`, {
    method: "POST",
    headers: { "Content-Type": "application/json", [INTERNAL_API_SECRET_HEADER]: secret },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    throw new Error(`Approval-action webhook responded with HTTP ${response.status}`);
  }
  return response.json();
}
