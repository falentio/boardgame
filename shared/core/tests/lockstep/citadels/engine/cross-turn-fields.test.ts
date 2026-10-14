import { expect, test } from "vitest";
import type { Json } from "../../../../index.ts";
import { stateCodec, type CitadelsState } from "../../../../lockstep/games/citadels/state.ts";
import { citadels } from "../../../../lockstep/games/citadels/index.ts";
import { ANN, SEATS4, rawGenesis } from "../driver.ts";

const CROSS_TURN_FIELDS = ["robbed", "bewitched", "threats", "warrants", "taxPot"] as const;

const DEFAULTS = {
  robbed: null,
  bewitched: null,
  threats: [],
  warrants: [],
  taxPot: 0,
} as const;

/** A genesis state with all five cross-turn fields set to non-default values. */
const seeded = (): CitadelsState => ({
  ...rawGenesis(SEATS4),
  robbed: "king",
  bewitched: "warlord",
  threats: ["bishop", "merchant"],
  warrants: ["magician", "thief", "architect"],
  taxPot: 7,
});

/** The encoded state with one field removed, to prove the wire contract is total. */
const without = (json: Json, key: string): Json => {
  const object = json as { readonly [k: string]: Json };
  return Object.fromEntries(Object.entries(object).filter(([k]) => k !== key));
};

test("the codec round-trips a state with all five cross-turn fields set", () => {
  const state = seeded();
  const encoded = stateCodec.encode(state);
  for (const key of CROSS_TURN_FIELDS) {
    expect(Object.hasOwn(encoded as object, key)).toBe(true);
  }
  const decoded = stateCodec.decode(encoded);
  expect(decoded.robbed).toBe("king");
  expect(decoded.bewitched).toBe("warlord");
  // Order is load-bearing: the targeted marker is first, the decoys follow.
  expect(decoded.threats).toEqual(["bishop", "merchant"]);
  expect(decoded.warrants).toEqual(["magician", "thief", "architect"]);
  expect(decoded.taxPot).toBe(7);
  expect(decoded).toEqual(state);
});

test("the codec rejects a state missing any one of the five cross-turn fields", () => {
  const encoded = stateCodec.encode(seeded());
  for (const key of CROSS_TURN_FIELDS) {
    expect(() => stateCodec.decode(without(encoded, key))).toThrow();
  }
});

test("the codec rejects a cross-turn field of the wrong type", () => {
  const encoded = stateCodec.encode(seeded()) as { readonly [k: string]: Json };
  expect(() => stateCodec.decode({ ...encoded, robbed: 5 })).toThrow();
  expect(() => stateCodec.decode({ ...encoded, bewitched: false })).toThrow();
  expect(() => stateCodec.decode({ ...encoded, threats: "bishop" })).toThrow();
  expect(() => stateCodec.decode({ ...encoded, warrants: ["nonesuch"] })).toThrow();
  expect(() => stateCodec.decode({ ...encoded, taxPot: 1.5 })).toThrow();
});

test("genesis populates every cross-turn field with its default", () => {
  const state = rawGenesis(SEATS4);
  expect(state.robbed).toBe(DEFAULTS.robbed);
  expect(state.bewitched).toBe(DEFAULTS.bewitched);
  expect(state.threats).toEqual(DEFAULTS.threats);
  expect(state.warrants).toEqual(DEFAULTS.warrants);
  expect(state.taxPot).toBe(DEFAULTS.taxPot);
});

test("no cross-turn field crosses project: the view is redacted", () => {
  const state = seeded();
  for (const seat of SEATS4) {
    const view = citadels.project(state, seat);
    for (const key of CROSS_TURN_FIELDS) {
      expect(Object.hasOwn(view, key)).toBe(false);
    }
    for (const player of view.players) {
      for (const key of CROSS_TURN_FIELDS) {
        expect(Object.hasOwn(player, key)).toBe(false);
      }
    }
  }
});

test("the cross-turn fields are engine bookkeeping: the view is identical with and without them", () => {
  const plain = rawGenesis(SEATS4);
  const marked = seeded();
  expect(citadels.project(marked, ANN)).toEqual(citadels.project(plain, ANN));
});
