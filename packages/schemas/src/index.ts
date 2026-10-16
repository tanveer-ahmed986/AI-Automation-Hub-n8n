import { z } from "zod";

// Mirrors specs/001-lead-management-hub/contracts/internal-api.openapi.yaml.
// The OpenAPI file documents the contract for readers; these Zod schemas
// are the enforced source of truth at runtime (constitution Principle II).

export const leadCategoryEnum = z.enum([
  "website_development",
  "ai_automation",
  "consulting",
  "other",
  "unknown",
]);

export const leadIntentEnum = z.enum([
  "new_project",
  "support",
  "partnership",
  "spam",
  "other",
  "unknown",
]);

export const leadUrgencyEnum = z.enum(["low", "medium", "high", "unknown"]);

export const leadBudgetBandEnum = z.enum([
  "unknown",
  "under_100",
  "100_499",
  "500_999",
  "1000_plus",
]);

export const leadRecommendedNextActionEnum = z.enum([
  "approve_reply",
  "request_clarification",
  "manual_review",
  "mark_spam",
]);

export const leadStatusEnum = z.enum(["pending_review", "approved", "sent", "closed", "spam"]);

export const workflowEventTypeEnum = z.enum([
  "intake",
  "analysis",
  "approval",
  "delivery",
  "follow_up",
  "error",
]);

export const workflowEventStatusEnum = z.enum(["success", "failed", "retrying"]);

export const workflowEventClassificationEnum = z.enum([
  "validation",
  "ai_provider",
  "persistence",
  "approval",
  "email_delivery",
  "unexpected",
]);

// POST /leads/intake
export const leadIntakeRequestSchema = z.object({
  name: z.string().trim().min(1).max(200),
  email: z.string().trim().toLowerCase().email().max(320),
  company: z.string().trim().max(200).nullable().optional(),
  message: z.string().trim().min(1).max(5000),
  service: z.string().trim().max(100).nullable().optional(),
  budget: z.string().trim().max(100).nullable().optional(),
  timeline: z.string().trim().max(100).nullable().optional(),
  source: z.string().trim().max(50).nullable().optional(),
  consent_to_follow_up: z.boolean(),
  idempotency_key: z.string().trim().max(200).nullable().optional(),
});
export type LeadIntakeRequest = z.infer<typeof leadIntakeRequestSchema>;

export const leadIntakeResponseSchema = z.object({
  leadId: z.string().uuid(),
  deduped: z.boolean(),
  status: leadStatusEnum,
});
export type LeadIntakeResponse = z.infer<typeof leadIntakeResponseSchema>;

export const validationErrorResponseSchema = z.object({
  error: z.string(),
  fields: z.array(z.string()).optional(),
});
export type ValidationErrorResponse = z.infer<typeof validationErrorResponseSchema>;

// AI adapter output — validated identically regardless of mock vs. live
// provider (research.md §5).
export const leadAnalysisResultSchema = z.object({
  category: leadCategoryEnum,
  intent: leadIntentEnum,
  summary: z.string().max(500),
  urgency: leadUrgencyEnum,
  budget_band: leadBudgetBandEnum,
  timeline: z.string().nullable().optional(),
  lead_score: z.int().min(0).max(100),
  score_factors: z.array(z.string()),
  missing_information: z.array(z.string()),
  recommended_next_action: leadRecommendedNextActionEnum,
  draft_reply: z.object({
    subject: z.string().max(200),
    body: z.string(),
  }),
});
export type LeadAnalysisResult = z.infer<typeof leadAnalysisResultSchema>;

export const analyzeResponseSchema = z.object({
  leadId: z.string().uuid(),
  analysisStatus: z.enum(["completed", "failed_manual_review"]),
  analysis: leadAnalysisResultSchema.nullable().optional(),
  draftId: z.string().uuid().nullable().optional(),
});
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>;

// POST /drafts/{id}/approve
export const draftApproveRequestSchema = z.object({
  draftVersion: z.int().min(1),
  reviewerIdentity: z.string().nullable().optional(),
});
export type DraftApproveRequest = z.infer<typeof draftApproveRequestSchema>;

export const draftApproveResultEnum = z.enum(["approved", "stale_version_rejected", "already_sent"]);
export const draftApproveResponseSchema = z.object({
  result: draftApproveResultEnum,
});
export type DraftApproveResponse = z.infer<typeof draftApproveResponseSchema>;

// POST /drafts/{id}/versions — not in the OpenAPI doc verbatim; see
// contracts/n8n-webhooks.md's note that how a new ReplyDraft version
// gets created is an implementation-time decision.
export const createDraftVersionRequestSchema = z.object({
  subject: z.string().trim().min(1).max(200),
  body: z.string().trim().min(1),
});
export type CreateDraftVersionRequest = z.infer<typeof createDraftVersionRequestSchema>;

// POST /email/send
export const emailSendRequestSchema = z.object({
  draftId: z.string().uuid(),
  draftVersion: z.int().min(1),
});
export type EmailSendRequest = z.infer<typeof emailSendRequestSchema>;

export const emailSendResponseSchema = z.object({
  status: z.enum(["sent", "already_sent", "rejected_stale_version"]),
  mock: z.boolean(),
  providerResponseSafe: z.record(z.string(), z.unknown()).nullable().optional(),
});
export type EmailSendResponse = z.infer<typeof emailSendResponseSchema>;

// GET /followups/due
export const followUpEligibleSchema = z.object({
  followUpId: z.string().uuid(),
  leadId: z.string().uuid(),
  attemptNumber: z.int(),
  draftId: z.string().uuid(),
});
export type FollowUpEligible = z.infer<typeof followUpEligibleSchema>;

// POST /events
export const workflowEventRequestSchema = z.object({
  leadId: z.string().uuid().nullable().optional(),
  workflowName: z.string().min(1),
  executionReference: z.string().nullable().optional(),
  eventType: workflowEventTypeEnum,
  status: workflowEventStatusEnum,
  classification: workflowEventClassificationEnum.nullable().optional(),
  safeMetadata: z.record(z.string(), z.unknown()).optional(),
});
export type WorkflowEventRequest = z.infer<typeof workflowEventRequestSchema>;

// POST /leads/{id}/close — not in the OpenAPI doc verbatim; this demo has
// no inbound-reply-detection channel, so a reply/opt-out/manual close is
// recorded by the reviewer in the dashboard (FR-027's trigger condition).
export const leadCloseRequestSchema = z.object({
  reason: z.enum(["replied", "opted_out", "manual"]),
});
export type LeadCloseRequest = z.infer<typeof leadCloseRequestSchema>;

// POST /webhook/approval-action (n8n-webhooks.md) — not an /api/internal/*
// route, but validated with the same rigor since it is also internal-only.
export const approvalActionRequestSchema = z.object({
  action: z.enum(["approve", "edit_and_approve", "reject"]),
  draftId: z.string().uuid(),
  draftVersion: z.int().min(1),
  reviewerIdentity: z.string().nullable().optional(),
  editedSubject: z.string().max(200).nullable().optional(),
  editedBody: z.string().nullable().optional(),
});
export type ApprovalActionRequest = z.infer<typeof approvalActionRequestSchema>;
