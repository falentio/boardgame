import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["shared/core/tests/**/*.test.ts"],
    environment: "node",
  },
});
