import "dotenv/config";
import { defineConfig } from "drizzle-kit";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set — copy .env.example to .env first");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./database/schema/index.ts",
  out: "./database/migrations",
  dbCredentials: {
    url: databaseUrl,
  },
});
