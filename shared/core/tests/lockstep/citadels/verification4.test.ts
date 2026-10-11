import { expect, test } from "vitest";
import { citadels, scoreGame } from "../../../lockstep/games/citadels/index.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  castWith,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  totalCards,
} from "./driver.ts";
import type { CitadelsAction, CitadelsState, SeatId } from "./driver.ts";

/**
 * Fourth-pass verifier counterexamples. Every test in the "D4" blocks fails
 * against the head under review and names one defect a fourth independent pass
 * found. See orchestrate/citadels/verification-4.md for the finding each one
 * encodes. These are not fixes.
 *
 * The defects cluster where the three prior passes did not look: the Witch's
 * held turn still carries a build window; the Tax Collector's per-seat (not
 * per-character) tax exemption; the Museum's tucked cards lost on destroy; the
 * Blackmailer's threat resolving before the threatened player gathers; the
 * Bishop's rank-8 shield consulted only by the Warlord; the Ivory Tower's
 * over-broad Haunted Quarter exception; and the Magistrate's refusal to
 * confiscate a card-paid Thieves' Den.
 */

const cityOf = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

const foldSteps = (
  start: CitadelsState,
  answer: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
  stop: (state: CitadelsState) => boolean,
  guard = 150,
): readonly CitadelsState[] => {
  const steps: CitadelsState[] = [start];
  let state = start;
  for (let i = 0; i < guard && !stop(state) && !citadels.isTerminal(state); i += 1) {
    state = advance(state, answer);
    steps.push(state);
  }
  return steps;
};

const intoDraft = (state: CitadelsState): boolean => state.phase === "draft";

const armedTurn = (
  claimed: readonly { readonly seat: SeatId; readonly character: string }[],
  callRank: number,
  active: SeatId,
  cast: readonly string[],
  cities: Readonly<Record<string, readonly (string | { id: string; gold: number; cards?: readonly string[] })[]>>,
  gold: Readonly<Record<string, number>>,
  hands: Readonly<Record<string, readonly string[]>> = {},
  extra: Partial<CitadelsState> = {},
): CitadelsState => {
  const base = rawGenesis(SEATS3, cast as never, "v4-counter");
  return {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claimed as never,
    callRank,
    active,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) => ({
      ...player,
      ...(cities[player.seat] === undefined
        ? {}
        : {
            city: cities[player.seat].map((entry) =>
              typeof entry === "string" ? { id: entry, gold: 0 } : entry,
            ),
          }),
      ...(gold[player.seat] === undefined ? {} : { gold: gold[player.seat] }),
      ...(hands[player.seat] === undefined ? {} : { hand: [...hands[player.seat]] }),
    })),
    ...extra,
  };
};

// ---------------------------------------------------------------------------
// D4-1: the Witch can build on her own (held) turn.
//
// rules.json (witch): "Gather resources, then call the name of another
// character to bewitch; your turn is put on hold and you cannot build." The
// engine's applyCall pushes the round's own turn window below the naming window
// for every character, so the Witch's held turn carries a full gather-and-build
// window. A folded Witch turn that answers that window with a build adds the
// district to the Witch's city.
// ---------------------------------------------------------------------------

test("D4-1 the Witch's held turn carries no build window", () => {
  const cast = castWith("witch");
  const armed = armedTurn(
    [
      { seat: CARA, character: "magician" },
      { seat: BOB, character: "merchant" },
      { seat: ANN, character: "witch" },
    ],
    1,
    ANN,
    cast,
    { ann: [] },
    { ann: 10 },
    { ann: ["tavern", "market", "docks"] },
  );
  const steps = foldSteps(
    armed,
    (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "choose-character") return { t: "name-character", character: "merchant" };
      if (purpose === "turn") return { t: "build", card: 0 };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    },
    intoDraft,
  );
  const built = steps.some((state) => cityOf(state, ANN).length > 0);
  // The Witch cannot build during her held turn. Measured on head: she builds a
  // tavern at her own rank. Through a real dealt-and-drafted game (a
  // foldGame with ANN drafting the Witch) she ends the round with three
  // districts, one per turn window.
  expect(built, "the Witch built during her held turn").toBe(false);
});

// ---------------------------------------------------------------------------
// D4-1b: the Witch gathers twice on her held turn.
//
// The Witch effect pays a fixed +2 as it arms the naming window, and the round's
// own turn window (which the held turn keeps) pays the gather again, so a Witch
// who answers the turn window takes 4 gold where the rules give 2.
// ---------------------------------------------------------------------------

test("D4-1b the Witch gathers once, not twice, on her held turn", () => {
  const cast = castWith("witch");
  const armed = armedTurn(
    [
      { seat: CARA, character: "magician" },
      { seat: BOB, character: "merchant" },
      { seat: ANN, character: "witch" },
    ],
    1,
    ANN,
    cast,
    { ann: [] },
    { ann: 10 },
    { ann: ["tavern", "market", "docks"] },
  );
  const steps = foldSteps(
    armed,
    (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "choose-character") return { t: "name-character", character: "merchant" };
      if (purpose === "turn") return { t: "gold" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    },
    intoDraft,
  );
  const end = steps[steps.length - 1] as CitadelsState;
  // The Witch's held turn gathers once (2 gold): her fixed gather plus the
  // turn's own gather, and no third gather for the resume. Measured on head:
  // +6 (her fixed 2, the held turn window's 2, and the resume window's 2).
  expect(rawGold(end, ANN) - 10, "the Witch's held-turn gather").toBe(2);
});

// ---------------------------------------------------------------------------
// D4-2: the Tax Collector's holder is exempt from the tax even in 2-3 player
// games.
//
// rules.json (tax-collector): "In 2-3 player games a player holding the Tax
// Collector still pays tax for their other character." chargeBuildTax in
// helpers.ts exempts the whole seat, so a 3-player seat holding the Tax
// Collector and building with its other character pays nothing.
// ---------------------------------------------------------------------------

const taxBuildPot = (holder: SeatId): number => {
  const cast = castWith("tax-collector");
  const armed = armedTurn(
    [
      { seat: ANN, character: "merchant" },
      { seat: holder, character: "tax-collector" },
    ],
    6,
    ANN,
    cast,
    { ann: [] },
    { ann: 5 },
    { ann: ["tavern"] },
  );
  const steps = foldSteps(
    armed,
    (_seat, state) => (openPurpose(state) === "turn" ? { t: "build", card: 0 } : null),
    (state) => state.phase === "draft" || cityOf(state, ANN).length > 0,
  );
  const built = steps.find((state) => cityOf(state, ANN).length > 0);
  return built?.taxPot ?? 0;
};

test("D4-2 a 2-3 player seat pays tax for its other character", () => {
  // ANN holds the merchant and builds; the Tax Collector sits with ANN too (a
  // 3-player seat drafts two characters). ANN must still pay the one-gold tax.
  // Measured on head: 0 (ANN's own seat is exempted wholesale).
  expect(taxBuildPot(ANN), "ANN's own build while holding the Tax Collector").toBe(1);
  // Control: the tax is charged when another seat holds the Tax Collector.
  expect(taxBuildPot(BOB), "a build while another seat holds the Tax Collector").toBe(1);
});

// ---------------------------------------------------------------------------
// D4-3: a destroyed Museum's tucked cards vanish.
//
// rules.json (museum): "if destroyed the cards are discarded to the bottom of
// the deck." The destroy paths (the Warlord, the Armory, the Framework and
// Necropolis self-destroy) push only the district id to the deck, dropping
// PlacedDistrict.cards. A Warlord destroy of a Museum with three tucked cards
// loses all three.
// ---------------------------------------------------------------------------

test("D4-3 a destroyed Museum's tucked cards sink to the deck", () => {
  const cast = castWith("warlord");
  const armed = armedTurn(
    [
      { seat: ANN, character: "warlord" },
      { seat: BOB, character: "merchant" },
    ],
    8,
    ANN,
    cast,
    {
      ann: ["watchtower"],
      bob: [{ id: "museum", gold: 0, cards: ["manor", "castle", "tavern"] }],
    },
    { ann: 30 },
  );
  const before = totalCards(armed);
  const steps = foldSteps(
    armed,
    (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "warlord-destroy") {
        const pending = state.pending;
        return pending === null || pending.target === null
          ? { t: "target", seat: BOB }
          : { t: "keep", index: 0 };
      }
      if (purpose === "turn") return { t: "gold" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    },
    intoDraft,
  );
  const end = steps[steps.length - 1] as CitadelsState;
  expect(cityOf(end, BOB), "the Museum falls").not.toContain("museum");
  expect(totalCards(end), "every district card is conserved through the destroy").toBe(before);
});

// ---------------------------------------------------------------------------
// D4-4: the Blackmailer's threat resolves before the threatened player gathers.
//
// rules.json (blackmailer): "When a threatened player is called, they must
// gather resources, then resolve the threat." applyCall prepends the
// blackmailer-threat window above the turn window, so the bribe (half the
// threatened player's gold, rounded down) is computed before the gather lands.
// ---------------------------------------------------------------------------

test("D4-4 the Blackmailer's threat resolves after the gather", () => {
  const cast = castWith("blackmailer");
  const armed = armedTurn(
    [
      { seat: CARA, character: "king" },
      { seat: ANN, character: "blackmailer" },
      { seat: BOB, character: "magician" },
    ],
    2,
    ANN,
    cast,
    {},
    { ann: 5, bob: 1, cara: 5 },
    {},
    { threats: [] },
  );
  const steps = foldSteps(
    armed,
    (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "blackmailer-resolve") {
        const pending = state.pending;
        const naming =
          pending !== null &&
          pending.character === "blackmailer" &&
          pending.actor === seat &&
          pending.note !== "reveal";
        return naming
          ? { t: "name-character", character: "magician" }
          : { t: "choose", value: "refuse" };
      }
      if (purpose === "blackmailer-threat") return { t: "choose", value: "bribe" };
      if (purpose === "turn") return { t: "gold" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    },
    (state) => state.phase === "draft",
  );
  // The bribe is half of the threatened player's post-gather gold: (1 + 2) / 2
  // = 1. The module takes half of the pre-gather 1 = 0.
  const bribePaid = steps
    .map((state, index) => {
      const prior = steps[index - 1];
      if (prior === undefined) return 0;
      if (openPurpose(prior) !== "blackmailer-threat") return 0;
      return rawGold(prior, BOB) - rawGold(state, BOB);
    })
    .reduce((best, delta) => Math.max(best, delta), 0);
  expect(bribePaid, "the bribe is half the threatened player's post-gather gold").toBe(1);
});

// ---------------------------------------------------------------------------
// D4-5: the Bishop's rank-8 shield is consulted only by the Warlord.
//
// rules.json (bishop): "During this round the rank 8 character cannot use its
// ability on your districts." bishopShield exists and the Warlord reads it, but
// the Marshal and the Diplomat (both rank 8) never do, so they take from a
// shielded seat's city.
// ---------------------------------------------------------------------------

const rank8Take = (character: "marshal" | "diplomat"): CitadelsState => {
  const purpose = character === "marshal" ? "marshal-seize" : "diplomat-exchange";
  const cast = castWith(character);
  const armed = armedTurn(
    [
      { seat: ANN, character },
      { seat: BOB, character: "bishop" },
    ],
    8,
    ANN,
    cast,
    { ann: ["watchtower"], bob: ["tavern"] },
    { ann: 30 },
  );
  const steps = foldSteps(
    armed,
    (_seat, state) => {
      const open = openPurpose(state);
      if (open === purpose) {
        const pending = state.pending;
        return pending === null || pending.target === null
          ? { t: "target", seat: BOB }
          : { t: "keep", index: 0 };
      }
      if (open === "turn") return { t: "gold" };
      if (open === "keep") return { t: "keep", index: 0 };
      return null;
    },
    intoDraft,
  );
  return steps[steps.length - 1] as CitadelsState;
};

test("D4-5 the Bishop's shield stops the Marshal", () => {
  const end = rank8Take("marshal");
  // The Marshal cannot seize a district from the shielded Bishop's city.
  // Measured on head: ANN's city holds the seized tavern.
  expect(cityOf(end, ANN), "the Marshal seized from the shielded city").toEqual(["watchtower"]);
  expect(cityOf(end, BOB), "the Bishop keeps its district").toEqual(["tavern"]);
});

test("D4-5 the Bishop's shield stops the Diplomat", () => {
  const end = rank8Take("diplomat");
  expect(cityOf(end, ANN), "the Diplomat exchanged out of the shielded city").toEqual(["watchtower"]);
  expect(cityOf(end, BOB), "the Bishop keeps its district").toEqual(["tavern"]);
});

// ---------------------------------------------------------------------------
// D4-6: the Ivory Tower treats an undeclared Haunted Quarter as non-unique.
//
// districts.ts's typeOfPlaced reports the catalog type "unique" for an
// undeclared Haunted Quarter, and the catalog makes the Ivory Tower score only
// when it is the city's only unique district. districts/ivory-tower.ts
// special-cases the Haunted Quarter to declaredType === "unique", so an
// undeclared Haunted Quarter (still a unique per typeOfPlaced) no longer stops
// the Ivory Tower from scoring.
// ---------------------------------------------------------------------------

test("D4-6 an undeclared Haunted Quarter still blocks the Ivory Tower", () => {
  const base = rawGenesis(SEATS3, castWith("king"), "v4-ivory");
  const state: CitadelsState = {
    ...base,
    players: base.players.map((player) =>
      player.seat === ANN
        ? {
            ...player,
            city: [
              { id: "ivory-tower", gold: 0 },
              { id: "haunted-quarter", gold: 0 },
            ],
          }
        : player,
    ),
  };
  // The Haunted Quarter counts as its catalog type (unique) until its owner
  // names another, so the Ivory Tower is not the only unique: 0. Measured: 5.
  expect(scoreGame(state).find((row) => row.seat === ANN)?.unique).toBe(0);
});

// ---------------------------------------------------------------------------
// D4-7: the Magistrate cannot confiscate a Thieves' Den paid for with cards.
//
// rules.json (thieves-den): "If confiscated by the Magistrate, you receive back
// only gold spent, not cards." The rule contemplates confiscating a card-paid
// Den. helpers.ts's tryBuild only opens the magistrate-confiscate window when
// the build paid gold, and the Thieves' Den's card branch sets that flag false,
// so a card-paid Den is never confiscatable.
// ---------------------------------------------------------------------------

test("D4-7 a card-paid Thieves' Den can be confiscated", () => {
  const cast = castWith("magistrate");
  const armed = armedTurn(
    [
      { seat: ANN, character: "magistrate" },
      { seat: BOB, character: "merchant" },
    ],
    6,
    BOB,
    cast,
    { ann: [], bob: ["manor"] },
    { ann: 10, bob: 0 },
    { bob: ["thieves-den", "castle", "temple", "church"] },
    { warrants: ["merchant"] },
  );
  const steps = foldSteps(
    armed,
    (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn") return { t: "build", card: 0 };
      if (purpose === "magistrate-confiscate") return { t: "choose", value: "confiscate" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    },
    (state) => state.phase === "draft",
  );
  const built = steps.find((state) => cityOf(state, BOB).includes("thieves-den"));
  expect(built, "the card-paid Den builds").toBeDefined();
  const opened = steps.some((state) => {
    const top = state.steps[0];
    return top !== undefined && top.kind === "window" && top.window.purpose === "magistrate-confiscate";
  });
  expect(opened, "the Magistrate may confiscate the card-paid Den").toBe(true);
});
