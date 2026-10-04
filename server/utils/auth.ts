import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { H3Event } from "h3";
import * as schema from "../db/schema";
import { cloudflareEnv, dbFromEnv, type CloudflareEnv } from "./db";

function createAuth(env: CloudflareEnv) {
  return betterAuth({
    database: drizzleAdapter(dbFromEnv(env), {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
  });
}

export type AppAuth = ReturnType<typeof createAuth>;

export type AuthSession = NonNullable<
  Awaited<ReturnType<AppAuth["api"]["getSession"]>>
>;

// better-auth keeps per-request state in AsyncLocalStorage rather than on the
// instance, so one instance per immutable env object is safe to share.
const authCache = new WeakMap<CloudflareEnv, AppAuth>();

export function getAuth(event: H3Event): AppAuth {
  const env = cloudflareEnv(event);
  let auth = authCache.get(env);
  if (!auth) {
    auth = createAuth(env);
    authCache.set(env, auth);
  }
  return auth;
}

export async function getAuthSession(
  event: H3Event,
): Promise<AuthSession | null> {
  return getAuth(event).api.getSession({ headers: event.headers });
}

export async function requireSession(event: H3Event): Promise<AuthSession> {
  const session = await getAuthSession(event);
  if (!session) {
    throw createError({ statusCode: 401, statusMessage: "Unauthorized" });
  }
  return session;
}
