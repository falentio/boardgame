import {
  drizzle,
  type AnyD1Database,
  type DrizzleD1Database,
} from "drizzle-orm/d1";
import type { H3Event } from "h3";
import { schema, type AppSchema } from "../db/schema";

export interface CloudflareEnv {
  DB: AnyD1Database;
  BETTER_AUTH_SECRET: string;
  BETTER_AUTH_URL: string;
}

export type Db = DrizzleD1Database<AppSchema>;

// Keyed by the env object, which is immutable for an isolate's lifetime, so a
// cached db can never go stale.
const dbCache = new WeakMap<CloudflareEnv, Db>();

export function dbFromEnv(env: CloudflareEnv): Db {
  let db = dbCache.get(env);
  if (!db) {
    db = drizzle(env.DB, { schema });
    dbCache.set(env, db);
  }
  return db;
}

// Exported so getAuth can key its cache by the same env object without becoming
// a second reader of event.context.cloudflare.
export function cloudflareEnv(event: H3Event): CloudflareEnv {
  const env = event.context.cloudflare?.env as CloudflareEnv | undefined;

  if (!env?.DB) {
    throw createError({
      statusCode: 500,
      statusMessage:
        'Missing D1 binding "DB". Add a d1_databases entry with binding "DB" to wrangler.jsonc.',
    });
  }

  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Missing or too-short BETTER_AUTH_SECRET (need >= 32 chars). Set it in .dev.vars locally and via `wrangler secret put BETTER_AUTH_SECRET` in production.",
    });
  }

  if (!env.BETTER_AUTH_URL) {
    throw createError({
      statusCode: 500,
      statusMessage:
        "Missing BETTER_AUTH_URL. Set it in .dev.vars locally and via `wrangler secret put BETTER_AUTH_URL` in production.",
    });
  }

  return env;
}

export function useDb(event: H3Event): Db {
  return dbFromEnv(cloudflareEnv(event));
}
