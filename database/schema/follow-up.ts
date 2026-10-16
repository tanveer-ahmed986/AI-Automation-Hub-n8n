import { sql } from "drizzle-orm";
import { check, index, pgEnum, pgTable, smallint, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { lead } from "./lead";
import { replyDraft } from "./reply-draft";

// scheduled -> pending_approval -> approved -> sent, OR -> cancelled from
// any non-terminal state the moment a reply/closed/opt-out is recorded
// for the Lead (FR-027).
export const followUpStatusEnum = pgEnum("follow_up_status", [
  "scheduled",
  "pending_approval",
  "approved",
  "sent",
  "cancelled",
]);

export const followUp = pgTable(
  "follow_up",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => lead.id),
    scheduledAt: timestamp("scheduled_at", { withTimezone: true }).notNull(),
    // 1-based attempt counter, capped by the configured max (FR-028) — the
    // scheduler simply does not create a row past the cap.
    attemptNumber: smallint("attempt_number").notNull(),
    status: followUpStatusEnum("status").notNull().default("scheduled"),
    // Set only once this attempt transitions scheduled -> pending_approval
    // and a ReplyDraft row exists to review (WF-03 step, FollowUpEligible
    // contract in contracts/internal-api.openapi.yaml).
    draftId: uuid("draft_id").references(() => replyDraft.id),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    cancelledAt: timestamp("cancelled_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("follow_up_lead_id_attempt_number_unique_idx").on(table.leadId, table.attemptNumber),
    index("follow_up_status_scheduled_at_idx").on(table.status, table.scheduledAt),
    check("follow_up_attempt_number_positive", sql`${table.attemptNumber} >= 1`),
  ],
);

export type FollowUp = typeof followUp.$inferSelect;
export type NewFollowUp = typeof followUp.$inferInsert;
