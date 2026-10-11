import { expect, test } from "vitest";
import { genesisSeed, makeRandom, makeRoster, stateDigest, type SeatId } from "../../../index.ts";
import { citadels, scoreGame, specOfCharacter, winnerOf } from "../../../lockstep/games/citadels/index.ts";
import { stateCodec } from "../../../lockstep/games/citadels/state.ts";
import { BASIC_DISTRICTS, DEFAULT_UNIQUES } from "../../../lockstep/games/citadels/districts.ts";
import { at } from "../harness.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  CAST9,
  PRESET_CAST_IDS,
  SEATS3,
  SEATS4,
  SEATS5,
  SEATS6,
  autoAction,
  autoStep,
  framesToEnd,
  rawGenesis,
  replayFrames,
  sealedFrames,
  setup,
  tableOf,
  totalCards,
  type CharacterId,
  type CitadelsState,
  type CitadelsView,
} from "./driver.ts";

const FULL_DECK = BASIC_DISTRICTS.reduce((n, spec) => n + spec.copies, 0) + DEFAULT_UNIQUES.length;
const FRAME_BUDGET = 5000;
const SEAT_SETS = [SEATS3, SEATS4, SEATS5, SEATS6] as const;

/**
 * Three distinct legal casts. The catalog fixes every character's rank but does
 * not enumerate the rulebook's six preset cast lists, so the third is a legal
 * set assembled from that rank table rather than a quoted preset.
 */
const CASTS: readonly (readonly [string, readonly CharacterId[]])[] = [
  ["base", BASE_CAST_IDS],
  ["rank-9-artist", CAST9],
  ["catalog-ranks", PRESET_CAST_IDS],
];

/** Fold a raw game to terminal under the always-legal policy, counting frames. */
const playRaw = (
  seats: readonly SeatId[],
  cast: readonly CharacterId[],
  entropy: string,
): { readonly state: CitadelsState; readonly frames: number } => {
  let state = rawGenesis(seats, cast, entropy);
  let frames = 0;
  while (!citadels.isTerminal(state) && frames < FRAME_BUDGET) {
    state = autoStep(state);
    frames += 1;
  }
  return { state, frames };
};

const goldOf = (state: CitadelsState, seat: SeatId): number =>
  state.players.find((player) => player.seat === seat)?.gold ?? 0;

/**
 * The documented tie-breaks: highest total, then most district points, then most
 * gold. Seats tied on all three have no winner.
 */
const documentedWinner = (state: CitadelsState): SeatId | null => {
  const scores = scoreGame(state);
  const best = [...scores].sort(
    (a, b) =>
      b.total - a.total ||
      b.districts - a.districts ||
      goldOf(state, b.seat) - goldOf(state, a.seat),
  )[0];
  if (best === undefined) return null;
  const tied = scores.filter(
    (row) =>
      row.total === best.total &&
      row.districts === best.districts &&
      goldOf(state, row.seat) === goldOf(state, best.seat),
  );
  return tied.length === 1 ? best.seat : null;
};

test("a full game reaches terminal under the frame budget for 3, 4, 5, and 6 seats", () => {
  for (const seats of SEAT_SETS) {
    const { state, frames } = playRaw(seats, BASE_CAST_IDS, "citadels-probe");
    expect(citadels.isTerminal(state), "seat count " + String(seats.length)).toBe(true);
    expect(state.phase).toBe("over");
    expect(frames).toBeGreaterThan(0);
    expect(frames, "seat count " + String(seats.length)).toBeLessThan(FRAME_BUDGET);
  }
});

test("terminal games resolve to exactly one winner, or a documented tie, for every seat count", () => {
  for (const seats of SEAT_SETS) {
    const { state } = playRaw(seats, BASE_CAST_IDS, "citadels-probe");
    expect(citadels.isTerminal(state)).toBe(true);
    expect(scoreGame(state).map((row) => row.seat).sort()).toEqual([...seats].sort());
    expect(winnerOf(state), "seat count " + String(seats.length)).toBe(documentedWinner(state));
  }
});

test("three distinct casts each reach terminal with a resolved winner under the frame budget", () => {
  for (const [name, cast] of CASTS) {
    for (const seats of SEAT_SETS) {
      const label = name + "/" + String(seats.length);
      const { state, frames } = playRaw(seats, cast, "citadels-cast-" + label);
      expect(citadels.isTerminal(state), label).toBe(true);
      expect(state.phase).toBe("over");
      expect(frames, label).toBeLessThan(FRAME_BUDGET);
      expect(winnerOf(state), label).toBe(documentedWinner(state));
    }
  }
});

test("the rank-9 cast and the catalog-ranks cast each carry exactly one rank-9 character", () => {
  for (const cast of [CAST9, PRESET_CAST_IDS]) {
    const rank9 = cast.filter((id) => specOfCharacter(id).rank === 9);
    expect(rank9).toHaveLength(1);
    expect(rawGenesis(SEATS4, cast, "citadels-cast-rank9").cast).toContain(rank9[0]);
  }
});

test("project exposes the viewer's own hand and never the deck order or another seat's hand", () => {
  const state = rawGenesis(SEATS4, BASE_CAST_IDS, "citadels-redaction");
  const view: CitadelsView = citadels.project(state, ANN);
  expect(Object.keys(view)).not.toContain("deck");
  expect(Object.keys(view)).not.toContain("draft");
  expect(Object.keys(view)).not.toContain("pool");
  expect(Object.keys(view)).not.toContain("facedown");
  expect(Object.keys(view)).toContain("myHand");
  expect(Object.keys(view)).toContain("deckCount");
  for (const player of view.players) {
    expect(Object.keys(player).sort()).toEqual(["city", "gold", "handCount", "seat"]);
  }
  // Non-vacuity: the raw state does carry those keys, so their absence from the
  // view is a real omission rather than an empty source.
  expect(Object.keys(state)).toContain("deck");
  expect(Object.keys(state.players[0] ?? {})).toContain("hand");
});

test("for every seat, project redacts the deck order and every other seat's hand", () => {
  let state = rawGenesis(SEATS5, BASE_CAST_IDS, "citadels-redaction-seats");
  while (state.phase !== "turn") state = autoStep(state);

  for (const seat of SEATS5) {
    const view = citadels.project(state, seat);
    const mine = state.players.find((player) => player.seat === seat);
    if (mine === undefined) throw new Error("missing player");

    expect(Object.keys(view)).not.toContain("deck");
    expect(view.myHand).toEqual([...mine.hand]);
    expect(view.deckCount).toBe(state.deck.length);
    expect(
      Object.values(view).some(
        (value) =>
          Array.isArray(value) &&
          value.length === state.deck.length &&
          value.every((id, index) => id === state.deck[index]),
      ),
      "no view field carries the deck order",
    ).toBe(false);

    for (const player of view.players) {
      expect(Object.keys(player)).not.toContain("hand");
      const raw = state.players.find((candidate) => candidate.seat === player.seat);
      expect(player.handCount).toBe(raw?.hand.length);
    }
  }
});

test("project reveals the viewer's own draft pick and hides every other seat's", () => {
  let state = rawGenesis(SEATS4, BASE_CAST_IDS, "citadels-redaction-draft");
  const picker = state.draft?.picker;
  if (picker === undefined) throw new Error("genesis must be in the draft");
  state = autoStep(state);
  const picked = state.draft?.picks.find((entry) => entry.seat === picker);
  if (picked === undefined) throw new Error("the picker did not pick");

  const view = citadels.project(state, picker);
  expect(view.myPick).toBe(picked.character);
  expect(Object.keys(view)).not.toContain("draft");
  expect(view.myHand).toEqual(state.players.find((player) => player.seat === picker)?.hand);

  for (const seat of SEATS4) {
    if (seat === picker) continue;
    expect(citadels.project(state, seat).myPick).toBeNull();
  }
});

test("two independent tables folding the same frames reach an identical terminal digest", () => {
  const a = tableOf(SEATS4, CAST9, "citadels-converge");
  const frames = framesToEnd(a, autoAction, FRAME_BUDGET);
  expect(at(a, ANN).terminal).toBe(true);
  expect(frames).toBeLessThan(FRAME_BUDGET);

  const b = tableOf(SEATS4, CAST9, "citadels-converge");
  replayFrames(b, sealedFrames(a));
  expect(at(b, ANN).terminal).toBe(true);

  const stateA = at(a, ANN).snapshot().state;
  const stateB = at(b, ANN).snapshot().state;
  expect(stateDigest(stateB)).toBe(stateDigest(stateA));
  expect(stateB).toEqual(stateA);

  // Non-vacuity: stateDigest commits to the whole state, so any perturbation of
  // a field a peer could have diverged on changes it.
  const tampered: CitadelsState = { ...stateA, round: stateA.round + 1 };
  expect(stateDigest(stateCodec.encode(tampered))).not.toBe(stateDigest(stateA));
});

test("the district deck is conserved at the deck size after every frame of a whole game", () => {
  for (const seats of SEAT_SETS) {
    const label = String(seats.length);
    let state = rawGenesis(seats, BASE_CAST_IDS, "citadels-conserve");
    let frames = 0;
    while (!citadels.isTerminal(state) && frames < FRAME_BUDGET) {
      expect(totalCards(state), "mid-game " + label).toBe(FULL_DECK);
      state = autoStep(state);
      frames += 1;
    }
    expect(citadels.isTerminal(state), label).toBe(true);
    expect(totalCards(state), "terminal " + label).toBe(FULL_DECK);
  }
});

test("genesis with the same seed and cast yields an identical state", () => {
  for (const [name, cast] of CASTS) {
    for (const seats of SEAT_SETS) {
      const entropy = "citadels-determinism-" + name + "/" + String(seats.length);
      const a = rawGenesis(seats, cast, entropy);
      const b = rawGenesis(seats, cast, entropy);
      expect(stateCodec.encode(b)).toEqual(stateCodec.encode(a));
      expect(stateDigest(stateCodec.encode(b))).toBe(stateDigest(stateCodec.encode(a)));
    }
  }
});

test("a genesis state and its codec round-trip agree, so two peers start from the same bytes", () => {
  const roster = makeRoster(SEATS3);
  const seed = genesisSeed("citadels-determinism-genesis");
  const a = citadels.genesis(setup(CAST9), roster, makeRandom(seed));
  const b = citadels.genesis(setup(CAST9), roster, makeRandom(seed));
  expect(stateDigest(stateCodec.encode(b))).toBe(stateDigest(stateCodec.encode(a)));
  expect(stateCodec.decode(stateCodec.encode(a))).toEqual(a);
});

test("at terminal every seat scores and the top scorer wins under the documented tie-breaks", () => {
  for (const seats of SEAT_SETS) {
    const { state } = playRaw(seats, BASE_CAST_IDS, "citadels-probe");
    const label = String(seats.length);
    expect(citadels.isTerminal(state), label).toBe(true);
    const scores = scoreGame(state);
    expect(scores.map((row) => row.seat).sort()).toEqual([...seats].sort());
    for (const row of scores) {
      expect(row.total).toBe(row.districts + row.colors + row.completion + row.unique);
    }
    const winner = winnerOf(state);
    expect(winner, label).toBe(documentedWinner(state));
    if (winner !== null) {
      const max = scores.reduce((n, row) => Math.max(n, row.total), 0);
      expect(scores.find((row) => row.seat === winner)?.total).toBe(max);
    }
  }
});

test("winnerOf breaks a tie on district points, then gold", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "citadels-tiebreak");
  const withCities = (
    cities: readonly (readonly [SeatId, readonly { readonly id: string; readonly cards?: readonly string[] }[]])[],
  ): CitadelsState => ({
    ...base,
    players: base.players.map((player) => {
      const entry = cities.find(([seat]) => seat === player.seat);
      if (entry === undefined) return player;
      return {
        ...player,
        city: entry[1].map((district) => ({
          id: district.id,
          gold: 0,
          ...(district.cards === undefined ? {} : { cards: [...district.cards] }),
        })),
      };
    }),
  });

  // Ann's Dragon Gate: 6 district points plus 2 end-game points. Bob's Museum:
  // 4 district points plus 4 for the cards tucked under it. Both total 8.
  const split = withCities([
    [ANN, [{ id: "dragon-gate" }]],
    [BOB, [{ id: "museum", cards: ["manor", "manor", "manor", "manor"] }]],
  ]);
  const scores = scoreGame(split);
  expect(scores.find((row) => row.seat === ANN)?.total).toBe(8);
  expect(scores.find((row) => row.seat === BOB)?.total).toBe(8);
  expect(scores.find((row) => row.seat === ANN)?.districts).toBe(6);
  expect(scores.find((row) => row.seat === BOB)?.districts).toBe(4);
  expect(winnerOf(split)).toBe(ANN);

  // Equal totals and district points, so gold decides.
  const even = withCities([
    [ANN, [{ id: "dragon-gate" }]],
    [BOB, [{ id: "dragon-gate" }]],
  ]);
  expect(winnerOf(even)).toBeNull();
  const richer: CitadelsState = {
    ...even,
    players: even.players.map((player) =>
      player.seat === BOB ? { ...player, gold: player.gold + 1 } : player,
    ),
  };
  expect(winnerOf(richer)).toBe(BOB);
});
