import { expect, test } from "vitest";
import { scoreGame, winnerOf } from "../../../../../lockstep/games/citadels/index.ts";
import type { PlacedDistrict } from "../../../../../lockstep/games/citadels/state.ts";
import { specOfDistrict, typeOfPlaced } from "../../../../../lockstep/games/citadels/districts.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  CAST9,
  SEATS3,
  SEATS4,
  advance,
  castWith,
  foldEnd,
  foldStart,
  foldTurn,
  rawGenesis,
  rawGold,
  rawHand,
  type CitadelsAction,
  type CitadelsState,
  type SeatId,
} from "../../driver.ts";

/**
 * Third-pass verifier counterexamples. Every test in the "defects" blocks below
 * fails against the head under review and names one defect a third independent
 * pass found. See orchestrate/citadels/verification-3.md for the finding each
 * one encodes. These are not fixes.
 *
 * The two tests in the last block pass on the head: they are the positive probes
 * that expose a blind spot in engine-coverage.test.ts, where the Keep guard and
 * the Trader guard stay green when their behaviour is removed (audited in the
 * report's teeth section).
 */

const withCity = (
  state: CitadelsState,
  seat: SeatId,
  city: readonly PlacedDistrict[],
): CitadelsState => ({
  ...state,
  players: state.players.map((player) => (player.seat === seat ? { ...player, city } : player)),
});

// ---------------------------------------------------------------------------
// D3-1 (blocking): the Navigator's four-card branch is dead through the engine.
//
// characters/navigator.ts selects the card branch from `pending.note ===
// NAVIGATOR_CARDS_NOTE`, but `applyCall` arms pending with `note: null` and no
// engine path ever sets that note: there is no `navigator-*` window in
// WINDOW_PURPOSES and no action that writes it. So a real game always takes the
// four-gold branch and the rulebook's "or draw four cards" is unreachable. The
// navigator unit test hand-writes the note, so it stays green.
// ---------------------------------------------------------------------------

test("D3-1 the Navigator's four-card branch is reachable through the engine", () => {
  const fold = foldTurn({
    character: "navigator",
    cast: castWith("navigator"),
    seats: SEATS3,
    answer: (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
      const top = s.steps[0];
      const purpose = top !== undefined && top.kind === "window" ? top.window.purpose : null;
      // A card gather is the only place the four-card branch could surface; take it.
      if (purpose === "turn") return { t: "draw" };
      return null;
    },
  });
  // The catalog: "Take 4 gold, or draw 4 cards and keep 1." Measured on head: 0.
  expect(rawHand(foldEnd(fold), ANN).length - rawHand(foldStart(fold), ANN).length).toBe(4);
});

// ---------------------------------------------------------------------------
// D3-2: the Capitol ignores a district's declared type.
//
// districts/capitol.ts counts `specOfDistrict(id).type`, the catalog colour, so a
// School of Magic or Haunted Quarter declared a non-unique type is not counted
// toward "three districts of one type". The colour bonus (scoring.ts) reads
// `typeOfPlaced` for exactly this reason, so the Capitol disagrees with the
// module's own type reader.
// ---------------------------------------------------------------------------

test("D3-2 the Capitol counts a district of a declared type", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v3-capitol");
  const state = withCity(base, ANN, [
    { id: "capitol", gold: 0 },
    { id: "school-of-magic", gold: 0, declaredType: "trade" },
    { id: "tavern", gold: 0 },
    { id: "market", gold: 0 },
  ]);
  // Three trade districts (SoM declared trade + tavern + market) + the Capitol: +3.
  // Measured on head: 0.
  expect(scoreGame(state).find((row) => row.seat === ANN)?.unique).toBe(3);
});

// ---------------------------------------------------------------------------
// D3-3: the Basilica ignores the Artist's beautify marker.
//
// districts/basilica.ts tests `specOfDistrict(id).cost % 2`, the catalog cost,
// while scoring.ts's cost sum counts a beautified district at `cost + gold` ("a
// beautified district counts +1"). A Market (cost 2) with one beautify gold is a
// cost-3 (odd) district, so it must earn the Basilica a point.
// ---------------------------------------------------------------------------

test("D3-3 the Basilica counts a beautified district's raised cost", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v3-basilica");
  const state = withCity(base, ANN, [
    { id: "basilica", gold: 0 },
    { id: "market", gold: 1 },
  ]);
  // Market cost 2 + 1 beautify gold = 3, odd: one Basilica point. Measured: 0.
  expect(scoreGame(state).find((row) => row.seat === ANN)?.unique).toBe(1);
});

// ---------------------------------------------------------------------------
// D3-4: the Wishing Well and the Ivory Tower count the catalog `unique` flag, not
// the declared type. A Haunted Quarter or School of Magic declared a non-unique
// type is no longer a unique district (`typeOfPlaced` reports the declared type),
// yet both scorers still count it as one.
// ---------------------------------------------------------------------------

test("D3-4 the Wishing Well does not count a re-typed unique as unique", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v3-wishing-well");
  const state = withCity(base, ANN, [
    { id: "wishing-well", gold: 0 },
    { id: "haunted-quarter", gold: 0, declaredType: "noble" },
  ]);
  // Only the Wishing Well is a unique once the Haunted Quarter is noble: +1.
  // Measured on head: 2.
  expect(scoreGame(state).find((row) => row.seat === ANN)?.unique).toBe(1);
});

test("D3-4 the Ivory Tower scores when a re-typed unique stands beside it", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v3-ivory-tower");
  const state = withCity(base, ANN, [
    { id: "ivory-tower", gold: 0 },
    { id: "school-of-magic", gold: 0, declaredType: "noble" },
  ]);
  // The School of Magic is noble, so the Ivory Tower is the only unique: +5.
  // Measured on head: 0.
  expect(scoreGame(state).find((row) => row.seat === ANN)?.unique).toBe(5);
});

// ---------------------------------------------------------------------------
// D3-5: the draft discards one character too many. setup.ts's buildDraft sets the
// passing pool to exactly the number of picks, so the final picker is forced,
// and the face-up discard pile is one larger than the catalog's setup numbers.
// ---------------------------------------------------------------------------

test("D3-5 the draft discards no more face-up characters than the catalog allows", () => {
  // catalog: 4 players => 2 face-up, 1 face-down; with a rank-9 character in
  // play, add 1 face-up => at most 3. Measured on head: 4 face-up.
  const rank9 = rawGenesis(SEATS4, CAST9, "v3-draft-rank9");
  expect(rank9.draft?.faceup.length ?? 0).toBeLessThanOrEqual(3);
  // And the base 4-player setup must not exceed the catalog's 2. Measured: 3.
  const base = rawGenesis(SEATS4, BASE_CAST_IDS, "v3-draft-base");
  expect(base.draft?.faceup.length ?? 0).toBeLessThanOrEqual(2);
});

// ---------------------------------------------------------------------------
// D3-6: winnerOf uses the wrong tie-break. The catalog's rule is "the tied player
// who revealed the highest-numbered rank in the last round wins"; the code breaks
// ties by district points and then gold, and returns no winner on a full tie.
// ---------------------------------------------------------------------------

test("D3-6 winnerOf breaks a tie by the highest revealed rank, not gold", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v3-tiebreak");
  const tied: CitadelsState = {
    ...base,
    claimed: [
      { seat: ANN, character: "king" },
      { seat: BOB, character: "warlord" },
    ],
    players: base.players.map((player) =>
      player.seat === ANN || player.seat === BOB
        ? { ...player, city: [{ id: "dragon-gate", gold: 0 }] }
        : player,
    ),
  };
  // Equal totals (8) and equal district points (6) and equal gold (2): the
  // catalog awards the win to BOB, who revealed the rank-8 Warlord over ANN's
  // rank-4 King. Measured on head: null.
  expect(winnerOf(tied)).toBe(BOB);
});

// ---------------------------------------------------------------------------
// ---------------------------------------------------------------------------
// D3-7: the Haunted Quarter's "count as any one type you choose" clause is dead
// through the engine. districts/haunted-quarter.ts reads its chosen type from
// `pending.namedType`, but the district declares no trigger (its effect is never
// called by runDistrictHooks) and no window purpose lets its owner name a type.
// A Haunted Quarter in a real game always scores as its catalog type, unique, so
// the colour bonus it is meant to supply can never be chosen.
// ---------------------------------------------------------------------------

test("D3-7 a seat owning the Haunted Quarter can choose its counted type", () => {
  const fold = foldTurn({
    character: "king",
    cast: castWith("king"),
    seats: SEATS3,
    board: { cities: { ann: ["haunted-quarter"] } },
    uniques: [
      "haunted-quarter", "keep", "laboratory", "smithy", "library",
      "school-of-magic", "dragon-gate", "observatory", "great-wall", "factory",
      "park", "museum", "capitol", "monument",
    ],
    answer: (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
      const top = s.steps[0];
      const purpose = top !== undefined && top.kind === "window" ? top.window.purpose : null;
      if (purpose === "choose-type") return { t: "name-type", type: "noble" };
      if (purpose === "turn") return { t: "gold" };
      return null;
    },
  });
  // The owner must be able to name a type; the engine records it on the card.
  // Measured on head: undefined (no window ever opens for the choice).
  const quarter = foldEnd(fold)
    .players.find((player) => player.seat === ANN)
    ?.city.find((district) => district.id === "haunted-quarter");
  expect(quarter?.declaredType).toBeDefined();
});

// Guard blind spots. These pass on the head; they exist because the folded-game
// guard in engine-coverage.test.ts stays green when the same behaviour is
// removed (see the report's teeth audit), so a regression here would slip past
// the guard. A regression in the module breaks these.
// ---------------------------------------------------------------------------

test("the Keep protects its owner's city from the Warlord's destroy", () => {
  const fold = foldTurn({
    character: "warlord",
    cast: castWith("warlord"),
    seats: SEATS3,
    board: {
      cities: { ann: ["watchtower", "prison", "castle", "palace"], bob: ["keep"] },
      gold: { ann: 20 },
    },
    answer: (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
      const top = s.steps[0];
      const purpose = top !== undefined && top.kind === "window" ? top.window.purpose : null;
      if (purpose === "warlord-destroy") {
        const pending = s.pending;
        return pending !== null && pending.target === null
          ? { t: "target", seat: BOB }
          : { t: "keep", index: 0 };
      }
      if (purpose === "turn") return { t: "gold" };
      return null;
    },
  });
  const bob = foldEnd(fold).players.find((player) => player.seat === BOB);
  expect(bob?.city.map((district) => district.id)).toContain("keep");
});

test("the Trader's income honours a School of Magic declared trade", () => {
  const cast = castWith("trader");
  const base = rawGenesis(SEATS3, cast, "v3-trader-declared");
  const state = withCity(base, ANN, [{ id: "school-of-magic", gold: 0, declaredType: "trade" }]);
  const after = advance(
    {
      ...state,
      phase: "turn",
      draft: null,
      claimed: [{ seat: ANN, character: "trader" }],
      callRank: 6,
      active: ANN,
      steps: [{ kind: "call" }, { kind: "end-round" }],
    },
    () => null,
  );
  // One trade district (the declared School of Magic) => +1 gold.
  expect(rawGold(after, ANN)).toBe(rawGold(state, ANN) + 1);
});
