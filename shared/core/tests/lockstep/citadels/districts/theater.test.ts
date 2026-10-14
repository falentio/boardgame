import { expect, test } from "vitest";
import { genesisSeed, makeRandom, type SeatId } from "../../../../index.ts";
import { DISTRICT_HOOKS } from "../../../../lockstep/games/citadels/districts.ts";
import { UNIQUE_SCORING } from "../../../../lockstep/games/citadels/districts/effects.ts";
import { scoreGame } from "../../../../lockstep/games/citadels/scoring.ts";
import {
  theater,
  theaterScoring,
  theaterResolve,
  theaterTriggers,
} from "../../../../lockstep/games/citadels/districts/theater.ts";
import { applyEndRound } from "../../../../lockstep/games/citadels/helpers.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import type { CitadelsState, Claim, Step } from "../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  CARA,
  DAN,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawRandom,
} from "../driver.ts";

const SWAP_WINDOW: Step = {
  kind: "window",
  window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] },
};

/** A turn-phase state with the round's claims set and the theatre-swap window on top. */
const turnState = (claimed: readonly Claim[]): CitadelsState => ({
  ...rawGenesis(SEATS3, BASE_CAST_IDS),
  phase: "turn",
  draft: null,
  claimed,
  callRank: 1,
  active: ANN,
  steps: [SWAP_WINDOW, { kind: "call" }, { kind: "end-round" }],
});

/** ANN's two characters (rank 1 assassin, rank 2 thief) against BOB's two. */
const twoEach = (bob: readonly CharacterId[]): readonly Claim[] => [
  { seat: ANN, character: "assassin" },
  { seat: ANN, character: "thief" },
  { seat: BOB, character: bob[0]! },
  { seat: BOB, character: bob[1]! },
  { seat: CARA, character: "bishop" },
  { seat: CARA, character: "architect" },
];

const charactersOf = (state: CitadelsState, seat: SeatId): readonly CharacterId[] =>
  state.claimed.filter((claim) => claim.seat === seat).map((claim) => claim.character);

const allCharacters = (state: CitadelsState): readonly CharacterId[] =>
  [...state.claimed.map((claim) => claim.character)].sort();

const chooseTarget = (state: CitadelsState, seat: SeatId | null): CitadelsState =>
  advance(state, (s) => (s === ANN && seat !== null ? { t: "target", seat } : null));

/** The owner answers the swap with the give-choice index into its claims in rank order. */
const giveChoice = (state: CitadelsState, index: number): CitadelsState =>
  advance(state, (s) => (s === ANN ? { t: "keep", index } : null));

test("the Theater swaps its owner's claimed character for a random one from a chosen rival", () => {
  const state = turnState(twoEach(["king", "merchant"]));
  const next = chooseTarget(state, BOB);
  // A target-only answer names the blind rival; with no give-choice named the
  // engine defaults to the owner's lowest-rank claim (assassin).
  expect(charactersOf(next, ANN)).toHaveLength(2);
  expect(charactersOf(next, ANN)).toContain("thief");
  const received = charactersOf(next, ANN).find((id) => id !== "thief");
  expect(["king", "merchant"]).toContain(received);
  // The rival now holds the owner's default (lowest-rank) character.
  expect(charactersOf(next, BOB)).toContain("assassin");
  // A true exchange: every character stays in play exactly once.
  expect(allCharacters(next)).toEqual(allCharacters(state));
});

test("the rival is chosen blindly: the swap reads no character identity from the target", () => {
  // The action names a seat, never a character, so the owner cannot see the rival's card.
  const state = turnState(twoEach(["king", "merchant"]));
  const next = chooseTarget(state, BOB);
  expect(next).not.toBe(state);
  expect(openPurpose(next)).not.toBe("theatre-swap");
  // Two states differing only in the rival's characters both resolve: legality is
  // blind to what the rival holds.
  const other = turnState(twoEach(["bishop", "architect"]));
  const swapped = chooseTarget(other, BOB);
  expect(openPurpose(swapped)).not.toBe("theatre-swap");
  const received = charactersOf(swapped, ANN).find((id) => id !== "thief");
  expect(["bishop", "architect"]).toContain(received);
});

test("the random pick is a uniform draw over the rival's claimed characters, by position", () => {
  const state = turnState(twoEach(["king", "merchant"]));
  // The resolver's only rng use is one int(2) over the rival's two claims.
  const expected = makeRandom(genesisSeed("citadels-raw-tests")).int(2);
  const taken = ["king", "merchant"][expected];
  const next = chooseTarget(state, BOB);
  expect(charactersOf(next, ANN)).toContain(taken);
  expect(charactersOf(next, BOB)).not.toContain(taken);
});

test("naming your own seat leaves both claim sets untouched", () => {
  const state = turnState(twoEach(["king", "merchant"]));
  const next = chooseTarget(state, ANN);
  expect(next.claimed).toEqual(state.claimed);
  expect(openPurpose(next)).not.toBe("theatre-swap");
});

test("an absent target leaves both claim sets untouched", () => {
  const state = turnState(twoEach(["king", "merchant"]));
  const next = chooseTarget(state, null);
  expect(next.claimed).toEqual(state.claimed);
  expect(openPurpose(next)).not.toBe("theatre-swap");
});

test("a target who is not at the table leaves both claim sets untouched", () => {
  const state = turnState(twoEach(["king", "merchant"]));
  const next = chooseTarget(state, DAN);
  expect(next.claimed).toEqual(state.claimed);
  expect(openPurpose(next)).not.toBe("theatre-swap");
});

test("a resigned target leaves both claim sets untouched", () => {
  const state: CitadelsState = {
    ...turnState(twoEach(["king", "merchant"])),
    resigned: [BOB],
  };
  const next = chooseTarget(state, BOB);
  expect(next.claimed).toEqual(state.claimed);
  expect(openPurpose(next)).not.toBe("theatre-swap");
});

test("a 2-3 player owner gives the claim it chooses, not always the lowest", () => {
  const state = turnState(twoEach(["king", "merchant"]));
  const before = charactersOf(state, ANN);
  // rules.json (theatre): "In 2-3 player games you choose which of your two
  // characters to give and randomly take one of your opponent's." The owner
  // chooses the higher-rank claim (index 1 = thief); a resolver that always gives
  // the lowest would keep thief and hand over assassin, failing both rows below.
  const next = giveChoice(state, 1);
  expect(charactersOf(next, ANN)).not.toContain("thief");
  expect(charactersOf(next, ANN)).toContain("assassin");
  expect(charactersOf(next, BOB)).toContain("thief");
  expect(charactersOf(next, ANN)).not.toEqual(before);
});

test("the Theater declares the onRoundStart hook, a member of DISTRICT_HOOKS", () => {
  expect(theaterTriggers).toEqual(["onRoundStart"]);
  expect(DISTRICT_HOOKS).toContain("onRoundStart");
});

test("the Theater still scores no end-game points of its own", () => {
  const city = [{ id: "theater", gold: 0 }];
  expect(theaterScoring(city[0]!, city, ANN, rawGenesis(SEATS3))).toBe(0);
});

test("the Theater's effect opens the theatre-swap window owed by its owner", () => {
  const base = turnState([]);
  const player = base.players.find((p) => p.seat === ANN)!;
  const opened = theater({ state: base, owner: ANN, city: player.city, rest: [], rng: rawRandom() });
  expect(openPurpose(opened)).toBe("theatre-swap");
  const top = opened.steps[0];
  if (top === undefined || top.kind !== "window") throw new Error("no window");
  expect(top.window.seats).toEqual([ANN]);
});

test("the resolver pops a theatre-swap window it does not own", () => {
  const state: CitadelsState = {
    ...turnState(twoEach(["king", "merchant"])),
    steps: [
      { kind: "window", window: { kind: "oneOf", purpose: "keep", seats: [ANN] } },
      { kind: "end-round" },
    ],
  };
  const next = theaterResolve({
    state,
    window: { kind: "oneOf", purpose: "keep", seats: [ANN] },
    frame: { index: 0 as never, seed: "0000000000000000" as never, inputs: [] },
    rng: rawRandom(),
  });
  expect(next.claimed).toEqual(state.claimed);
  expect(next.steps[0]).toMatchObject({ kind: "end-round" });
});

test("applyEndRound opens the round-start window for the Theater's owner, above the new draft", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS);
  const state: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: [],
    steps: [{ kind: "end-round" }],
    players: base.players.map((player) =>
      player.seat === ANN ? { ...player, city: [{ id: "theater", gold: 0 }] } : player,
    ),
  };
  const next = applyEndRound(state, rawRandom());
  expect(next.phase).toBe("draft");
  // The draft's first pick is on top; the swap waits below until claims are set.
  expect(openPurpose(next)).toBe("draft-pick");
  const swap = next.steps.find(
    (step) => step.kind === "window" && step.window.purpose === "theatre-swap",
  );
  expect(swap).toBeDefined();
  if (swap === undefined || swap.kind !== "window") throw new Error("no swap window");
  expect(swap.window.seats).toEqual([ANN]);
});

test("a round that starts with a Theater resolves the swap against the drafted claims", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS);
  const armed: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: [],
    steps: [{ kind: "end-round" }],
    players: base.players.map((player) =>
      player.seat === ANN ? { ...player, city: [{ id: "theater", gold: 0 }] } : player,
    ),
  };
  let state = applyEndRound(armed, rawRandom());
  // Run the draft; the engine opens the swap window once every seat has claimed.
  let guard = 0;
  while (openPurpose(state) !== "theatre-swap" && guard < 50) {
    state = advance(state, () => null);
    guard += 1;
  }
  expect(openPurpose(state)).toBe("theatre-swap");
  const before = charactersOf(state, ANN);
  const rival = state.claimed.find((claim) => claim.seat !== ANN)!.seat;
  const after = chooseTarget(state, rival);
  expect(after.claimed).not.toEqual(state.claimed);
  expect(charactersOf(after, ANN)).not.toEqual(before);
  // The claim count per seat is unchanged by the swap.
  expect(charactersOf(after, ANN)).toHaveLength(before.length);
});

/**
 * The Theater's end-game scoring seam: its unique points are exactly zero, the
 * crafted-city total is its cost sum plus colour and completion bonuses, and its
 * scoring function and round-start trigger are the ones the registry holds.
 */
const withCity = (state: CitadelsState, seat: SeatId, ids: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((player) =>
    player.seat === seat ? { ...player, city: ids.map((id) => ({ id, gold: 0 })) } : player,
  ),
});

/**
 * A city that reaches every scoring term: the Theater (unique), one district of
 * each of the other four types, and a first-completed-city bonus.
 */
const scored = (): CitadelsState =>
  withCity(
    { ...rawGenesis(SEATS3, BASE_CAST_IDS), completed: [ANN] },
    ANN,
    ["theater", "manor", "temple", "tavern", "watchtower"],
  );

test("the Theater adds no end-game points of its own", () => {
  const city = [
    { id: "theater", gold: 0 },
    { id: "manor", gold: 0 },
  ];
  expect(theaterScoring(city[0]!, city, ANN, rawGenesis(SEATS3))).toBe(0);
});

test("a crafted city scores exactly its cost sum, colour bonus, and completion bonus", () => {
  const score = scoreGame(scored()).find((entry) => entry.seat === ANN);
  // Costs: theater 3 + manor 3 + temple 1 + tavern 1 + watchtower 1 = 9.
  expect(score?.districts).toBe(9);
  // All five district types are present.
  expect(score?.colors).toBe(3);
  // First to complete.
  expect(score?.completion).toBe(4);
  // The Theater's swap ability earns no end-game points.
  expect(score?.unique).toBe(0);
  expect(score?.total).toBe(16);
});

test("the Theater's unique points are exactly zero; dropping it changes only cost and colour", () => {
  const state = scored();
  const score = scoreGame(state).find((entry) => entry.seat === ANN);
  const withoutTheater = withCity(state, ANN, ["manor", "temple", "tavern", "watchtower"]);
  const bare = scoreGame(withoutTheater).find((entry) => entry.seat === ANN);
  // Removing the Theater costs its 3 gold of cost and the 3-point five-type
  // bonus (the unique type leaves), never any Theater-specific bonus.
  expect((score?.total ?? 0) - (bare?.total ?? 0)).toBe(6);
  expect(score?.unique).toBe(0);
  expect(bare?.unique).toBe(0);
});

test("the Theater registers its own scoring function and the onRoundStart trigger", () => {
  expect(UNIQUE_SCORING["theater"]).toBe(theaterScoring);
  expect(theaterTriggers).toEqual(["onRoundStart"]);
});

test("the Theater's scoring is not a no-op on the total: a spurious bonus would move it", () => {
  const score = scoreGame(scored()).find((entry) => entry.seat === ANN);
  // 9 + 3 + 4 = 16 with no unique points; any spurious Theater bonus breaks this.
  expect(score?.total).toBe(16);
});

test("the theatre-swap window resolver exists and pops the window", () => {
  const state: CitadelsState = {
    ...rawGenesis(SEATS3, BASE_CAST_IDS),
    steps: [
      { kind: "window", window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] } },
      { kind: "end-round" },
    ],
  };
  const next = theaterResolve({
    state,
    window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] },
    frame: { index: 0 as never, seed: "0000000000000000" as never, inputs: [] },
    rng: rawRandom(),
  });
  expect(next.steps[0]).toMatchObject({ kind: "end-round" });
});
