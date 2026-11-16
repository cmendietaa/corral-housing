import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The extraction benchmark (eval/run.eval.ts). Separate from the unit tests:
// it can call a paid API, so it never runs in CI. See eval/README.md.
export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) }
  },
  test: {
    include: ["eval/run.eval.ts"],
    testTimeout: 30 * 60 * 1000
  }
});
