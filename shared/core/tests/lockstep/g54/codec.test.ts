import { expect, test } from "vitest";
import { CodecError, expectObject } from "../../../index.ts";
import { actionCodec, type G54Action } from "../../../lockstep/games/g54/actions.ts";
import { G54Error } from "../../../lockstep/games/g54/error.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { stateCodec } from "../../../lockstep/games/g54/state.ts";
import { ANN, BOB, CARA, SEATS3, STARTER, advance, crafted, rawGenesis, seatsOwedAt } from "./driver.ts";

const ACTIONS: readonly G54Action[] = [
  { t: "claim", role: "banker", target: null },
  { t: "claim", role: "guerrilla", target: BOB },
  { t: "claim", role: "arms-dealer", target: null, named: "banker" },
  { t: "claim", role: "arms-dealer", target: null, named: null },
  { t: "income" },
  { t: "coup", target: BOB },
  { t: "bank" },
  { t: "social-media" },
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

test("action codec omits `named` when it is absent", () => {
  const encoded = actionCodec.encode({ t: "claim", role: "banker", target: null });
  expect(encoded).toEqual({ t: "claim", role: "banker", target: null });
  expect(actionCodec.decode(encoded)).toEqual({ t: "claim", role: "banker", target: null });
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

test("state codec round-trips every Anarchy field", () => {
  const base = rawGenesis(
    ["financier", "director", "anarchist", "arms-dealer", "socialist"],
    SEATS3,
    "codec-anarchy",
  );
  const state = {
    ...base,
    bank: 4,
    socialMedia: true,
    bomb: { holder: BOB, prior: [ANN], move: "pass" as const },
    socialist: { seat: ANN, givers: [BOB], pool: ["banker" as const] },
    plantation: [ANN, CARA],
    arms: { seat: ANN, named: "banker" as const, cards: ["banker" as const], matched: true },
  };
  expect(stateCodec.decode(stateCodec.encode(state))).toEqual(state);
});

test("state codec round-trips a defused Bomb and a null sub-state", () => {
  const base = rawGenesis(STARTER, SEATS3, "codec-bomb-null");
  const state = {
    ...base,
    bomb: { holder: BOB, prior: [ANN, CARA], move: "defuse" as const },
    socialist: null,
    plantation: null,
    arms: null,
  };
  expect(stateCodec.decode(stateCodec.encode(state))).toEqual(state);
});

test("state codec round-trips every step kind, extras, resigned, draw target, and pending field", () => {
  const base = rawGenesis(STARTER, SEATS3, "codec-full");
  const extra = {
    kind: "capitalist" as const,
    claimant: BOB,
    role: "capitalist" as const,
    target: ANN,
    blockRole: null,
    blocker: null,
    challenger: CARA,
    blockChallenger: null,
  };
  const state = {
    ...base,
    extras: [extra],
    resigned: [CARA],
    draw: { seat: ANN, pool: ["banker" as const], keepSize: 2, target: BOB },
    pending: {
      kind: "role" as const,
      claimant: ANN,
      role: "judge" as const,
      target: BOB,
      named: "banker" as const,
      cost: 3,
      costTo: "target" as const,
      blockRole: "judge" as const,
      blocker: null,
      challenger: null,
      blockChallenger: null,
      funded: true,
    },
    steps: [
      {
        kind: "window" as const,
        window: {
          kind: "oneOf" as const,
          purpose: "reveal" as const,
          seats: [ANN],
          cause: "execution" as const,
        },
      },
      { kind: "begin" as const, extra },
      { kind: "resolve" as const },
      { kind: "settle" as const, seat: CARA },
      { kind: "end-turn" as const },
    ],
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
  expect(g54.version).toBe(4);
  expect(seatsOwedAt(rawGenesis(STARTER, SEATS3, "codec-access"))).toEqual([ANN]);
});
