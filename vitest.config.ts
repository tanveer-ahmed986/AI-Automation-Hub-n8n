import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    name: "unit",
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "packages/*/src/**/*.test.ts"],
    exclude: ["tests/integration/**", "node_modules/**", "**/.next/**"],
  },
});
