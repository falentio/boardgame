import { drizzle, type DrizzleD1Database } from "drizzle-orm/d1";
import { getPlatformProxy } from "wrangler";
import { schema, type AppSchema } from "../../../db/schema.ts";
import type { CloudflareEnv } from "../../../utils/db.ts";

declare global {
  // `vite/client` is path-mapped in the server tsconfig but is not a module and
  // cannot be imported; augment the one helper we use so the harness typechecks.
  interface ImportMeta {
    glob(
      pattern: string,
      options: { query: string; import: string; eager: true },
    ): Record<string, string>;
  }
}

export interface TestDb {
  readonly db: DrizzleD1Database<AppSchema>;
  readonly env: CloudflareEnv;
  dispose(): Promise<void>;
}

const migrations = import.meta.glob("../../../../drizzle/*.sql", {
  query: "?raw",
  import: "default",
  eager: true,
});

const migrationStatements = (): readonly string[] =>
  Object.keys(migrations)
    .sort()
    .flatMap((name) =>
      (migrations[name] ?? "")
        .split("--> statement-breakpoint")
        .map((statement) => statement.trim())
        .filter((statement) => statement.length > 0),
    );

export const createTestDb = async (): Promise<TestDb> => {
  const proxy = await getPlatformProxy<CloudflareEnv>({
    configPath: "wrangler.jsonc",
    persist: false,
  });
  for (const statement of migrationStatements()) {
    await proxy.env.DB.prepare(statement).run();
  }
  return {
    db: drizzle(proxy.env.DB, { schema }),
    env: proxy.env,
    dispose: () => proxy.dispose(),
  };
};
