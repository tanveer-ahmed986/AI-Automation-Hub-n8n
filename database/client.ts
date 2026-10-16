import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema/index";

// Lazily initialized: Next.js's route-handler build step imports this
// module to collect page data without ever executing a request, so
// connecting (or even reading a required env var) at module-eval time
// breaks `next build` in an environment that has no DATABASE_URL yet.
let cachedDb: PostgresJsDatabase<typeof schema> | undefined;

function getDb(): PostgresJsDatabase<typeof schema> {
  if (!cachedDb) {
    const databaseUrl = process.env.DATABASE_URL;
    if (!databaseUrl) {
      throw new Error("DATABASE_URL is not set");
    }
    cachedDb = drizzle(postgres(databaseUrl, { onnotice: () => {} }), { schema });
  }
  return cachedDb;
}

export const db: PostgresJsDatabase<typeof schema> = new Proxy({} as PostgresJsDatabase<typeof schema>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});
export { schema };
