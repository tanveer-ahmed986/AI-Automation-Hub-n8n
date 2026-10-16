import { sql } from "drizzle-orm";
import { boolean, index, pgEnum, pgTable, timestamp, uniqueIndex, uuid, varchar } from "drizzle-orm/pg-core";

// FR-016: no transition ever skips `pending_review` for a first-time send.
export const leadStatusEnum = pgEnum("lead_status", [
  "pending_review",
  "approved",
  "sent",
  "closed",
  "spam",
]);

export const lead = pgTable(
  "lead",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    name: varchar("name", { length: 200 }).notNull(),
    // Lowercased, trimmed (FR-003) — the canonical lookup key for dedup.
    emailNormalized: varchar("email_normalized", { length: 320 }).notNull(),
    company: varchar("company", { length: 200 }),
    message: varchar("message", { length: 5000 }).notNull(),
    service: varchar("service", { length: 100 }),
    // Original value preserved verbatim; normalized numeric budget is not
    // derived at the data layer (SPEC.md FR-001).
    budgetOriginal: varchar("budget_original", { length: 100 }),
    timeline: varchar("timeline", { length: 100 }),
    source: varchar("source", { length: 50 }),
    consentToFollowUp: boolean("consent_to_follow_up").notNull(),
    idempotencyKey: varchar("idempotency_key", { length: 200 }),
    // Stable hash of the normalized message — fallback dedup key (FR-005).
    messageFingerprint: varchar("message_fingerprint", { length: 64 }).notNull(),
    status: leadStatusEnum("status").notNull().default("pending_review"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("lead_idempotency_key_unique_idx")
      .on(table.idempotencyKey)
      .where(sql`${table.idempotencyKey} IS NOT NULL`),
    // Indexed range query backing the 24h fallback dedup rule (FR-005) —
    // not a full scan.
    index("lead_dedup_idx").on(table.emailNormalized, table.messageFingerprint, table.createdAt),
  ],
);

export type Lead = typeof lead.$inferSelect;
export type NewLead = typeof lead.$inferInsert;
