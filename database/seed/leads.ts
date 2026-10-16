import { computeMessageFingerprint, redactEventMetadata } from "@automation-hub/business-rules";
import { MockAiAdapter } from "@automation-hub/adapters";
import { db } from "../client";
import { followUp } from "../schema/follow-up";
import { lead } from "../schema/lead";
import { leadAnalysis } from "../schema/lead-analysis";
import { replyDraft } from "../schema/reply-draft";
import { workflowEvent } from "../schema/workflow-event";

/**
 * Fictional demo leads only (constitution Principle IV) — enough to
 * exercise the dashboard's main screens without submitting anything
 * manually. Later user stories add their own seed leads to this same
 * file (approved-and-sent, scheduled-follow-up, failed-analysis).
 */
export async function seedLeads() {
  const adapter = new MockAiAdapter();

  // 1. A clean, pending-review lead with a completed analysis + draft.
  const cleanInput = {
    name: "Grace Hopper",
    email: "grace.hopper@example.com",
    message: "We'd like a new marketing website with a blog and contact form.",
    service: "website_development",
    budget: "1000_plus",
    timeline: "Within 2 months",
  };
  const [cleanLead] = await db
    .insert(lead)
    .values({
      name: cleanInput.name,
      emailNormalized: cleanInput.email,
      message: cleanInput.message,
      service: cleanInput.service,
      budgetOriginal: cleanInput.budget,
      timeline: cleanInput.timeline,
      source: "website_form",
      consentToFollowUp: true,
      messageFingerprint: computeMessageFingerprint(cleanInput.message),
      status: "pending_review",
    })
    .returning();
  if (!cleanLead) throw new Error("Failed to seed clean lead");

  const cleanAnalysis = await adapter.analyze(cleanInput);
  await db.insert(leadAnalysis).values({
    leadId: cleanLead.id,
    modelProvider: "mock",
    category: cleanAnalysis.category,
    intent: cleanAnalysis.intent,
    urgency: cleanAnalysis.urgency,
    budgetBand: cleanAnalysis.budget_band,
    leadScore: cleanAnalysis.lead_score,
    scoreFactors: cleanAnalysis.score_factors,
    missingInformation: cleanAnalysis.missing_information,
    recommendedNextAction: cleanAnalysis.recommended_next_action,
    summary: cleanAnalysis.summary,
  });
  await db.insert(replyDraft).values({
    leadId: cleanLead.id,
    version: 1,
    subject: cleanAnalysis.draft_reply.subject,
    body: cleanAnalysis.draft_reply.body,
    status: "pending_approval",
  });

  // 2. A spam-classified lead — routed to review, never auto-deleted (FR-011).
  const spamInput = {
    name: "Spammer Bot",
    email: "spam-demo@example.com",
    message: "BUY CHEAP WATCHES NOW!!! CLICK HERE http://totally-legit-watches.example CLICK HERE",
  };
  const [spamLead] = await db
    .insert(lead)
    .values({
      name: spamInput.name,
      emailNormalized: spamInput.email,
      message: spamInput.message,
      consentToFollowUp: false,
      messageFingerprint: computeMessageFingerprint(spamInput.message),
      status: "spam",
    })
    .returning();
  if (!spamLead) throw new Error("Failed to seed spam lead");

  const spamAnalysis = await adapter.analyze(spamInput);
  await db.insert(leadAnalysis).values({
    leadId: spamLead.id,
    modelProvider: "mock",
    category: spamAnalysis.category,
    intent: spamAnalysis.intent,
    urgency: spamAnalysis.urgency,
    budgetBand: spamAnalysis.budget_band,
    leadScore: spamAnalysis.lead_score,
    scoreFactors: spamAnalysis.score_factors,
    missingInformation: spamAnalysis.missing_information,
    recommendedNextAction: spamAnalysis.recommended_next_action,
    summary: spamAnalysis.summary,
  });

  // 3. An already-approved-and-sent lead — exercises the duplicate-
  // approval idempotency check (quickstart.md step 6, FR-023): re-running
  // the approval-action webhook or /email/send against this draft must
  // report already_sent, never a second delivery.
  const sentInput = {
    name: "Katherine Johnson",
    email: "katherine.johnson@example.com",
    message: "Can you help automate our weekly reporting workflow with AI?",
    service: "ai_automation",
    budget: "500_999",
    timeline: "Next quarter",
  };
  const [sentLead] = await db
    .insert(lead)
    .values({
      name: sentInput.name,
      emailNormalized: sentInput.email,
      message: sentInput.message,
      service: sentInput.service,
      budgetOriginal: sentInput.budget,
      timeline: sentInput.timeline,
      source: "website_form",
      consentToFollowUp: true,
      messageFingerprint: computeMessageFingerprint(sentInput.message),
      status: "sent",
    })
    .returning();
  if (!sentLead) throw new Error("Failed to seed already-sent lead");

  const sentAnalysis = await adapter.analyze(sentInput);
  await db.insert(leadAnalysis).values({
    leadId: sentLead.id,
    modelProvider: "mock",
    category: sentAnalysis.category,
    intent: sentAnalysis.intent,
    urgency: sentAnalysis.urgency,
    budgetBand: sentAnalysis.budget_band,
    leadScore: sentAnalysis.lead_score,
    scoreFactors: sentAnalysis.score_factors,
    missingInformation: sentAnalysis.missing_information,
    recommendedNextAction: sentAnalysis.recommended_next_action,
    summary: sentAnalysis.summary,
  });
  const now = new Date();
  await db.insert(replyDraft).values({
    leadId: sentLead.id,
    version: 1,
    subject: sentAnalysis.draft_reply.subject,
    body: sentAnalysis.draft_reply.body,
    status: "sent",
    approvedBy: "demo-reviewer@ztwebstudio.example",
    approvedAt: now,
    sentAt: now,
  });

  // 4. A consented lead whose initial reply already sent, with a
  // follow-up scheduled (not yet due) — exercises the US3 Independent
  // Test's "scheduled, not-yet-sent" state (FR-026/FR-028).
  const followUpInput = {
    name: "Ada Lovelace",
    email: "ada.lovelace@example.com",
    message: "We're exploring an AI-assisted analytics dashboard — can you help?",
    service: "ai_automation",
    budget: "1000_plus",
    timeline: "This quarter",
  };
  const [followUpLead] = await db
    .insert(lead)
    .values({
      name: followUpInput.name,
      emailNormalized: followUpInput.email,
      message: followUpInput.message,
      service: followUpInput.service,
      budgetOriginal: followUpInput.budget,
      timeline: followUpInput.timeline,
      source: "website_form",
      consentToFollowUp: true,
      messageFingerprint: computeMessageFingerprint(followUpInput.message),
      status: "sent",
    })
    .returning();
  if (!followUpLead) throw new Error("Failed to seed follow-up-scheduled lead");

  const followUpAnalysis = await adapter.analyze(followUpInput);
  await db.insert(leadAnalysis).values({
    leadId: followUpLead.id,
    modelProvider: "mock",
    category: followUpAnalysis.category,
    intent: followUpAnalysis.intent,
    urgency: followUpAnalysis.urgency,
    budgetBand: followUpAnalysis.budget_band,
    leadScore: followUpAnalysis.lead_score,
    scoreFactors: followUpAnalysis.score_factors,
    missingInformation: followUpAnalysis.missing_information,
    recommendedNextAction: followUpAnalysis.recommended_next_action,
    summary: followUpAnalysis.summary,
  });
  const sentAt = new Date();
  await db.insert(replyDraft).values({
    leadId: followUpLead.id,
    version: 1,
    subject: followUpAnalysis.draft_reply.subject,
    body: followUpAnalysis.draft_reply.body,
    status: "sent",
    approvedBy: "demo-reviewer@ztwebstudio.example",
    approvedAt: sentAt,
    sentAt,
  });
  await db.insert(followUp).values({
    leadId: followUpLead.id,
    attemptNumber: 1,
    status: "scheduled",
    scheduledAt: new Date(sentAt.getTime() + 48 * 60 * 60 * 1000),
  });

  // 5. A lead whose AI analysis failed and was routed to manual review
  // (edge case in spec.md: "the lead MUST still be stored, the AI step
  // MUST be marked failed, and the lead MUST be routed to manual review
  // rather than shown with a fabricated analysis") — exercises US4's
  // Execution Log and the Overview page's "Failed Executions" tile
  // without needing to force a live failure first.
  const failedAnalysisInput = {
    name: "Grace Murray",
    email: "grace.murray@example.com",
    message: "Could you build us an AI assistant for customer support tickets?",
    service: "ai_automation",
    budget: "1000_plus",
    timeline: "As soon as possible",
  };
  const [failedAnalysisLead] = await db
    .insert(lead)
    .values({
      name: failedAnalysisInput.name,
      emailNormalized: failedAnalysisInput.email,
      message: failedAnalysisInput.message,
      service: failedAnalysisInput.service,
      budgetOriginal: failedAnalysisInput.budget,
      timeline: failedAnalysisInput.timeline,
      source: "website_form",
      consentToFollowUp: true,
      messageFingerprint: computeMessageFingerprint(failedAnalysisInput.message),
      status: "pending_review",
    })
    .returning();
  if (!failedAnalysisLead) throw new Error("Failed to seed failed-analysis lead");

  // No lead_analysis or reply_draft row — the AI step never completed.
  // Metadata mirrors exactly what apps/dashboard/app/api/internal/leads/
  // [id]/analyze/route.ts logs on a real AI provider error.
  await db.insert(workflowEvent).values({
    leadId: failedAnalysisLead.id,
    workflowName: "wf-01-lead-intake",
    eventType: "analysis",
    status: "failed",
    classification: "ai_provider",
    safeMetadata: redactEventMetadata({ reason: "Simulated AI provider error (seed data)" }),
  });

  console.log(
    "Seeded: lead (5 rows: pending-review, spam, approved-and-sent, sent-with-scheduled-follow-up, " +
      "failed-analysis), lead_analysis (4 rows), reply_draft (3 rows), follow_up (1 row), workflow_event (1 row)",
  );
}
