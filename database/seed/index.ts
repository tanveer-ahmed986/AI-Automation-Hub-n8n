import "dotenv/config";
import { sql } from "drizzle-orm";
import { db } from "../client";
import { seedBusinessProfile } from "./business-profile";
import { seedLeads } from "./leads";

type SeedFn = () => Promise<void>;

// Later user stories append their own seed modules here — each is its
// own file per tasks.md, run in order from this single entrypoint.
// BusinessProfile first: lead seeding doesn't depend on it today, but
// draft generation always should (FR-013a).
const seeds: SeedFn[] = [seedBusinessProfile, seedLeads];

const SEEDED_TABLES = [
  "follow_up",
  "reply_draft",
  "lead_analysis",
  "workflow_event",
  "lead",
  "business_profile",
] as const;

async function truncateSeededTables() {
  for (const table of SEEDED_TABLES) {
    await db.execute(sql.raw(`TRUNCATE TABLE "${table}" CASCADE`));
  }
}

async function main() {
  await truncateSeededTables();

  if (seeds.length === 0) {
    console.log("No seed fixtures registered yet.");
    return;
  }

  for (const seed of seeds) {
    await seed();
  }
  console.log(`Seed complete: ${seeds.length} fixture group(s) applied.`);
}

main()
  .catch((error) => {
    console.error("Seed failed:", error);
    process.exitCode = 1;
  })
  .finally(() => {
    process.exit(process.exitCode ?? 0);
  });
