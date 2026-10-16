import { sql } from "drizzle-orm";
import { index, jsonb, pgEnum, pgTable, timestamp, uuid, varchar } from "drizzle-orm/pg-core";
import { lead } from "./lead";

export const workflowEventTypeEnum = pgEnum("workflow_event_type", [
  "intake",
  "analysis",
  "approval",
  "delivery",
  "follow_up",
  "error",
]);

export const workflowEventStatusEnum = pgEnum("workflow_event_status", [
  "success",
  "failed",
  "retrying",
]);

// FR-039. Only set when status != 'success'.
export const workflowEventClassificationEnum = pgEnum("workflow_event_classification", [
  "validation",
  "ai_provider",
  "persistence",
  "approval",
  "email_delivery",
  "unexpected",
]);

export const workflowEvent = pgTable(
  "workflow_event",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    // Nullable: intake-validation failures may have no lead yet.
    leadId: uuid("lead_id").references(() => lead.id),
    workflowName: varchar("workflow_name", { length: 100 }).notNull(),
    executionReference: varchar("execution_reference", { length: 200 }),
    eventType: workflowEventTypeEnum("event_type").notNull(),
    status: workflowEventStatusEnum("status").notNull(),
    classification: workflowEventClassificationEnum("classification"),
    // Redacted summary only — never raw secrets/tokens/stack traces
    // (FR-041). Redaction happens before insert, not here.
    safeMetadata: jsonb("safe_metadata").notNull().default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    index("workflow_event_lead_created_idx").on(table.leadId, table.createdAt),
    index("workflow_event_status_classification_idx").on(table.status, table.classification),
  ],
);

export type WorkflowEvent = typeof workflowEvent.$inferSelect;
export type NewWorkflowEvent = typeof workflowEvent.$inferInsert;
