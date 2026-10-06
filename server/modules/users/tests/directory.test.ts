import { afterEach, beforeEach, expect, test } from "vitest";
import { userId } from "../../../../shared/rooms/ids.ts";
import { authFromEnv } from "../../../utils/auth.ts";
import type { Db } from "../../../utils/db.ts";
import { createTestDb, type TestDb } from "../../rooms/tests/d1-harness.ts";
import { occupantsOf } from "../directory.ts";

const ORIGIN = "http://localhost:3000";

let harness: TestDb;

beforeEach(async () => {
  harness = await createTestDb();
});

afterEach(async () => {
  await harness.dispose();
});

const signUp = async (email: string): Promise<string> => {
  const auth = authFromEnv(harness.env);
  const response = await auth.handler(
    new Request(`${ORIGIN}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin: ORIGIN },
      body: JSON.stringify({ email, password: "password-123", name: email }),
    }),
  );
  if (response.status !== 200) throw new Error(`sign-up failed: ${response.status}`);
  const body = (await response.json()) as { user: { id: string } };
  return body.user.id;
};

test("occupantsOf resolves identity for distinct ids", async () => {
  const host = await signUp("host@example.com");
  const guest = await signUp("guest@example.com");
  const directory = await occupantsOf(harness.db, [userId(host), userId(guest), userId(host)]);
  expect(directory.size).toBe(2);
  expect(directory.get(userId(host))).toEqual({ name: "host@example.com", image: null });
  expect(directory.get(userId(guest))).toEqual({ name: "guest@example.com", image: null });
});

test("occupantsOf omits an id with no user row", async () => {
  const host = await signUp("host@example.com");
  const directory = await occupantsOf(harness.db, [userId(host), userId("user-missing")]);
  expect(directory.has(userId("user-missing"))).toBe(false);
  expect(directory.get(userId(host))).toEqual({ name: "host@example.com", image: null });
});

test("occupantsOf never queries on an empty id list", async () => {
  const exploding = {
    select: () => {
      throw new Error("occupantsOf queried an empty id list");
    },
  } as unknown as Db;
  const directory = await occupantsOf(exploding, []);
  expect(directory.size).toBe(0);
});
