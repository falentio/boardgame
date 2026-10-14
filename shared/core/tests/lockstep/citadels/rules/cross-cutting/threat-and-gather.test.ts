import { expect, test } from "vitest";
import { citadels, scoreGame } from "../../../../../lockstep/games/citadels/index.ts";
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
} from "../../driver.ts";
import type { CitadelsAction, CitadelsState, SeatId } from "../../driver.ts";

/**
 * Fourth-pass verifier counterexamples. Every test in the "D4" blocks failed
 * against the head under review and names one defect a fourth independent pass
 * found. The defects are fixed at head, so those tests pin the fixed behaviour.
 * See orchestrate/citadels/verification-4.md for the finding each one encodes.
 *
 * The defects clustered where the three prior passes did not look: the Witch's
 * held turn carried a build window; the Tax Collector's per-seat (not
 * per-character) tax exemption; the Museum's tucked cards lost on destroy; the
 * Blackmailer's threat resolving before the threatened player gathered; the
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
    players: base.players.map((player) => {
      const city = cities[player.seat];
      const purse = gold[player.seat];
      const hand = hands[player.seat];
      return {
        ...player,
        ...(city === undefined
          ? {}
          : {
              city: city.map((entry) =>
                typeof entry === "string" ? { id: entry, gold: 0 } : entry,
              ),
            }),
        ...(purse === undefined ? {} : { gold: purse }),
        ...(hand === undefined ? {} : { hand: [...hand] }),
      };
    }),
    ...extra,
  };
};

// ---------------------------------------------------------------------------
// D4-1: the Witch builds exactly once, at the resume, never on her held turn.
//
// rules.json (witch): "Gather resources, then call the name of another
// character to bewitch; your turn is put on hold and you cannot build. When the
// bewitched character is called, its owner gathers resources and their turn
// immediately ends (no build, no character ability). You then resume your turn
// as if you were playing the bewitched character: you use that character's
// abilities and build limit..."
//
// This block previously asserted "the Witch's held turn carries no build
// window" and read a build during the held turn as the defect (the old engine
// let her build at her own rank). The corrected engine (commit 6788a55) closes
// the held turn without a build and grants the build at the resume, so the
// rule-true claim is the inverse: no build on the held turn, exactly one build
// at the resume (the bewitched character's build limit). The fold and policy
// are unchanged; only the assertion was re-aimed. Teeth: if the held turn
// regains its build, the fold shows two builds and both assertions below fail.
// ---------------------------------------------------------------------------

test("D4-1 the Witch builds once, at the resume, and never on her held turn", () => {
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
  const startCity = cityOf(armed, ANN).length;
  // The held turn is ANN's turn window before the bewitch resolves; the resume is
  // the later ANN turn window carrying the owned resume record (state.resume). The
  // policy answers both with a build.
  const heldTurn = steps.findIndex(
    (state) => openPurpose(state) === "turn" && state.active === ANN,
  );
  const resumeTurn = steps.findIndex(
    (state) =>
      openPurpose(state) === "turn" &&
      state.active === ANN &&
      state.resume != null,
  );
  expect(heldTurn, "the held turn opens a window").toBeGreaterThan(-1);
  expect(resumeTurn, "the resume turn opens a window").toBeGreaterThan(heldTurn);
  // The held turn refuses the build ("you cannot build"); the resume lands exactly
  // one, as the bewitched character.
  expect(
    cityOf(steps[heldTurn + 1] as CitadelsState, ANN).length,
    "the Witch built during her held turn",
  ).toBe(startCity);
  expect(
    cityOf(steps[resumeTurn + 1] as CitadelsState, ANN).length,
    "the Witch built at the resume",
  ).toBe(startCity + 1);
  const end = steps[steps.length - 1] as CitadelsState;
  expect(cityOf(end, ANN).length, "the Witch's total builds this round").toBe(startCity + 1);
});

// ---------------------------------------------------------------------------
// D4-1b: the Witch gathers once, not twice, on her held turn.
//
// rules.json (witch): "Gather resources, then call the name of another character
// to bewitch; your turn is put on hold and you cannot build. ... You then resume
// your turn as if you were playing the bewitched character: you use that
// character's abilities and build limit, with YOUR hand, YOUR gold, and YOUR
// city." The Witch gathers once as her turn is put on hold (+2), and the held
// turn window pays no gather a second time. rules.json (merchant): "Gain 1 gold
// per trade district in your city, plus 1 extra gold." The resume runs the
// bewitched Merchant's income on ANN's empty city (+1), and pays no gather of
// its own. Rule-true total: +3. Teeth: if the held turn regains its second
// gather the total rises to +5, and if the resume gathers again (or drops the
// Merchant income) the total moves off +3.
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
  // Measured over the fold: +2 at the naming window (the Witch's one gather, as
  // her turn is put on hold), +0 at the held turn window (no second gather), and
  // +1 at the resume (the bewitched Merchant's "plus 1 extra gold" on ANN's empty
  // city; 0 trade districts, so no per-district gold). The "no third gather"
  // clause holds: the resume pays income, not a gather. Total +3.
  expect(rawGold(end, ANN) - 10, "the Witch's gold across held turn and resume").toBe(3);
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
