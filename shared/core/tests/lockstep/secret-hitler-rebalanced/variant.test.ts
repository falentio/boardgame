import { expect, test } from "vitest";
import {
  decodeSnapshot,
  encodeSnapshot,
  frameIndex,
  genesisSeed,
  makeRandom,
  makeRoster,
  stateDigest,
  type Checkpoint,
  type Json,
  type SeatId,
  type Snapshot,
} from "../../../index.ts";
import {
  actionCodec,
  type SecretHitlerAction,
} from "../../../lockstep/games/secret-hitler/actions.ts";
import { secretHitler } from "../../../lockstep/games/secret-hitler/index.ts";
import { countPolicies, POLICY_MIX } from "../../../lockstep/games/secret-hitler/policies.ts";
import { isTerminal, seatsOwed, step } from "../../../lockstep/games/secret-hitler/reducer.ts";
import type { PlayerCount } from "../../../lockstep/games/secret-hitler/roles.ts";
import type { SecretHitlerState } from "../../../lockstep/games/secret-hitler/state.ts";
import { legalActions, project } from "../../../lockstep/games/secret-hitler/view.ts";
import {
  REBALANCE_DELTA,
  secretHitlerRebalanced,
  variantMixFor,
} from "../../../lockstep/games/secret-hitler-rebalanced/index.ts";
import { driveRaw, seatsFor, type FramePolicy } from "../secret-hitler/driver.ts";

const COUNTS: readonly PlayerCount[] = [5, 6, 7, 8, 9, 10];
const IDENTITY_COUNTS: readonly PlayerCount[] = [5, 8, 10];
const DELTA_COUNTS: readonly PlayerCount[] = [6, 7, 9];

const checkpointFor = (
  genesis: (roster: ReturnType<typeof makeRoster>, rng: ReturnType<typeof makeRandom>) => SecretHitlerState,
  count: PlayerCount,
  entropy: string,
): Checkpoint<SecretHitlerState> => {
  const roster = makeRoster(seatsFor(count));
  const seed = genesisSeed(entropy);
  return { state: genesis(roster, makeRandom(seed)), roster, frame: frameIndex(0), seed };
};

const baseGenesis = (count: PlayerCount, entropy: string): Checkpoint<SecretHitlerState> =>
  checkpointFor((roster, rng) => secretHitler.genesis({}, roster, rng), count, entropy);

const variantGenesis = (count: PlayerCount, entropy: string): Checkpoint<SecretHitlerState> =>
  checkpointFor((roster, rng) => secretHitlerRebalanced.genesis({}, roster, rng), count, entropy);

const digest = (state: SecretHitlerState): string =>
  stateDigest(secretHitlerRebalanced.state.encode(state));

/** A policy that plays toward the viewer's own team, reading only the redacted view. */
const teamPolicy: FramePolicy = (state, seat) => {
  const view = project(state, seat);
  const options = legalActions(view);
  if (options.length === 0) return null;
  const liberal = view.myRole === "liberal";
  if (view.phase.kind === "vote") {
    const ja = options.find((action) => action.t === "vote" && action.ja);
    const nein = options.find((action) => action.t === "vote" && !action.ja);
    return liberal ? (ja ?? nein ?? null) : (nein ?? ja ?? null);
  }
  if (view.phase.kind === "president-discard" && view.myDrawn !== null) {
    const want = liberal ? "liberal" : "fascist";
    const index = view.myDrawn.findIndex((card) => card === want);
    return { t: "discard", index: index >= 0 ? index : 0 };
  }
  if (view.phase.kind === "chancellor-enact" && view.myOffered !== null) {
    const want = liberal ? "liberal" : "fascist";
    const index = view.myOffered.findIndex((card) => card === want);
    return { t: "enact", index: index >= 0 ? index : 0 };
  }
  return options[0] ?? null;
};

test("the variant has its own id and version, distinct from the base", () => {
  expect(secretHitlerRebalanced.id).toBe("secret-hitler-rebalanced");
  expect(secretHitlerRebalanced.version).toBe(1);
  expect(secretHitlerRebalanced.id).not.toBe(secretHitler.id);
});

test("the variant reuses the base reducer, view, and action codec by reference", () => {
  // Identity, not behavior: a copy would pass a behavior check and still drift.
  expect(secretHitlerRebalanced.step).toBe(step);
  expect(secretHitlerRebalanced.seatsOwed).toBe(seatsOwed);
  expect(secretHitlerRebalanced.isTerminal).toBe(isTerminal);
  expect(secretHitlerRebalanced.project).toBe(project);
  expect(secretHitlerRebalanced.action).toBe(actionCodec);
});

test("the delta table changes exactly 6, 7, and 9, and nothing else", () => {
  const changed = COUNTS.filter(
    (count) =>
      REBALANCE_DELTA[count].preEnactedFascist !== 0 ||
      REBALANCE_DELTA[count].fascistSupply !== POLICY_MIX.fascist,
  );
  expect(changed).toEqual([...DELTA_COUNTS]);
  expect(REBALANCE_DELTA[6]).toEqual({ preEnactedFascist: 1, fascistSupply: POLICY_MIX.fascist });
  expect(REBALANCE_DELTA[7]).toEqual({ preEnactedFascist: 0, fascistSupply: 10 });
  expect(REBALANCE_DELTA[9]).toEqual({ preEnactedFascist: 0, fascistSupply: 9 });
  for (const count of IDENTITY_COUNTS) {
    expect(REBALANCE_DELTA[count]).toEqual({
      preEnactedFascist: 0,
      fascistSupply: POLICY_MIX.fascist,
    });
  }
});

test("a 6-player game starts with one fascist policy already enacted", () => {
  const state = variantGenesis(6, "variant-6").state;
  expect(state.fascistPolicies).toBe(1);
  expect(state.liberalPolicies).toBe(0);
  expect(countPolicies(state.drawPile)).toEqual({ liberal: 6, fascist: 10 });
});

test("a 7-player game holds 10 fascist policies in the deck", () => {
  const state = variantGenesis(7, "variant-7").state;
  expect(state.fascistPolicies).toBe(0);
  expect(countPolicies(state.drawPile)).toEqual({ liberal: 6, fascist: 10 });
});

test("a 9-player game holds 9 fascist policies in the deck", () => {
  const state = variantGenesis(9, "variant-9").state;
  expect(state.fascistPolicies).toBe(0);
  expect(countPolicies(state.drawPile)).toEqual({ liberal: 6, fascist: 9 });
});

test("genesis conserves the base liberal supply and the variant fascist total", () => {
  for (const count of COUNTS) {
    const state = variantGenesis(count, `variant-conserve-${String(count)}`).state;
    const mix = variantMixFor(count);
    const inDeck = countPolicies(state.drawPile);
    expect(inDeck.liberal + state.liberalPolicies).toBe(mix.liberal);
    expect(inDeck.fascist + state.fascistPolicies).toBe(mix.fascist);
  }
});

test("genesis is byte-identical to the base at 5, 8, and 10", () => {
  for (const count of IDENTITY_COUNTS) {
    const base = digest(baseGenesis(count, `variant-same-${String(count)}`).state);
    const variant = digest(variantGenesis(count, `variant-same-${String(count)}`).state);
    expect(variant).toBe(base);
  }
});

test("genesis diverges from the base exactly at 6, 7, and 9", () => {
  for (const count of COUNTS) {
    const base = digest(baseGenesis(count, `variant-diverge-${String(count)}`).state);
    const variant = digest(variantGenesis(count, `variant-diverge-${String(count)}`).state);
    expect(variant === base).toBe(!DELTA_COUNTS.includes(count));
  }
});

test("base and variant encode the same bytes at 5, 8, and 10, so a peer can agree", () => {
  for (const count of IDENTITY_COUNTS) {
    const base = secretHitler.state.encode(baseGenesis(count, "variant-bytes").state);
    const variant = secretHitlerRebalanced.state.encode(variantGenesis(count, "variant-bytes").state);
    expect(variant).toEqual(base);
  }
});

test("the variant codec round-trips at every count", () => {
  for (const count of COUNTS) {
    const state = variantGenesis(count, `variant-codec-${String(count)}`).state;
    expect(secretHitlerRebalanced.state.decode(secretHitlerRebalanced.state.encode(state))).toEqual(
      state,
    );
  }
});

test("the variant codec rejects a state whose fascist supply is off by one", () => {
  const state = variantGenesis(7, "variant-codec-reject").state;
  const json = secretHitlerRebalanced.state.encode(state) as { [key: string]: unknown };
  const drawPile = [...(json.drawPile as readonly string[]), "fascist"];
  expect(() =>
    secretHitlerRebalanced.state.decode({ ...json, drawPile } as never),
  ).toThrow();
});

test("the 6-player codec rejects a base-shaped state: the pre-enactment is not optional", () => {
  // At 6 players the supply is the base 11, so conservation alone cannot tell the
  // pre-enacted policy from a deck tile. Only the pre-enactment floor rejects it.
  const state = variantGenesis(6, "variant-pre-enact-floor").state;
  const json = secretHitlerRebalanced.state.encode(state) as { [key: string]: Json };
  const baseShape: Json = {
    ...json,
    fascistPolicies: 0,
    drawPile: [
      ...Array<Json>(POLICY_MIX.liberal).fill("liberal"),
      ...Array<Json>(POLICY_MIX.fascist).fill("fascist"),
    ],
  };
  expect(() => secretHitlerRebalanced.state.decode(baseShape)).toThrow(/pre-enacted/);

  // The same leak through the joiner's path: a frame-0 snapshot carrying the
  // base shape must not decode into a variant session.
  const roster = makeRoster(seatsFor(6));
  const snapshot: Snapshot<SecretHitlerAction> = {
    gameId: secretHitlerRebalanced.id,
    version: secretHitlerRebalanced.version,
    frame: frameIndex(0),
    seed: genesisSeed("variant-pre-enact-floor"),
    roster,
    state: baseShape,
    head: null,
    deadline: null,
  };
  expect(() =>
    decodeSnapshot(secretHitlerRebalanced, encodeSnapshot(secretHitlerRebalanced, snapshot)),
  ).toThrow(/pre-enacted/);

  // A legitimate 6-player state still decodes: the floor is 1, not an exact match.
  expect(secretHitlerRebalanced.state.decode(json)).toEqual(state);
});

test("the base codec rejects a variant state, so the parameterized supply is load-bearing", () => {
  // Proves the seam is required: the base hard-codes 6/11 and cannot decode a 7-player variant.
  const state = variantGenesis(7, "variant-base-rejects").state;
  expect(() => secretHitler.state.decode(secretHitler.state.encode(state))).toThrow();
});

test("base and variant stay byte-identical through a full game at 5, 8, and 10", () => {
  for (const count of IDENTITY_COUNTS) {
    let base = baseGenesis(count, `variant-drive-${String(count)}`);
    let variant = variantGenesis(count, `variant-drive-${String(count)}`);
    let steps = 0;
    while (!isTerminal(base.state) && steps < 3000) {
      expect(digest(variant.state)).toBe(digest(base.state));
      base = driveRaw(base, teamPolicy, steps);
      variant = driveRaw(variant, teamPolicy, steps);
      steps += 1;
    }
    expect(isTerminal(base.state)).toBe(true);
    expect(digest(variant.state)).toBe(digest(base.state));
  }
});

test("a seat's owed set and terminal test come from the shared fold, not a variant copy", () => {
  const state = variantGenesis(6, "variant-owed").state;
  const index = frameIndex(0);
  expect(secretHitlerRebalanced.seatsOwed(state, index)).toEqual(secretHitler.seatsOwed(state, index));
  expect(secretHitlerRebalanced.isTerminal(state)).toBe(secretHitler.isTerminal(state));
  const seat: SeatId = seatsFor(6)[0]!;
  expect(secretHitlerRebalanced.project(state, seat)).toEqual(secretHitler.project(state, seat));
});

test("two peers at one seed agree at 6, 7, and 9, and a snapshot round-trips to the same digests", () => {
  for (const count of DELTA_COUNTS) {
    const entropy = `variant-peers-${String(count)}`;
    const roster = makeRoster(seatsFor(count));
    const seed = genesisSeed(entropy);
    const first = variantGenesis(count, entropy).state;
    const second = secretHitlerRebalanced.genesis({}, roster, makeRandom(seed));
    expect(digest(second)).toBe(digest(first));

    const snapshot: Snapshot<SecretHitlerAction> = {
      gameId: secretHitlerRebalanced.id,
      version: secretHitlerRebalanced.version,
      frame: frameIndex(0),
      seed,
      roster,
      state: secretHitlerRebalanced.state.encode(first),
      head: null,
      deadline: null,
    };
    const decoded = decodeSnapshot(
      secretHitlerRebalanced,
      encodeSnapshot(secretHitlerRebalanced, snapshot),
    );
    expect(decoded.gameId).toBe(secretHitlerRebalanced.id);
    expect(decoded.frame).toBe(frameIndex(0));
    expect(stateDigest(decoded.state)).toBe(digest(first));
    expect(stateDigest(decoded.state)).toBe(digest(second));
  }
});
