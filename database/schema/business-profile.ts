import { sql } from "drizzle-orm";
import { pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

// Singleton configuration row read by draft generation (FR-013/FR-013a).
// Not tied to any Lead — exactly one row exists in this version
// (single-tenant). Draft generation MUST fail closed to manual review if
// no row exists yet, rather than draft with fabricated business details.
export const businessProfile = pgTable("business_profile", {
  id: uuid("id").primaryKey().defaultRandom(),
  businessName: varchar("business_name", { length: 200 }).notNull(),
  servicesOffered: text("services_offered")
    .array()
    .notNull()
    .default(sql`'{}'::text[]`),
  contactDetails: text("contact_details").notNull(),
  replyTone: varchar("reply_tone", { length: 50 }).notNull().default("professional"),
  signature: text("signature").notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type BusinessProfile = typeof businessProfile.$inferSelect;
export type NewBusinessProfile = typeof businessProfile.$inferInsert;
