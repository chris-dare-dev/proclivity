import { defineConfig } from "vitest/config";
import path from "node:path";

// Standalone Vitest config (does NOT load vite.config.ts, so the crxjs/react
// build plugins never run during tests). Only the `@` alias is mirrored so the
// pure roadmap modules resolve their `@/…` imports. Dev-only — never bundled.
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
