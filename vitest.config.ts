import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: [
      "shared/core/tests/**/*.test.ts",
      "shared/rooms/tests/**/*.test.ts",
      "shared/users/tests/**/*.test.ts",
      "server/modules/rooms/tests/**/*.test.ts",
      "server/modules/realtime/tests/**/*.test.ts",
      "app/composables/tests/**/*.test.ts",
    ],
    environment: "node",
  },
});
