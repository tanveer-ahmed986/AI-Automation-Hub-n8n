"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { callApprovalActionWebhook } from "@/lib/n8n-client";
import { createEditedDraftVersion, getReplyDraftById } from "@/lib/repositories/reply-draft";

function requireConfirmation(formData: FormData) {
  if (formData.get("confirmed") !== "on") {
    throw new Error("Confirmation is required before taking this action (FR-036).");
  }
}

function readCommon(formData: FormData) {
  const draftId = String(formData.get("draftId") ?? "");
  const draftVersion = Number.parseInt(String(formData.get("draftVersion") ?? ""), 10);
  const leadId = String(formData.get("leadId") ?? "");
  const reviewerIdentity = String(formData.get("reviewerIdentity") ?? "").trim() || null;
  if (!draftId || !Number.isFinite(draftVersion) || !leadId) {
    throw new Error("Missing draft identification.");
  }
  return { draftId, draftVersion, leadId, reviewerIdentity };
}

async function finish(leadId: string, result: { result: string }) {
  revalidatePath("/approvals");
  revalidatePath("/leads");
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/");
  redirect(`/approvals?result=${encodeURIComponent(result.result)}`);
}

export async function approveDraftAction(formData: FormData) {
  requireConfirmation(formData);
  const { draftId, draftVersion, leadId, reviewerIdentity } = readCommon(formData);
  const result = await callApprovalActionWebhook({ action: "approve", draftId, draftVersion, reviewerIdentity });
  await finish(leadId, result);
}

export async function rejectDraftAction(formData: FormData) {
  requireConfirmation(formData);
  const { draftId, draftVersion, leadId, reviewerIdentity } = readCommon(formData);
  const result = await callApprovalActionWebhook({ action: "reject", draftId, draftVersion, reviewerIdentity });
  await finish(leadId, result);
}

/**
 * Creates the new ReplyDraft version here (direct repository call, same
 * pattern as the Settings action) before ever calling WF-02 — by the
 * time the webhook runs, draftId/draftVersion already identify the one
 * concrete version to approve (FR-018).
 */
export async function editAndApproveDraftAction(formData: FormData) {
  requireConfirmation(formData);
  const { draftId, leadId, reviewerIdentity } = readCommon(formData);
  const editedSubject = String(formData.get("editedSubject") ?? "").trim();
  const editedBody = String(formData.get("editedBody") ?? "").trim();
  if (!editedSubject || !editedBody) {
    throw new Error("Subject and body are required.");
  }

  const original = await getReplyDraftById(draftId);
  if (!original) {
    throw new Error("Draft not found.");
  }

  const newVersion = await createEditedDraftVersion({ leadId, subject: editedSubject, body: editedBody });
  const result = await callApprovalActionWebhook({
    action: "approve",
    draftId: newVersion.id,
    draftVersion: newVersion.version,
    reviewerIdentity,
  });
  await finish(leadId, result);
}
