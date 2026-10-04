import { expect, test } from "vitest";
import { CodecError, expectObject } from "../../../index.ts";
import { actionCodec, type G54Action } from "../../../lockstep/games/g54/actions.ts";
import { G54Error } from "../../../lockstep/games/g54/error.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { stateCodec } from "../../../lockstep/games/g54/state.ts";
import { ANN, BOB, SEATS3, STARTER, advance, crafted, rawGenesis, seatsOwedAt } from "./driver.ts";

const ACTIONS: readonly G54Action[] = [
  { t: "claim", role: "banker", target: null },
  { t: "claim", role: "guerrilla", target: BOB },
  { t: "income" },
  { t: "coup", target: BOB },
  { t: "challenge" },
  { t: "pass" },
  { t: "block", role: "guerrilla" },
  { t: "show" },
  { t: "concede" },
  { t: "reveal", index: 1 },
  { t: "keep", indices: [0, 2] },
  { t: "give", index: 1 },
  { t: "pay" },
  { t: "no" },
];

test("action codec round-trips every action variant", () => {
  for (const action of ACTIONS) {
    expect(actionCodec.decode(actionCodec.encode(action))).toEqual(action);
  }
});

test("action codec rejects an unknown tag and a bad role", () => {
  expect(() => actionCodec.decode({ t: "teleport" })).toThrow(G54Error);
  expect(() => actionCodec.decode({ t: "claim", role: "wizard", target: null })).toThrow(G54Error);
  expect(() => actionCodec.decode({ t: "keep", indices: ["a"] })).toThrow(CodecError);
  expect(() => actionCodec.decode({ t: "reveal" })).toThrow(CodecError);
});

test("state codec round-trips a genesis state and a mid-turn state", () => {
  const genesis = rawGenesis(STARTER, SEATS3, "codec");
  expect(stateCodec.decode(stateCodec.encode(genesis))).toEqual(genesis);

  let state = crafted("codec-mid");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "director", target: null } : null,
  );
  state = advance(state, () => null);
  // The Director keep window is open: the step stack and the draw pool are live.
  expect(stateCodec.decode(stateCodec.encode(state))).toEqual(state);
});

test("state codec rejects a malformed payload at the boundary", () => {
  expect(() => stateCodec.decode(null)).toThrow(CodecError);
  expect(() => stateCodec.decode({})).toThrow(CodecError);
  const good = expectObject(stateCodec.encode(rawGenesis(STARTER, SEATS3, "codec-bad")), "state");
  expect(() => stateCodec.decode({ ...good, treasury: 1.5 })).toThrow(CodecError);
  expect(() =>
    stateCodec.decode({
      ...good,
      steps: [{ kind: "window", window: { kind: "oneOf", purpose: "turn", seats: [] } }],
    }),
  ).toThrow();
});

test("state codec round-trips a state carrying every new token field", () => {
  const base = rawGenesis(
    ["banker", "writer", "mercenary", "foreign-consular", "intellectual"],
    SEATS3,
    "codec-tokens",
  );
  const state = {
    ...base,
    peacekeeping: ANN,
    treaty: [ANN, BOB],
    tax: { role: "banker" as const, holder: BOB },
    disappear: [{ target: BOB, turns: 1 }],
    extras: [],
  };
  expect(stateCodec.decode(stateCodec.encode(state))).toEqual(state);
});

test("state codec rejects an unknown extra kind and a bad loss cause", () => {
  const good = expectObject(stateCodec.encode(rawGenesis(STARTER, SEATS3, "codec-bad2")), "state");
  expect(() =>
    stateCodec.decode({
      ...good,
      extras: [
        {
          kind: "teleport",
          claimant: ANN,
          role: "banker",
          target: BOB,
          blockRole: null,
          blocker: null,
          challenger: null,
          blockChallenger: null,
        },
      ],
    }),
  ).toThrow(G54Error);
  expect(() =>
    stateCodec.decode({
      ...good,
      steps: [
        {
          kind: "window",
          window: { kind: "oneOf", purpose: "reveal", seats: [ANN], cause: "bad" },
        },
      ],
    }),
  ).toThrow(G54Error);
});

test("g54's public codec accessors are the same objects it folds with", () => {
  expect(g54.state).toBe(stateCodec);
  expect(g54.action).toBe(actionCodec);
  expect(g54.id).toBe("g54");
  expect(g54.version).toBe(3);
  expect(seatsOwedAt(rawGenesis(STARTER, SEATS3, "codec-access"))).toEqual([ANN]);
});
