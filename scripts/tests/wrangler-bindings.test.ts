// Unit tests for the wrangler.jsonc sync helpers: JSONC parsing, the
// remote-binding -> config mapping, and the drift comparison.
import { describe, expect, it } from "vitest";
// @ts-expect-error - plain-JS helper shared with the CLI script.
import {
  stripJsonc,
  wranglerFragmentFromBindings,
  diffAgainstConfig,
} from "../lib/wrangler-bindings.mjs";

describe("stripJsonc", () => {
  it("strips line and block comments", () => {
    const text = `{
      // a line comment
      "name": "boardgame", /* inline */
      /* block
         over lines */
      "count": 1
    }`;
    expect(JSON.parse(stripJsonc(text))).toEqual({ name: "boardgame", count: 1 });
  });

  it("strips trailing commas", () => {
    expect(JSON.parse(stripJsonc('{"a": [1, 2,], }'))).toEqual({ a: [1, 2] });
  });

  it("leaves comment-like text inside strings alone", () => {
    const text = '{"url": "https://x.dev//a", "glob": "/* not a comment */"}';
    expect(JSON.parse(stripJsonc(text))).toEqual({
      url: "https://x.dev//a",
      glob: "/* not a comment */",
    });
  });

  it("preserves escaped quotes in strings", () => {
    const text = '{"q": "a\\"b", // c\n"n": 1}';
    expect(JSON.parse(stripJsonc(text))).toEqual({ q: 'a"b', n: 1 });
  });
});

describe("wranglerFragmentFromBindings", () => {
  it("maps vars, d1, kv, r2, queues and secrets", () => {
    const { fragment, secrets, other } = wranglerFragmentFromBindings([
      { type: "plain_text", name: "PUSHER_HOST", text: "wss.vask.dev" },
      { type: "json", name: "FLAGS", json: { a: 1 } },
      { type: "secret_text", name: "BETTER_AUTH_SECRET" },
      { type: "d1", name: "DB", id: "db-1" },
      { type: "kv_namespace", name: "KV", namespace_id: "kv-1" },
      { type: "r2_bucket", name: "BUCKET", bucket_name: "b" },
      { type: "queue", name: "Q", queue_name: "q" },
      { type: "assets", name: "ASSETS" },
    ]);

    expect(fragment.vars).toEqual({
      PUSHER_HOST: "wss.vask.dev",
      FLAGS: { a: 1 },
    });
    expect(fragment.d1_databases).toEqual([
      { binding: "DB", database_id: "db-1" },
    ]);
    expect(fragment.kv_namespaces).toEqual([{ binding: "KV", id: "kv-1" }]);
    expect(fragment.r2_buckets).toEqual([
      { binding: "BUCKET", bucket_name: "b" },
    ]);
    expect(fragment.queues).toEqual({ producers: [{ binding: "Q", queue: "q" }] });
    expect(secrets).toEqual(["BETTER_AUTH_SECRET"]);
    // assets are deploy-time, not a hand-written binding, so they are dropped.
    expect(fragment).not.toHaveProperty("assets");
    expect(other).toEqual([]);
  });

  it("collects unmapped binding types instead of guessing", () => {
    const { fragment, other } = wranglerFragmentFromBindings([
      { type: "ratelimit", name: "RL" },
    ]);
    expect(fragment).toEqual({});
    expect(other.map((o: { type: string }) => o.type)).toEqual(["ratelimit"]);
  });

  it("tolerates a missing bindings array", () => {
    expect(wranglerFragmentFromBindings(undefined).fragment).toEqual({});
  });
});

describe("diffAgainstConfig", () => {
  const mapped = wranglerFragmentFromBindings([
    { type: "plain_text", name: "A", text: "1" },
    { type: "d1", name: "DB", id: "db-1" },
  ]);

  it("flags a database_id mismatch", () => {
    const rows = diffAgainstConfig(
      {
        vars: { A: "1" },
        d1_databases: [
          {
            binding: "DB",
            database_id: "00000000-0000-0000-0000-000000000000",
            database_name: "boardgame",
            migrations_dir: "drizzle",
          },
        ],
      },
      mapped,
    );
    const vars = rows.find((r: { label: string }) => r.label === "vars");
    const d1 = rows.find((r: { label: string }) => r.label === "d1_databases");
    expect(vars?.equal).toBe(true);
    expect(d1?.equal).toBe(false);
  });

  it("ignores key order when comparing vars", () => {
    const rows = diffAgainstConfig(
      {
        vars: { PUSHER_HOST: "wss.vask.dev", PUSHER_APP_KEY: "boardgame-byc3vc" },
        d1_databases: [{ binding: "DB", database_id: "db-1" }],
      },
      wranglerFragmentFromBindings([
        { type: "plain_text", name: "PUSHER_APP_KEY", text: "boardgame-byc3vc" },
        { type: "plain_text", name: "PUSHER_HOST", text: "wss.vask.dev" },
        { type: "d1", name: "DB", id: "db-1" },
      ]),
    );
    const vars = rows.find((r: { label: string }) => r.label === "vars");
    expect(vars?.equal).toBe(true);
  });

  it("reports equality when the config matches", () => {
    const rows = diffAgainstConfig(
      { vars: { A: "1" }, d1_databases: [{ binding: "DB", database_id: "db-1" }] },
      mapped,
    );
    expect(rows.every((r: { equal: boolean }) => r.equal)).toBe(true);
  });
});
