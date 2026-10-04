import { expect, test } from "vitest";
import { projectName } from "../index.ts";

test("projectName", () => {
  expect(projectName).toBe("Coup Rebellion G54");
});
