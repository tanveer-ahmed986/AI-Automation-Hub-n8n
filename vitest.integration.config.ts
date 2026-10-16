import { defineConfig } from "vitest/config";

// Integration tests make real HTTP calls against the Docker Compose
// stack (dashboard + Postgres + n8n) — see research.md §3. They are not
// run as part of `pnpm test` and require `docker compose up -d` first.
export default defineConfig({
  test: {
    name: "integration",
    environment: "node",
    include: ["tests/integration/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
