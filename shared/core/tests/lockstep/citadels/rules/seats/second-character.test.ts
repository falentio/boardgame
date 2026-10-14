import { expect, test } from "vitest";
import { charactersOfRank, specOfCharacter } from "../../../../../lockstep/games/citadels/characters.ts";
import type { Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawHand,
  rawPlayer,
  type CharacterId,
  type CitadelsAction,
  type CitadelsState,
  type SeatId,
} from "../../driver.ts";

/**
 * Seventh-pass verifier artifacts. The counterexamples below failed against the
 * head under review; fix 0ab24e2 keyed seven per-character clauses on the acting
 * character (D7-1..6), so they pass at head and pin the fixed behaviour.
 *
 * The defect family: in a 2- or 3-player game each seat drafts TWO characters
 * (catalog "Setup numbers"; setup.ts buildDraft perSeat = 2 for <=3 seats). The
 * engine's rank cursor called the right character (applyCall -> characterAtRank),
 * but several per-character clauses read the seat's FIRST claim instead of the
 * character actually in play (helpers.ts claimOf), so whenever the acting
 * character was not the seat's lowest-rank claim the clause misfired. The engine
 * already computes the correct value as activeCharacterOf; the clauses below did
 * not use it.
 */

/** A legal cast: one distinct character per rank 1-8, with per-rank overrides. */
const castFor = (overrides: Readonly<Record<number, CharacterId>>): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    cast.push(overrides[rank] ?? (charactersOfRank(rank as Rank)[0] as CharacterId));
  }
  return cast;
};

/** A real deal laid over, then armed as ANN's active-character turn. */
const armedTurn = (opts: {
  readonly cast: readonly CharacterId[];
  readonly annChars: readonly CharacterId[];
  readonly others: readonly [SeatId, CharacterId][];
  readonly active: CharacterId;
  readonly gold?: Readonly<Record<string, number>>;
  readonly hands?: Readonly<Record<string, readonly string[]>>;
  readonly cities?: Readonly<Record<string, readonly string[]>>;
  readonly threats?: readonly CharacterId[];
}): CitadelsState => {
  const base = rawGenesis(SEATS3, opts.cast, "verify7-" + opts.active);
  const claims = [
    ...opts.annChars.map((character) => ({ seat: ANN, character })),
    ...opts.others.map(([seat, character]) => ({ seat, character })),
  ].sort((a, b) => specOfCharacter(a.character).rank - specOfCharacter(b.character).rank);
  return {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claims,
    callRank: specOfCharacter(opts.active).rank,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    ...(opts.threats === undefined ? {} : { threats: opts.threats }),
    players: base.players.map((player) => {
      const gold = opts.gold?.[player.seat];
      const hand = opts.hands?.[player.seat];
      const city = opts.cities?.[player.seat];
      return {
        ...player,
        ...(gold === undefined ? {} : { gold }),
        ...(hand === undefined ? {} : { hand: [...hand] }),
        ...(city === undefined ? {} : { city: city.map((id) => ({ id, gold: 0 })) }),
      };
    }),
  };
};

/** Fold ANN's active-character turn, then stop when the rank cursor moves on. */
const foldAnnTurn = (
  state: CitadelsState,
  answer: (purpose: string, state: CitadelsState) => CitadelsAction | null,
): CitadelsState => {
  let current = state;
  for (let i = 0; i < 120; i += 1) {
    if (current.phase !== "turn" || current.active !== ANN) break;
    current = advance(current, (_seat, s) => answer(openPurpose(s) ?? "", s));
  }
  return current;
};

const cityIds = (state: CitadelsState, seat: SeatId): readonly string[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

// ---------------------------------------------------------------------------
// D7-1: the Navigator's ability is skipped when it is the seat's higher-rank
// character. helpers.ts resolveTurn tests claimOf(state, seat)?.character ===
// "navigator" -- the seat's FIRST claim -- instead of the character the rank
// cursor called. The turn then takes the ordinary gather (2 gold) and leaves a
// build window, so the Navigator neither gains four nor loses its build.
// rules.json (navigator): "Gain either four gold or four cards ... You cannot
// build any districts this turn."
// ---------------------------------------------------------------------------

test("D7-1 a Navigator that is the seat's second character still gains four gold", () => {
  const end = foldAnnTurn(
    armedTurn({
      cast: castFor({ 1: "assassin", 7: "navigator" }),
      annChars: ["assassin", "navigator"],
      others: [
        [BOB, "magician"],
        [CARA, "warlord"],
      ],
      active: "navigator",
      gold: { ann: 0 },
      hands: { ann: ["tavern"] },
    }),
    (purpose) => (purpose === "turn" ? { t: "gold" } : null),
  );
  expect(rawGold(end, ANN), "the Navigator's four-gold gain was skipped (measured 2)").toBe(4);
});

test("D7-1b a Navigator that is the seat's second character cannot build", () => {
  const end = foldAnnTurn(
    armedTurn({
      cast: castFor({ 1: "assassin", 7: "navigator" }),
      annChars: ["assassin", "navigator"],
      others: [
        [BOB, "magician"],
        [CARA, "warlord"],
      ],
      active: "navigator",
      gold: { ann: 0 },
      hands: { ann: ["tavern"] },
    }),
    (purpose) => (purpose === "turn" ? { t: "build", card: 0 } : null),
  );
  expect(cityIds(end, ANN), "the Navigator built a district (it must build none)").toEqual([]);
});

// ---------------------------------------------------------------------------
// D7-2: the build limit reads the seat's first claim. helpers.ts buildLimit
// uses claimOf(state, seat)?.character, so an Architect that is the seat's
// higher-rank character gets the default limit of one instead of three.
// rules.json (architect): "Your building limit this turn is three."
// ---------------------------------------------------------------------------

test("D7-2 an Architect that is the seat's second character may build three", () => {
  const end = foldAnnTurn(
    armedTurn({
      cast: castFor({ 6: "merchant", 7: "architect" }),
      annChars: ["merchant", "architect"],
      others: [
        [BOB, "magician"],
        [CARA, "warlord"],
      ],
      active: "architect",
      gold: { ann: 30 },
      hands: { ann: ["tavern", "market", "temple", "castle"] },
    }),
    (purpose, state) =>
      purpose === "turn" && rawPlayer(state, ANN).hand.length > 0 ? { t: "build", card: 0 } : null,
  );
  expect(cityIds(end, ANN), "the Architect built only one district (measured 1)").toHaveLength(3);
});

// ---------------------------------------------------------------------------
// D7-3: the Wizard's duplicate-build permission reads the seat's first claim.
// helpers.ts duplicateBlocked uses claimOf(state, seat)?.character, so a
// Wizard that is the seat's higher-rank character is refused a duplicate.
// rules.json (wizard): "During this turn you may build districts identical to
// districts already in your city."
// ---------------------------------------------------------------------------

test("D7-3 a Wizard that is the seat's second character may build a duplicate", () => {
  const end = foldAnnTurn(
    armedTurn({
      cast: castFor({ 2: "thief", 3: "wizard" }),
      annChars: ["thief", "wizard"],
      others: [
        [BOB, "magician"],
        [CARA, "warlord"],
      ],
      active: "wizard",
      gold: { ann: 10 },
      hands: { ann: ["tavern"] },
      cities: { ann: ["tavern"] },
    }),
    (purpose) => (purpose === "turn" ? { t: "build", card: 0 } : null),
  );
  expect(cityIds(end, ANN), "the Wizard's duplicate was refused (measured one tavern)").toEqual([
    "tavern",
    "tavern",
  ]);
});

// ---------------------------------------------------------------------------
// D7-4: the Alchemist's end-of-turn refund marker reads the seat's first claim.
// helpers.ts recordAlchemistSpend tests claimOf(state, seat)?.character !==
// "alchemist", so an Alchemist that is the seat's higher-rank character never
// records its build spend and gets no refund. rules.json (alchemist): "At the
// end of your turn, take back all the gold you paid to build districts this
// turn."
// ---------------------------------------------------------------------------

test("D7-4 an Alchemist that is the seat's second character gets its build spend back", () => {
  const end = foldAnnTurn(
    armedTurn({
      cast: castFor({ 5: "bishop", 6: "alchemist" }),
      annChars: ["bishop", "alchemist"],
      others: [
        [BOB, "magician"],
        [CARA, "warlord"],
      ],
      active: "alchemist",
      gold: { ann: 3 },
      hands: { ann: ["castle"] },
    }),
    (purpose) => (purpose === "turn" ? { t: "build", card: 0 } : null),
  );
  expect(cityIds(end, ANN), "the Alchemist built the castle").toContain("castle");
  expect(rawGold(end, ANN), "the Alchemist's build spend was not refunded (measured 1)").toBe(5);
});

// ---------------------------------------------------------------------------
// D7-5: the Blackmailer's threat resolution reads the threatened seat's first
// claim. characters/blackmailer.ts resolveThreat uses claimOf(state, seat)
// ?.character, so a threat on a seat's higher-rank character never opens the
// bribe window: the seat cannot bribe and the threat is silently dropped.
// rules.json (blackmailer): "they may bribe you by giving half their gold
// rounded down ... removing their marker."
// ---------------------------------------------------------------------------

test("D7-5 a threat on a seat's second character can be bribed away", () => {
  const start = armedTurn({
    cast: castFor({ 2: "blackmailer", 3: "magician", 6: "merchant" }),
    annChars: ["magician", "merchant"],
    others: [
      [BOB, "blackmailer"],
      [CARA, "warlord"],
    ],
    active: "merchant",
    gold: { ann: 10 },
    hands: { ann: [] },
    threats: ["merchant"],
  });
  const blackmailerBefore = rawGold(start, BOB);
  const end = foldAnnTurn(start, (purpose) => {
    if (purpose === "blackmailer-threat") return { t: "choose", value: "bribe" };
    if (purpose === "turn") return { t: "gold" };
    return null;
  });
  expect(end.threats ?? [], "the threat on the seat's second character was never resolved").not.toContain(
    "merchant",
  );
  expect(
    rawGold(end, BOB),
    "the bribe never reached the Blackmailer (measured no gold moved)",
  ).toBeGreaterThan(blackmailerBefore);
});

// ---------------------------------------------------------------------------
// D7-6: the School of Magic's gather declaration reads the seat's first claim.
// districts/school-of-magic.ts incomeTypeOf uses state.claimed.find((entry) =>
// entry.seat === owner) -- the seat's first claim -- so on the onIncome hook the
// card is re-declared to the WRONG character's colour, overriding the correct
// turn-open declaration. A Bishop beside a King declares noble and counts no
// religious district, so its income is short one card.
// rules.json (school-of-magic): "during resource gathering it counts as a
// district of any one type you choose" -- the acting character's type.
// ---------------------------------------------------------------------------

test("D7-6 the School of Magic keeps the acting character's colour when it is the second character", () => {
  const end = foldAnnTurn(
    armedTurn({
      cast: castFor({ 4: "king", 5: "bishop" }),
      annChars: ["king", "bishop"],
      others: [
        [BOB, "magician"],
        [CARA, "warlord"],
      ],
      active: "bishop",
      gold: { ann: 0 },
      hands: { ann: [] },
      cities: { ann: ["school-of-magic"] },
    }),
    (purpose) => (purpose === "turn" ? { t: "gold" } : null),
  );
  const school = rawPlayer(end, ANN).city.find((district) => district.id === "school-of-magic");
  expect(
    school?.declaredType,
    "the School of Magic declared the King's colour, not the Bishop's (measured noble)",
  ).toBe("religious");
  // The Bishop gains 1 gold per religious district: the school (religious) + gather 2.
  // A mis-declared noble school gives no income, so the purse ends at 2 (measured).
  expect(rawGold(end, ANN), "the Bishop's income missed its religious school").toBe(3);
});
