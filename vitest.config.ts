import isCI from "is-ci";
import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["**/new-test/**/*.test.ts", "**/new-test/*.test.ts"],
    exclude: ["**/node_modules/**"],
    coverage: {
      enabled: process.env.COV === "1" || isCI,
      clean: true,
      cleanOnRerun: true,
      reporter: ["text", "lcovonly", "html-spa"],
    },
    // NOTE: seems to not work..
    // typecheck: {
    //   enabled: true,
    //   tsconfig: "./tsconfig.json",
    // },
  },
});
