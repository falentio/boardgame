import { drizzleAdapter } from "@better-auth/drizzle-adapter";
import { betterAuth } from "better-auth/minimal";
import type { H3Event } from "h3";
import * as schema from "../db/schema";
import { cloudflareEnv, dbFromEnv, type CloudflareEnv } from "./db";

// Hostnames the app is served from during local dev and previews. `*.localhost`
// does not match the bare `localhost`, so it is listed separately. For
// `falentio` only subdomains are trusted (`app.falentio`), never the apex.
const LOCAL_HOSTNAMES = ["localhost", "*.localhost", "*.falentio"] as const;

// Expands each hostname into better-auth origin patterns: `host` covers the
// default port and `host:*` any other, for both schemes.
const localTrustedOrigins: readonly string[] = LOCAL_HOSTNAMES.flatMap(
  (host) => [
    `http://${host}`,
    `http://${host}:*`,
    `https://${host}`,
    `https://${host}:*`,
  ],
);

function createAuth(env: CloudflareEnv) {
  return betterAuth({
    database: drizzleAdapter(dbFromEnv(env), {
      provider: "sqlite",
      schema,
    }),
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    emailAndPassword: { enabled: true },
    trustedOrigins: [...localTrustedOrigins],
  });
}

export type AppAuth = ReturnType<typeof createAuth>;

export type AuthSession = NonNullable<
  Awaited<ReturnType<AppAuth["api"]["getSession"]>>
>;

// better-auth keeps per-request state in AsyncLocalStorage rather than on the
// instance, so one instance per immutable env object is safe to share.
const authCache = new WeakMap<CloudflareEnv, AppAuth>();

export function authFromEnv(env: CloudflareEnv): AppAuth {
  let auth = authCache.get(env);
  if (!auth) {
    auth = createAuth(env);
    authCache.set(env, auth);
  }
  return auth;
}

export function getAuth(event: H3Event): AppAuth {
  return authFromEnv(cloudflareEnv(event));
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
