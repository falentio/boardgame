import { expect, test } from "vitest";
import { specOfCharacter } from "../../../../../lockstep/games/citadels/index.ts";
import type { CharacterId } from "../../../../../lockstep/games/citadels/characters.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  castWith,
  foldEnd,
  foldStart,
  foldTurn,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  type CitadelsAction,
  type CitadelsState,
  type SeatId,
} from "../../driver.ts";

/**
 * Fifth-pass verifier counterexamples. Every test in the "D5" blocks fails
 * against the head under review and names one defect a fifth independent pass
 * found. See orchestrate/citadels/verification-5.md for the finding each one
 * encodes. These are not fixes.
 *
 * The defects sit one clause beside a fix that just landed: the Witch's resumed
 * turn runs a bare turn window (the D4-1 fix closed her held turn but never gave
 * the resume the bewitched character's ability or build limit); the Blackmailer's
 * threat was moved below the turn window (the D4-4 fix), which is also the build
 * window, so a threatened player's build now lands ahead of the threat; the
 * Cardinal's shortfall rides a pending field no engine path writes; the School of
 * Magic declares its type after the character income that should read it; and
 * several character catalog summaries describe abilities the module does not
 * implement.
 */

const cityOf = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

const foldSteps = (
  start: CitadelsState,
  answer: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
  stop: (state: CitadelsState) => boolean,
  guard = 200,
): readonly CitadelsState[] => {
  const steps: CitadelsState[] = [start];
  let state = start;
  for (let i = 0; i < guard && !stop(state); i += 1) {
    state = advance(state, answer);
    steps.push(state);
  }
  return steps;
};

/** The base cast with the Witch at rank 1 and `target` at its own rank. */
const WITCH_BASE: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const witchCast = (target: CharacterId): readonly CharacterId[] => {
  const cast = WITCH_BASE.slice();
  cast[0] = "witch";
  cast[specOfCharacter(target).rank - 1] = target;
  return cast;
};

/** A turn-phase state where ANN (the Witch) plays and CARA owns the bewitched card. */
const witchTurn = (
  bewitch: CharacterId,
  hand: readonly string[],
  gold = 30,
  city: readonly string[] = [],
): CitadelsState => {
  const base = rawGenesis(SEATS3, witchCast(bewitch), `v5-witch-${bewitch}`);
  return {
    ...base,
    phase: "turn",
    draft: null,
    claimed: [
      { seat: CARA, character: bewitch },
      { seat: BOB, character: "thief" },
      { seat: ANN, character: "witch" },
    ],
    callRank: 1,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN
        ? {
            ...player,
            gold,
            hand: [...hand],
            city: city.map((id) => ({ id, gold: 0 })),
          }
        : player,
    ),
  };
};

/** Fold the Witch's round, answering every turn window with a build when one is legal. */
const witchFold = (
  bewitch: CharacterId,
  hand: readonly string[],
  gold = 30,
  city: readonly string[] = [],
) =>
  foldSteps(
    witchTurn(bewitch, hand, gold, city),
    (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "choose-character") return { t: "name-character", character: bewitch };
      if (purpose === "turn") {
        const me = rawPlayer(state, seat);
        const inCity = new Set(cityOf(state, seat));
        const index = me.hand.findIndex((id) => !inCity.has(id));
        return index >= 0 ? { t: "build", card: index } : { t: "gold" };
      }
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    },
    (state) => state.phase === "draft",
  );

// ---------------------------------------------------------------------------
// D5-1..4: the Witch's resumed turn ignores the bewitched character's ability
// and build limit.
//
// rules.json (witch): "You then resume your turn as if you were playing the
// bewitched character: you use that character's abilities and build limit, with
// YOUR hand, YOUR gold, and YOUR city." The D4-1 fix (6788a55) closed the held
// turn and left the resume as a bare `turn` window: witch.ts's witchResolve
// pushes winStep("turn", [witchSeat]) and never runs CHARACTER_EFFECTS[bewitched]
// or that character's BUILD_LIMITS row. So the resume always has the Witch's own
// default limit of one and never runs the bewitched character's effect.
// ---------------------------------------------------------------------------

test("D5-1 the Witch's resume honours the Navigator's no-build clause", () => {
  const steps = witchFold("navigator", ["tavern", "market", "docks"]);
  const end = steps[steps.length - 1] as CitadelsState;
  // The bewitched Navigator cannot build any district this turn, so the resume
  // must leave the city empty. Measured on head: ["tavern"].
  expect(cityOf(end, ANN), "the Witch built while resuming as the Navigator").toEqual([]);
});

test("D5-2 the Witch's resume uses the bewitched Architect's three-build limit", () => {
  const steps = witchFold("architect", ["tavern", "market", "docks", "harbor", "castle"]);
  const end = steps[steps.length - 1] as CitadelsState;
  // The Architect builds up to three; the resume must offer the same limit.
  // Measured on head: 1 (the Witch's own default).
  expect(
    cityOf(end, ANN).length,
    "the Witch's resume built with the Witch's own limit, not the Architect's",
  ).toBe(3);
});

test("D5-3 the Witch's resume runs the bewitched Merchant's income ability", () => {
  const steps = witchFold("merchant", [], 10, ["tavern", "market"]);
  const end = steps[steps.length - 1] as CitadelsState;
  // The Witch's held turn pays her fixed +2; the resume as the Merchant adds the
  // Merchant's income (2 trade + 1 bonus = 3). Measured on head: +2 (no ability).
  expect(
    rawGold(end, ANN) - 10,
    "the Witch's resume ran no Merchant income",
  ).toBe(5);
});

test("D5-4 the Witch's resume runs the bewitched Architect's card draw", () => {
  const steps = witchFold("architect", [], 10);
  const end = steps[steps.length - 1] as CitadelsState;
  // The Architect draws two extra cards when its turn opens. Measured on head: 0.
  expect(rawPlayer(end, ANN).hand.length, "the Witch's resume drew no Architect cards").toBe(2);
});

// ---------------------------------------------------------------------------
// D5-5: the Blackmailer's threat resolves after the threatened player's build.
//
// rules.json (blackmailer): "A threatened player must resolve the threat before
// using abilities or building." The D4-4 fix (6788a55) spliced the
// blackmailer-threat window directly below the turn window so the bribe reads
// post-gather gold — but the turn window is also the build window (resolveTurn
// handles gold, draw, and build in one branch), so a threatened player who
// answers it with a build lands the district before the threat opens.
// ---------------------------------------------------------------------------

test("D5-5 a threatened player's build lands only after the threat resolves", () => {
  const base = rawGenesis(SEATS3, castWith("blackmailer"), "v5-blackmail");
  const armed: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: [
      { seat: CARA, character: "king" },
      { seat: ANN, character: "blackmailer" },
      { seat: BOB, character: "merchant" },
    ],
    callRank: 6,
    active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    threats: ["merchant", "king"],
    players: base.players.map((player) =>
      player.seat === BOB ? { ...player, gold: 4, hand: ["tavern"] } : player,
    ),
  };
  const steps = foldSteps(
    armed,
    (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn") return { t: "build", card: 0 };
      if (purpose === "blackmailer-threat") return { t: "choose", value: "bribe" };
      return null;
    },
    (state) => state.phase === "draft",
  );
  const threat = steps.find((state) => openPurpose(state) === "blackmailer-threat");
  expect(threat, "the threat window opens").toBeDefined();
  // The threatened player has not resolved the threat yet, so no build may stand.
  // Measured on head: ["tavern"].
  expect(cityOf(threat as CitadelsState, BOB), "the build landed ahead of the threat").toEqual([]);
});

// ---------------------------------------------------------------------------
// D5-6: the Cardinal's shortfall clause is dead through the engine.
//
// characters/cardinal.ts's cardinalResolve reads the shortfall from
// `pending.amount`, but the effect opens cardinal-gold with emptyPending's
// amount 0 and no engine path writes it, so the window is always a no-op and the
// rulebook's "take the shortfall from one player" never runs. The unit test
// hand-writes the amount (withShortfall), the D3-1/D3-7 pattern.
// ---------------------------------------------------------------------------

test("D5-6 the Cardinal's shortfall clause is reachable through the engine", () => {
  const fold = foldTurn({
    character: "cardinal",
    cast: castWith("cardinal"),
    seats: SEATS3,
    board: {
      cities: { ann: ["temple", "church"] },
      hands: { ann: ["cathedral"] },
      gold: { ann: 1, bob: 10 },
    },
    answer: (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "cardinal-gold") return { t: "target", seat: BOB };
      if (purpose === "turn") return { t: "build", card: 0 };
      return null;
    },
  });
  const end = foldEnd(fold);
  // The Cardinal covers the 4-gold shortfall from BOB and builds the cathedral.
  // Measured on head: no build, no transfer (the window armed amount 0).
  expect(cityOf(end, ANN), "the Cardinal built the cathedral it could not afford").toContain(
    "cathedral",
  );
  expect(rawGold(end, BOB), "the donor paid the shortfall").toBeLessThan(10);
});

// ---------------------------------------------------------------------------
// D5-7: the School of Magic declares its type after the income that reads it.
//
// districts/school-of-magic.ts writes the declared type on the onIncome hook
// (the gather), but the character's income runs at the resolve step above the
// turn window, so on the turn the School is declared the King's income already
// ran without it: the colour is one turn late.
// ---------------------------------------------------------------------------

test("D5-7 the School of Magic counts for the owner's income the turn it is declared", () => {
  const fold = foldTurn({
    character: "king",
    cast: castWith("king"),
    seats: SEATS3,
    board: { cities: { ann: ["school-of-magic"] } },
    answer: (_seat, state) => (openPurpose(state) === "turn" ? { t: "gold" } : null),
  });
  // The King gathers 2 and takes 1 gold for the School of Magic counted noble.
  // Measured on head: +2 (the gather only; the declaration lands after the income).
  expect(
    rawGold(foldEnd(fold), ANN) - rawGold(foldStart(fold), ANN),
    "the King's income counted its declared School of Magic",
  ).toBe(3);
});

// ---------------------------------------------------------------------------
// D5-8: the character catalog summaries disagree with the implemented effects.
//
// The summary is data the catalog carries; the prior pass found and fixed one
// such mismatch (the Navigator). The rest were not swept. The Bishop's summary
// describes a noble-payment that does not exist (its clause is the rank-8
// shield); the Tax Collector's describes naming a character (its clause is the
// tax token); the Blackmailer's describes paying gold to skip a turn (its clause
// is threat markers); the Magician's describes swapping with the deck.
// ---------------------------------------------------------------------------

test("D5-8 the character summaries match the implemented abilities", () => {
  expect(
    specOfCharacter("bishop").summary,
    "the Bishop's summary names its rank-8 shield, not a noble payment",
  ).toMatch(/rank 8|shield/i);
  expect(
    specOfCharacter("tax-collector").summary,
    "the Tax Collector's summary names the tax token",
  ).toMatch(/token/i);
  expect(
    specOfCharacter("blackmailer").summary,
    "the Blackmailer's summary names its threat markers",
  ).toMatch(/threat/i);
  expect(
    specOfCharacter("magician").summary,
    "the Magician does not swap its hand with the deck",
  ).not.toMatch(/hand with the deck/i);
});
