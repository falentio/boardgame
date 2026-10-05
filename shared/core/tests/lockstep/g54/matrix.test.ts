/**
 * The role-file oracle. Every catalog role must have a test file at
 * `roles/{category}/{role}.test.ts`, and that file must declare the role's
 * matrix record and call its `describeMatrix`/`describeReactiveMatrix`. This
 * replaces the in-file `MATRIX`/`REACTIVE_MATRIX` registries: the records now
 * live beside each role's bespoke tests, and this test enumerates the directory
 * by glob (importing a `.test.ts` would re-run it) to prove the layout is whole.
 */
import { expect, test } from "vitest";
import { asRoleId, ROLE_CATALOG, specOf } from "../../../lockstep/games/g54/roles.ts";

const REACTIVE = new Set(["intellectual", "lawyer", "missionary"]);

const modules = import.meta.glob("./roles/**/*.test.ts", {
  eager: true,
  query: "?raw",
  import: "default",
}) as Record<string, string>;

/** role id -> { category, source } for every role test file on disk. */
const files = new Map(
  Object.entries(modules).map(([path, source]) => {
    const parts = path.split("/");
    const file = parts[parts.length - 1] ?? "";
    const id = file.replace(/\.test\.ts$/, "");
    const category = parts[parts.length - 2] ?? "";
    return [id, { category, source }] as const;
  }),
);

test("oracle: every catalog role has a test file that declares its matrix record", () => {
  for (const spec of ROLE_CATALOG) {
    const entry = files.get(spec.id);
    expect(entry, `roles/.../${spec.id}.test.ts exists`).toBeDefined();
    if (entry === undefined) continue;
    expect(entry.source, `${spec.id} calls its matrix describe`).toMatch(
      REACTIVE.has(spec.id) ? /describeReactiveMatrix\("/ : /describeMatrix\("/,
    );
    expect(entry.source, `${spec.id} declares a record`).toMatch(
      /const record: (Role|Reactive)Record = \{/,
    );
  }
});

test("oracle: no role test file exists for a non-catalog id", () => {
  const ids = new Set(ROLE_CATALOG.map((spec) => spec.id));
  for (const id of files.keys()) expect(ids.has(asRoleId(id)), `${id} is in the catalog`).toBe(true);
});

test("oracle: each role file sits under its category directory", () => {
  for (const [id, entry] of files) {
    expect(entry.category, `${id} sits under its category`).toBe(specOf(asRoleId(id)).category);
  }
});
