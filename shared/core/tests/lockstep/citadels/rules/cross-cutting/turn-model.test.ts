import { expect, test } from "vitest";
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
  totalCards,
  type CitadelsAction,
  type CitadelsState,
  type SeatId,
} from "../../driver.ts";

/**
 * Sixth-pass verifier artifacts. The two "D6" blocks are counterexamples that
 * failed against the head under review and pass at head, so they pin the fixed
 * behaviour; the "P6" blocks are positive probes whose teeth I measured in a
 * /tmp copy (each reddens when the behaviour behind it is removed). See
 * orchestrate/citadels/verification-6.md for the finding each one encodes.
 *
 * Scope: the turn's step order (D6-2, P6-1) plus the two clauses that same order
 * decides -- the Cardinal's card-conserving gift (D6-1) and the timing of a declared
 * colour against the income that reads it (P6-2, P6-3).
 */

const cityOf = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

// ---------------------------------------------------------------------------
// D6-1: the Cardinal's shortfall gift drops a card when the hand holds
// duplicate ids.
//
// characters/cardinal.ts coverShortfall computes the cards to give with
// `spare.slice(0, taken)` and then removes them with
// `payer.hand.filter((id) => id === reserve || !given.includes(id))`. When the
// hand holds two copies of the same id, `given.includes(id)` is true for BOTH
// copies, so both leave the Cardinal's hand while only one is handed to the
// donor. rules.json (cardinal): "giving that player one card from your hand per
// gold taken." One gold taken must cost the Cardinal exactly one card.
// ---------------------------------------------------------------------------

test("D6-1 the Cardinal's shortfall gift conserves cards, duplicates included", () => {
  const fold = foldTurn({
    character: "cardinal",
    cast: castWith("cardinal"),
    seats: SEATS3,
    board: {
      cities: { ann: ["temple"] },
      hands: { ann: ["cathedral", "tavern", "tavern"] },
      gold: { ann: 4, bob: 10 },
    },
    answer: (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "cardinal-gold") return { t: "target", seat: BOB };
      if (purpose === "turn") return { t: "build", card: 0 };
      return null;
    },
  });
  const start = foldStart(fold);
  const end = foldEnd(fold);
  // The Cardinal covers a 1-gold shortfall from BOB and hands over one card, so
  // every card is still in play. Measured on head: 68 -> 67.
  expect(totalCards(end), "the Cardinal's gift lost a card").toBe(totalCards(start));
});

// ---------------------------------------------------------------------------
// D6-2: the turn window makes gather and build mutually exclusive.
//
// docs/design/citadels-full-game.md, rules of record: "A turn: gather (2 gold,
// or draw 2 keep 1), then optionally build one district." helpers.ts resolveTurn
// handles the turn window as a single either/or action: answering with "gold"
// gathers and ends the turn (no build window), answering with "build" builds and
// never gathers. A real Citadels turn does both, in that order; the Blackmailer
// rule in rules.json depends on it ("must gather resources, then ... before ...
// building"). Measured on head: a gather turn leaves the city empty and no build
// window opens; a build turn leaves gold unmoved by the gather.
// ---------------------------------------------------------------------------

test("D6-2 a seat that gathers may then build in the same turn", () => {
  const base = rawGenesis(SEATS3, castWith("king"), "v6-gather-build");
  const armed = (): CitadelsState => ({
    ...base,
    phase: "turn",
    draft: null,
    claimed: [{ seat: ANN, character: "king" }],
    callRank: 4,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN ? { ...player, gold: 10, hand: ["tavern"] } : player,
    ),
  });

  // Gather, then expect the turn to still offer its build.
  let gatherTurn = advance(armed(), () => null);
  gatherTurn = advance(gatherTurn, () => ({ t: "gold" }));
  expect(
    openPurpose(gatherTurn),
    "the turn ended after the gather, before its build",
  ).toBe("turn");

  // Build, then expect the gather to have landed first.
  let buildTurn = advance(armed(), () => null);
  buildTurn = advance(buildTurn, () => ({ t: "build", card: 0 }));
  expect(cityOf(buildTurn, ANN), "the build landed").toContain("tavern");
  expect(
    rawGold(buildTurn, ANN),
    "the build turn never gathered (gather 2, pay 1 => 11)",
  ).toBe(11);
});

// ---------------------------------------------------------------------------
// P6 positive probes. Each passes on the head and reddens when the behaviour it
// pins is removed; they are the teeth the engine-coverage guards lack (see the
// teeth audit in verification-6.md).
// ---------------------------------------------------------------------------

test("P6-1 a bribed threat still defers the build to after the threat window", () => {
  const base = rawGenesis(SEATS3, castWith("blackmailer"), "v6-threat-build");
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
  let state = armed;
  for (let i = 0; i < 40 && state.phase !== "draft"; i += 1) {
    state = advance(state, (_seat, s) => {
      const purpose = openPurpose(s);
      if (purpose === "turn") return { t: "build", card: 0 };
      if (purpose === "blackmailer-threat") return { t: "choose", value: "bribe" };
      return null;
    });
  }
  // Removing the D5-5 deferral (helpers.ts resolveTurn) drops the threatened
  // build entirely; this probe reddens.
  expect(cityOf(state, BOB), "the threatened build landed after the threat").toEqual([
    "tavern",
  ]);
});

test("P6-2 a Bishop's income counts the colour its School of Magic declared this turn", () => {
  const fold = foldTurn({
    character: "bishop",
    cast: castWith("bishop"),
    seats: SEATS3,
    board: { cities: { ann: ["school-of-magic"] } },
    answer: (_seat, state) => (openPurpose(state) === "turn" ? { t: "gold" } : null),
  });
  // Removing the D5-7 turn-open declaration (declareSchoolOfMagic) leaves the
  // income blind to the colour; this probe reddens.
  expect(
    rawGold(foldEnd(fold), ANN) - rawGold(foldStart(fold), ANN),
    "the Bishop's income counted its declared School of Magic",
  ).toBe(3);
});

test("P6-3 a donor's gold lets the Cardinal build a card it could not afford", () => {
  const fold = foldTurn({
    character: "cardinal",
    cast: castWith("cardinal"),
    seats: SEATS3,
    board: {
      cities: { ann: ["temple"] },
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
  // Removing the D5-6 shortfall branch (helpers.ts resolveTurn) leaves the
  // cardinal-gold window a no-op; this probe reddens.
  expect(cityOf(end, ANN), "the Cardinal built the cathedral it could not afford").toContain(
    "cathedral",
  );
  expect(rawGold(end, BOB), "the donor paid the shortfall").toBeLessThan(10);
});
