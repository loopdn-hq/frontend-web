import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

/**
 * Unit and component tests.
 *
 * Deliberately separate from `next build`: these run the modules directly
 * rather than through Next, which is what keeps a test of the Embedded Signup
 * hook down to the hook and a fake SDK. Nothing here may reach the network -
 * the Facebook SDK and the API module are both mocked in every test.
 */
export default defineConfig({
  plugins: [react()],
  // Set here rather than in the setup file: ES imports hoist, so React is
  // already loaded by the time a statement in setup could set this, and React
  // reads it when it initialises.
  define: { "globalThis.IS_REACT_ACT_ENVIRONMENT": "true" },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text-summary", "json-summary", "html"],
      // Every source file counts, tested or not: a file nobody imported from
      // a test would otherwise be missing from the total rather than 0%.
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "src/**/*.test.{ts,tsx}",
        "src/test/**",
        "src/**/*.d.ts",
        // Type declarations only - nothing in these runs.
        "src/**/types.ts",
      ],
      thresholds: {
        statements: 90,
        branches: 90,
        functions: 90,
        lines: 90,
      },
    },
  },
});
