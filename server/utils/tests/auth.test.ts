import { afterEach, beforeEach, expect, test } from "vitest";
import { createTestDb, type TestDb } from "../../modules/rooms/tests/d1-harness.ts";
import { authFromEnv } from "../auth.ts";

let harness: TestDb;

beforeEach(async () => {
  harness = await createTestDb();
});

afterEach(async () => {
  await harness.dispose();
});

// `isTrustedOrigin` is the exact predicate better-auth's origin middleware
// consults, resolved against the live config (baseURL + trustedOrigins). It is
// used directly because the middleware itself is disabled under NODE_ENV=test.
const isTrusted = async (origin: string): Promise<boolean> =>
  (await authFromEnv(harness.env).$context).isTrustedOrigin(origin);

const TRUSTED = [
  "http://localhost",
  "http://localhost:3000",
  "https://localhost:5173",
  "http://app.localhost",
  "http://app.localhost:3000",
  "https://deep.sub.localhost:8080",
  "http://boardgame.falentio",
  "http://boardgame.falentio:3000",
  "https://preview.falentio:8443",
];

const UNTRUSTED = [
  "http://falentio",
  "https://falentio",
  "http://evil.com:3000",
  "http://localhost.evil.com",
  "http://evilfalentio:3000",
  "http://app.falentio.evil.com",
  "http://notlocalhost:3000",
];

test.each(TRUSTED)("trusts %s", async (origin) => {
  expect(await isTrusted(origin)).toBe(true);
});

test.each(UNTRUSTED)("does not trust %s", async (origin) => {
  expect(await isTrusted(origin)).toBe(false);
});
