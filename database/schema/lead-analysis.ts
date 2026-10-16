import { sql } from "drizzle-orm";
import { check, pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { lead } from "./lead";

export const leadCategoryEnum = pgEnum("lead_category", [
  "website_development",
  "ai_automation",
  "consulting",
  "other",
  "unknown",
]);

export const leadIntentEnum = pgEnum("lead_intent", [
  "new_project",
  "support",
  "partnership",
  "spam",
  "other",
  "unknown",
]);

export const leadUrgencyEnum = pgEnum("lead_urgency", ["low", "medium", "high", "unknown"]);

export const leadBudgetBandEnum = pgEnum("lead_budget_band", [
  "unknown",
  "under_100",
  "100_499",
  "500_999",
  "1000_plus",
]);

export const leadRecommendedNextActionEnum = pgEnum("lead_recommended_next_action", [
  "approve_reply",
  "request_clarification",
  "manual_review",
  "mark_spam",
]);

export const leadAnalysis = pgTable(
  "lead_analysis",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // UNIQUE enforces 1:1 for MVP (data-model.md).
    leadId: uuid("lead_id")
      .notNull()
      .references(() => lead.id),
    modelProvider: varchar("model_provider", { length: 50 }).notNull(),
    modelName: varchar("model_name", { length: 100 }),
    category: leadCategoryEnum("category").notNull(),
    intent: leadIntentEnum("intent").notNull(),
    urgency: leadUrgencyEnum("urgency").notNull(),
    budgetBand: leadBudgetBandEnum("budget_band").notNull(),
    // FR-008: integer 0-100, advisory only.
    leadScore: smallint("lead_score").notNull(),
    scoreFactors: text("score_factors")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    missingInformation: text("missing_information")
      .array()
      .notNull()
      .default(sql`'{}'::text[]`),
    recommendedNextAction: leadRecommendedNextActionEnum("recommended_next_action").notNull(),
    summary: varchar("summary", { length: 500 }).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_analysis_lead_id_unique_idx").on(table.leadId),
    check("lead_analysis_lead_score_range", sql`${table.leadScore} BETWEEN 0 AND 100`),
  ],
);

export type LeadAnalysis = typeof leadAnalysis.$inferSelect;
export type NewLeadAnalysis = typeof leadAnalysis.$inferInsert;
