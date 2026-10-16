import { pgEnum, pgTable, smallint, text, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";
import { lead } from "./lead";

// pending_approval -> approved -> sent | pending_approval -> rejected
// (terminal, FR-019). A new edit creates a new row at version + 1; it
// never mutates a previous version's row (audit trail, FR-020).
export const replyDraftStatusEnum = pgEnum("reply_draft_status", [
  "pending_approval",
  "approved",
  "rejected",
  "sent",
]);

export const replyDraft = pgTable(
  "reply_draft",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    leadId: uuid("lead_id")
      .notNull()
      .references(() => lead.id),
    version: smallint("version").notNull(),
    subject: varchar("subject", { length: 200 }).notNull(),
    body: text("body").notNull(),
    status: replyDraftStatusEnum("status").notNull().default("pending_approval"),
    approvedBy: varchar("approved_by", { length: 200 }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    sentAt: timestamp("sent_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [uniqueIndex("reply_draft_lead_id_version_unique_idx").on(table.leadId, table.version)],
);

export type ReplyDraft = typeof replyDraft.$inferSelect;
export type NewReplyDraft = typeof replyDraft.$inferInsert;
