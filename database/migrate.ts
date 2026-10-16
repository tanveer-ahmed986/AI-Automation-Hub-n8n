import "dotenv/config";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env first");
}

const migrationClient = postgres(databaseUrl, { max: 1 });

async function main() {
  const db = drizzle(migrationClient);
  await migrate(db, { migrationsFolder: "./database/migrations" });
  console.log("Migrations applied successfully.");
  await migrationClient.end();
}

main().catch((error) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
