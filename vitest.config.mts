import { defineConfig } from "vitest/config";
import path from "node:path";

// Unit tests for pure logic only (timezone math, locale negotiation) - no DOM,
// no Next.js runtime. Run with `npm test`.
export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
