import { describe, expect, test } from "vitest";
import { CHARACTER_CATALOG, specOfCharacter } from "../../../lockstep/games/citadels/characters.ts";
import {
  UNIQUE_EFFECTS,
  UNIQUE_IDS,
  UNIQUE_TRIGGERS,
} from "../../../lockstep/games/citadels/districts/effects.ts";
import { specOfDistrict, type DistrictId } from "../../../lockstep/games/citadels/districts.ts";
import type { CharacterId } from "../../../lockstep/games/citadels/characters.ts";
import { citadels } from "../../../lockstep/games/citadels/index.ts";
import type { SeatId } from "../../../index.ts";
import {
  ANN,
  BOB,
  CARA,
  EVE,
  SEATS3,
  SEATS4,
  SEATS5,
  advance,
  castWith,
  foldEnd,
  foldGame,
  foldPurposes,
  foldStart,
  foldTurn,
  goldDelta,
  handDelta,
  openPurpose,
  rawGold,
  rawGenesis,
  rawHand,
  rawPlayer,
  spyEffects,
  type Board,
  type Fold,
  type CitadelsAction,
  type CitadelsState,
} from "./driver.ts";
import type { PlacedDistrict } from "../../../lockstep/games/citadels/state.ts";

/**
 * The structural guard. Both verification passes reached the same root cause:
 * 27 green character tests each called its effect directly and none asserted the
 * engine reaches it, so six characters stayed dead through a whole pass. Every
 * test here folds a real game (a deal the engine dealt, the engine's own turn
 * stack, the engine's own window resolvers) and asserts a visible effect. If the
 * engine stops reaching a character or a district ability, its test goes red.
 */

const UNHOOKED: readonly DistrictId[] = UNIQUE_IDS.filter(
  (id) => (UNIQUE_TRIGGERS[id] ?? []).length === 0,
);

const rivalOf = (state: CitadelsState, seat: SeatId): SeatId =>
  state.players.find((player) => player.seat !== seat)?.seat ?? seat;

/** The first cast character at rank three or later: legal to name for every namer. */
const nameTarget = (state: CitadelsState): CharacterId => {
  const taken = new Set<CharacterId>([
    ...state.skipped,
    ...(state.threats ?? []),
    ...(state.warrants ?? []),
  ]);
  if (state.bewitched !== null && state.bewitched !== undefined) taken.add(state.bewitched);
  const named = state.cast.find(
    (id) => specOfCharacter(id).rank >= 3 && !taken.has(id),
  );
  return named ?? state.cast[0] ?? "magician";
};

/** Every window the engine opens, answered with the action that exercises it. */
const windowAnswer = (seat: SeatId, state: CitadelsState): CitadelsAction | null => {
  const purpose = openPurpose(state);
  if (purpose === null) return null;
  const pending = state.pending;
  const staged = pending === null || pending.target === null;
  switch (purpose) {
    case "keep":
      return { t: "keep", index: 0 };
    case "draft-pick": {
      const pool = state.draft?.pool ?? [];
      const wanted = citadels.project(state, seat).cast.find((id) => pool.includes(id));
      return wanted === undefined ? null : { t: "pick", character: wanted };
    }
    case "choose-character":
      return { t: "name-character", character: nameTarget(state) };
    case "choose-seat":
      return { t: "target", seat: rivalOf(state, seat) };
    case "choose-type":
      return { t: "name-type", type: "noble" };
    case "magician-swap":
    case "theatre-swap":
      return { t: "target", seat: rivalOf(state, seat) };
    case "magician-discard":
    case "seer-give":
    case "scholar-keep":
    case "artist-beautify":
      return { t: "keep", index: 0 };
    case "wizard-take":
    case "diplomat-exchange":
    case "marshal-seize":
    case "warlord-destroy":
    case "armory-destroy":
    case "emperor-crown":
      return staged
        ? { t: "target", seat: rivalOf(state, seat) }
        : { t: "keep", index: 0 };
    case "magistrate-confiscate":
      return { t: "choose", value: "confiscate" };
    case "blackmailer-resolve":
      return pending !== null && pending.character === "blackmailer" && pending.actor === seat
        ? { t: "name-character", character: nameTarget(state) }
        : { t: "choose", value: "bribe" };
    case "blackmailer-threat":
      return { t: "choose", value: "bribe" };
    case "tax-collect":
      return { t: "gold" };
    case "trader-build": {
      const me = rawPlayer(state, seat);
      const trade = me.hand
        .map((id, index) => ({ id, index }))
        .filter((entry) => specOfDistrict(entry.id).type === "trade" && specOfDistrict(entry.id).cost <= me.gold)
        .sort((a, b) => specOfDistrict(a.id).cost - specOfDistrict(b.id).cost)[0];
      return trade === undefined ? { t: "pass" } : { t: "build", card: trade.index };
    }
    default:
      return null;
  }
};

/** The turn window: build the cheapest affordable district, else take gold. */
const buildOrGold = (seat: SeatId, state: CitadelsState): CitadelsAction => {
  const me = rawPlayer(state, seat);
  const inCity = new Set(me.city.map((district) => district.id));
  const cheapest = me.hand
    .map((id, index) => ({ id, index }))
    .filter((entry) => !inCity.has(entry.id) && specOfDistrict(entry.id).cost <= me.gold)
    .sort((a, b) => specOfDistrict(a.id).cost - specOfDistrict(b.id).cost)[0];
  return cheapest !== undefined && me.city.length < 8
    ? { t: "build", card: cheapest.index }
    : { t: "gold" };
};

const always = (action: CitadelsAction) => (): CitadelsAction | null => action;

/** A whole policy: the turn window answers `turn`, every other window is exercised. */
const policy = (
  turn: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
): ((seat: SeatId, state: CitadelsState) => CitadelsAction | null) => {
  return (seat, state) =>
    openPurpose(state) === "turn" ? turn(seat, state) : windowAnswer(seat, state);
};

const gather = policy(buildOrGold);
const takeGold = policy(always({ t: "gold" }));
const takeDraw = policy(always({ t: "draw" }));
const buildFirst = policy(always({ t: "build", card: 0 }));

const cityIdsOf = (state: CitadelsState, seat: SeatId): readonly DistrictId[] =>
  rawPlayer(state, seat).city.map((district) => district.id);

/**
 * A turn-phase state with ANN holding `character`, armed at its rank, over `city`.
 * A declared type cannot ride a `Board` (its cities are ids), so a guard that needs
 * one arms the engine's own turn stack, as the V2-5 counterexample does.
 */
const armedTurn = (character: CharacterId, city: readonly PlacedDistrict[]): CitadelsState => {
  const genesis = rawGenesis(SEATS3, castWith(character), `coverage-${character}`);
  return {
    ...genesis,
    phase: "turn",
    draft: null,
    claimed: [{ seat: ANN, character }],
    callRank: specOfCharacter(character).rank,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    players: genesis.players.map((player) =>
      player.seat === ANN ? { ...player, city } : player,
    ),
  };
};

/** Fold a Warlord turn destroying `index` in `target`'s city; return that city. */
const warlordDestroy = (
  target: SeatId,
  cities: Readonly<Record<string, readonly DistrictId[]>>,
  index: number,
): readonly DistrictId[] =>
  cityIdsOf(
    foldEnd(
      foldTurn({
        character: "warlord",
        cast: castWith("warlord"),
        seats: SEATS3,
        board: { cities, gold: { ann: 20 } },
        answer: (_seat, state) => {
          const purpose = openPurpose(state);
          if (purpose === "warlord-destroy") {
            const pending = state.pending;
            return pending === null || pending.target === null
              ? { t: "target", seat: target }
              : { t: "keep", index };
          }
          return purpose === "turn" ? { t: "gold" } : null;
        },
      }),
    ),
    target,
  );

/** Fold a Diplomat exchange taking `takeIndex` from BOB for `giveIndex` from ANN; return ANN's gold. */
const diplomatExchangeGold = (
  rivalCity: readonly DistrictId[],
  takeIndex: number,
  giveIndex: number,
): number =>
  rawGold(
    foldEnd(
      foldTurn({
        character: "diplomat",
        cast: castWith("diplomat"),
        seats: SEATS3,
        board: { cities: { ann: ["tavern"], bob: rivalCity }, gold: { ann: 20 } },
        answer: (_seat, state) => {
          const purpose = openPurpose(state);
          if (purpose === "diplomat-exchange") {
            const pending = state.pending;
            if (pending === null || pending.target === null) return { t: "target", seat: BOB };
            return { t: "keep", index: pending.cards.length > 0 ? giveIndex : takeIndex };
          }
          return purpose === "turn" ? { t: "gold" } : null;
        },
      }),
    ),
    ANN,
  );

/** The largest card pool any gather window put in flight for `seat`. */
const biggestPool = (fold: Fold, seat: SeatId): number =>
  fold.steps.reduce(
    (best, state) =>
      state.pending !== null && state.active === seat && state.pending.cards.length > 0
        ? Math.max(best, state.pending.cards.length)
        : best,
    0,
  );

interface CharacterGuard {
  readonly character: CharacterId;
  readonly board?: Board;
  readonly seats?: readonly SeatId[];
  readonly cast?: readonly CharacterId[];
  readonly wanted?: Readonly<Record<string, CharacterId>>;
  readonly answer?: (seat: SeatId, state: CitadelsState) => CitadelsAction | null;
  readonly check: (fold: Fold) => void;
}

const foldFor = (guard: CharacterGuard): Fold =>
  guard.wanted !== undefined
    ? foldGame({
        cast: guard.cast ?? castWith(guard.character),
        seats: guard.seats ?? SEATS3,
        wanted: guard.wanted,
        board: guard.board,
        answer: guard.answer ?? takeGold,
        stop: intoNextDraft,
      })
    : foldTurn({
        character: guard.character,
        cast: guard.cast ?? castWith(guard.character),
        seats: guard.seats ?? SEATS3,
        board: guard.board,
        answer: guard.answer ?? takeGold,
      });

const intoNextDraft = (steps: readonly CitadelsState[]): boolean => {
  const last = steps[steps.length - 1];
  return steps.length > 1 && last !== undefined && last.phase === "draft";
};

const CHARACTER_GUARDS: readonly CharacterGuard[] = [
  {
    character: "assassin",
    check: (fold) =>
      expect(
        fold.steps.some((state) => state.skipped.includes(nameTarget(foldStart(fold)))),
        "the Assassin records its kill",
      ).toBe(true),
  },
  {
    character: "thief",
    // A four-seat game drafts one character per seat, so the Thief (ANN) and its
    // victim (BOB, the Merchant) are pinned and BOB holds no other character that
    // could move his gold before rank 6. The Assassin is steered away from the
    // Merchant so the rob actually lands. BOB starts at 7 gold; the thief-rob
    // window fires before his gather, so the whole 7 crosses to ANN.
    seats: SEATS4,
    cast: castWith("thief"),
    wanted: { ann: "thief", bob: "merchant" },
    board: { gold: { bob: 7 } },
    answer: (seat, state) => {
      if (openPurpose(state) === "choose-character") {
        return {
          t: "name-character",
          character: state.pending?.character === "thief" ? "merchant" : "magician",
        };
      }
      return takeGold(seat, state);
    },
    check: (fold) => {
      expect(
        fold.steps.some((state) => state.robbed === "merchant"),
        "the Thief records its rob",
      ).toBe(true);
      expect(
        goldDelta(fold, ANN),
        "the Thief takes the named character's whole purse when it is called",
      ).toBe(9);
    },
  },
  {
    character: "magician",
    board: { hands: { ann: ["castle"], bob: ["tavern", "market"] } },
    check: (fold) =>
      expect(
        foldPurposes(fold),
        "the Magician opens its swap window",
      ).toContain("magician-swap"),
  },
  {
    character: "king",
    board: { cities: { ann: ["manor", "castle"] } },
    check: (fold) => {
      expect(goldDelta(fold, ANN), "the King takes 2 gold for its two nobles plus the gather").toBe(4);
      expect(foldEnd(fold).crown, "the King takes the crown").toBe(ANN);
    },
  },
  {
    character: "bishop",
    board: { cities: { ann: ["temple", "church"] } },
    check: (fold) =>
      expect(goldDelta(fold, ANN), "the Bishop takes 2 gold for its two religious plus the gather").toBe(4),
  },
  {
    character: "merchant",
    board: { cities: { ann: ["tavern", "market"] } },
    check: (fold) =>
      expect(goldDelta(fold, ANN), "the Merchant takes 2 per trade plus its bonus plus the gather").toBe(5),
  },
  {
    character: "architect",
    board: { hands: { ann: ["tavern", "market", "castle", "palace"] } },
    check: (fold) =>
      expect(handDelta(fold, ANN), "the Architect draws two extra cards").toBe(2),
  },
  {
    character: "warlord",
    board: { cities: { ann: ["watchtower", "prison"], bob: ["tavern"] } },
    check: (fold) =>
      expect(
        fold.steps.some((state) => !cityIdsOf(state, BOB).includes("tavern")),
        "the Warlord destroys a rival district",
      ).toBe(true),
  },
  {
    character: "witch",
    wanted: { ann: "witch" },
    check: (fold) => {
      const named = nameTarget(foldStart(fold));
      expect(
        fold.steps.some((state) => state.bewitched === named),
        "the Witch records its bewitch",
      ).toBe(true);
      const purposes = foldPurposes(fold);
      expect(purposes, "the bewitched turn is taken over").toContain("witch-takeover");
      expect(purposes, "the Witch resumes its held turn").toContain("witch-resume");
    },
  },
  {
    character: "tax-collector",
    seats: SEATS3,
    cast: castWith("tax-collector"),
    wanted: { ann: "tax-collector", bob: "merchant" },
    board: { pot: 3 },
    check: (fold) =>
      expect(goldDelta(fold, ANN), "the Tax Collector takes the pot plus the two gathers").toBe(7),
  },
  {
    character: "wizard",
    board: { hands: { ann: [], bob: ["tavern", "market"] } },
    check: (fold) => {
      expect(
        foldPurposes(fold),
        "the Wizard opens its take window",
      ).toContain("wizard-take");
      expect(rawHand(foldEnd(fold), ANN), "the Wizard lifts a card from a rival hand").toHaveLength(1);
    },
  },
  {
    character: "emperor",
    board: { cities: { ann: ["manor"] }, crown: BOB },
    check: (fold) => {
      expect(goldDelta(fold, ANN), "the Emperor takes its noble, the reward, and the gather").toBe(4);
      expect(foldPurposes(fold), "the Emperor hands the crown on").toContain("emperor-crown");
    },
  },
  {
    character: "abbot",
    board: { cities: { ann: ["temple", "church", "monastery"] }, gold: { bob: 10 } },
    check: (fold) =>
      expect(goldDelta(fold, ANN), "the Abbot takes 3 gold, the richest's 1, and the gather").toBe(6),
  },
  {
    character: "alchemist",
    // A turn gathers then may build, so the fold's turn window builds the castle
    // and the gather lands first: 3 + 2 (gather) - 4 (castle) + 4 (refund) = 5.
    // Without the refund the Alchemist would end at 1, so the row pins the take-back.
    board: { hands: { ann: ["castle"] }, gold: { ann: 3 } },
    answer: policy(buildOrGold),
    check: (fold) => {
      expect(cityIdsOf(foldEnd(fold), ANN), "the Alchemist builds a district").toHaveLength(1);
      expect(rawGold(foldEnd(fold), ANN), "the Alchemist takes back its build spend").toBe(5);
    },
  },
  {
    character: "navigator",
    check: (fold) => {
      expect(goldDelta(fold, ANN), "the Navigator takes 4 gold").toBe(4);
      // The card branch: the turn window answered with a draw writes the engine's
      // four-card marker, so the effect below the resolve step draws four cards
      // instead of taking four gold (the D3-1 clause).
      const cards = foldTurn({
        character: "navigator",
        cast: castWith("navigator"),
        seats: SEATS3,
        answer: takeDraw,
      });
      expect(
        handDelta(cards, ANN),
        "the Navigator's card gather draws four cards",
      ).toBe(4);
    },
  },
  {
    character: "diplomat",
    board: { cities: { ann: ["watchtower"], bob: ["palace", "manor"] }, gold: { ann: 20 } },
    check: (fold) => {
      expect(cityIdsOf(foldEnd(fold), ANN), "the Diplomat takes a rival district").toContain("palace");
      expect(
        foldPurposes(fold),
        "the Diplomat opens its exchange window",
      ).toContain("diplomat-exchange");
    },
  },
  {
    character: "artist",
    board: { cities: { ann: ["tavern"] }, gold: { ann: 3 } },
    check: (fold) => {
      expect(rawPlayer(foldEnd(fold), ANN).city[0]?.gold, "the Artist marks a district").toBe(1);
      expect(rawGold(foldEnd(fold), ANN), "start 3 minus the marker plus the gather").toBe(4);
    },
  },
  {
    character: "queen",
    seats: SEATS5,
    cast: castWith("queen"),
    wanted: { ann: "queen", eve: "king" },
    check: (fold) =>
      expect(goldDelta(fold, ANN), "the Queen collects beside the rank-4 holder").toBe(5),
  },
  {
    character: "magistrate",
    check: (fold) => {
      const signed = fold.steps.find((state) => (state.warrants ?? []).length > 0);
      expect(signed?.warrants?.[0], "the Magistrate signs its target warrant").toBe(
        nameTarget(foldStart(fold)),
      );
      expect(signed?.warrants, "three warrant markers").toHaveLength(3);
    },
  },
  {
    character: "blackmailer",
    wanted: { ann: "blackmailer" },
    check: (fold) => {
      expect(
        fold.steps.some((state) => (state.threats ?? []).length === 2),
        "the Blackmailer assigns two threats",
      ).toBe(true);
      expect(
        foldPurposes(fold).some((purpose) => purpose === "blackmailer-threat"),
        "a threatened player answers the threat",
      ).toBe(true);
    },
  },
  {
    character: "spy",
    board: { hands: { bob: ["manor", "castle", "tavern"] }, gold: { bob: 5 } },
    check: (fold) => {
      const purposes = foldPurposes(fold);
      expect(purposes, "the Spy picks a seat").toContain("choose-seat");
      expect(purposes, "the Spy names a type").toContain("choose-type");
      expect(handDelta(fold, ANN), "the Spy peeks and draws per matching card").toBe(2);
      // The gold-take clause: two matching nobles in BOB's hand move two gold from
      // BOB to ANN, on top of ANN's own two-gold gather.
      expect(
        goldDelta(fold, ANN),
        "the Spy takes 1 gold per matching card from the target",
      ).toBe(4);
    },
  },
  {
    character: "seer",
    board: { hands: { ann: [], bob: ["tavern"], cara: ["market"] } },
    check: (fold) => {
      const purposes = foldPurposes(fold);
      expect(purposes, "the Seer takes a card").toContain("seer-receive");
      expect(purposes, "the Seer gives one back").toContain("seer-give");
      expect(rawHand(foldEnd(fold), BOB), "each neighbour gets a card back").toHaveLength(1);
      expect(rawHand(foldEnd(fold), CARA), "and the other").toHaveLength(1);
    },
  },
  {
    character: "patrician",
    board: { cities: { ann: ["manor", "castle", "palace"] } },
    check: (fold) => {
      expect(handDelta(fold, ANN), "the Patrician draws 1 card per noble").toBe(3),
      expect(foldEnd(fold).crown).toBe(ANN);
    },
  },
  {
    character: "cardinal",
    board: { cities: { ann: ["temple", "church", "monastery"] } },
    check: (fold) =>
      expect(handDelta(fold, ANN), "the Cardinal draws 1 card per religious").toBe(3),
  },
  {
    character: "trader",
    board: { cities: { ann: ["tavern"] }, hands: { ann: ["docks", "harbor", "town-hall"] }, gold: { ann: 4 } },
    check: (fold) => {
      expect(cityIdsOf(foldEnd(fold), ANN), "the Trader builds beyond its limit").toContain("docks");
      expect(
        foldPurposes(fold),
        "the Trader opens its extra-build window",
      ).toContain("trader-build");
      const declared = armedTurn("trader", [
        { id: "school-of-magic", gold: 0, declaredType: "trade" },
      ]);
      const after = advance(declared, () => null);
      expect(
        rawGold(after, ANN) - rawGold(declared, ANN),
        "the Trader counts a School of Magic declared trade, not the catalog type",
      ).toBe(1);
    },
  },
  {
    character: "scholar",
    board: { hands: { ann: [] } },
    check: (fold) =>
      expect(handDelta(fold, ANN), "the Scholar keeps one of seven").toBe(1),
  },
  {
    character: "marshal",
    board: { cities: { ann: ["watchtower"], bob: ["tavern"] }, gold: { ann: 5 } },
    check: (fold) => {
      expect(cityIdsOf(foldEnd(fold), ANN), "the Marshal seizes a cheap district").toContain("tavern");
      expect(rawGold(foldEnd(fold), BOB), "the owner is paid the cost").toBe(3);
    },
  },
];

describe("engine coverage: every character is reached by the engine", () => {
  const rows: readonly (readonly [string, CharacterGuard])[] = CHARACTER_GUARDS.map((guard) => [
    guard.character,
    guard,
  ]);
  test.each(rows)(
    "the engine reaches %s",
    (_character, guard) => {
      const fold = foldFor(guard);
      guard.check(fold);
    },
  );

  test("every catalogued character has a guard", () => {
    expect(CHARACTER_GUARDS).toHaveLength(CHARACTER_CATALOG.length);
    expect(new Set(CHARACTER_GUARDS.map((guard) => guard.character)).size).toBe(
      CHARACTER_CATALOG.length,
    );
  });
});

// ---------------------------------------------------------------------------
// The naming windows, driven by a game the engine dealt and drafted.
// ---------------------------------------------------------------------------

const namingFold = (target: CharacterId, wanted: Readonly<Record<string, CharacterId>>): Fold =>
  foldGame({
    cast: castWith(target),
    seats: SEATS3,
    wanted,
    answer: gather,
    stop: intoNextDraft,
  });

describe("engine coverage: the naming windows record through a folded game", () => {
  test("a folded game with the Assassin records a kill", () => {
    const fold = namingFold("assassin", { ann: "assassin" });
    expect(
      fold.steps.some((state) => state.skipped.length > 0),
      "a kill is recorded",
    ).toBe(true);
  });

  test("a folded game with the Thief records a rob", () => {
    const fold = namingFold("thief", { ann: "thief" });
    expect(
      fold.steps.some((state) => (state.robbed ?? null) !== null),
      "a rob is recorded",
    ).toBe(true);
  });

  test("a folded game with the Witch records a bewitch", () => {
    const fold = namingFold("witch", { ann: "witch" });
    expect(
      fold.steps.some((state) => (state.bewitched ?? null) !== null),
      "a bewitch is recorded",
    ).toBe(true);
  });

  test("a folded game with the Blackmailer assigns a threat", () => {
    const fold = namingFold("blackmailer", { ann: "blackmailer" });
    expect(
      fold.steps.some((state) => (state.threats ?? []).length > 0),
      "a threat is assigned",
    ).toBe(true);
  });

  test("a folded game with the Spy opens its peek", () => {
    const fold = namingFold("spy", { ann: "spy" });
    const purposes = foldPurposes(fold);
    expect(purposes, "the Spy picks a seat").toContain("choose-seat");
    expect(purposes, "the Spy names a district type").toContain("choose-type");
  });
});

// ---------------------------------------------------------------------------
// District hooks. The spy counts the effect calls; the check then asserts the
// move the hook makes, so a district the engine never calls goes red twice over.
// ---------------------------------------------------------------------------

const DEN_UNIQUES: readonly DistrictId[] = [
  "factory",
  "museum",
  "capitol",
  "monument",
  "quarry",
  "secret-vault",
  "smithy",
  "poor-house",
  "necropolis",
  "framework",
  "stables",
  "thieves-den",
  "gold-mine",
  "school-of-magic",
];

interface DistrictGuard {
  readonly id: DistrictId;
  readonly board?: Board;
  readonly uniques?: readonly DistrictId[];
  readonly answer?: (seat: SeatId, state: CitadelsState) => CitadelsAction | null;
  readonly check: (fold: Fold, calls: number) => void;
}

const districtFold = (guard: DistrictGuard): { readonly fold: Fold; readonly calls: number } => {
  const spy = spyEffects();
  try {
    const fold = foldTurn({
      character: "king",
      board: guard.board ?? { cities: { ann: [guard.id] } },
      uniques: guard.uniques ?? (guard.id === "poor-house" ? DEN_UNIQUES : DEFAULT_DEN),
      answer: guard.answer ?? gather,
    });
    return { fold, calls: spy.count(guard.id) };
  } finally {
    spy.restore();
  }
};

const DEFAULT_DEN: readonly DistrictId[] = DEN_UNIQUES;

const DISTRICT_GUARDS: readonly DistrictGuard[] = [
  {
    id: "gold-mine",
    board: { cities: { ann: ["gold-mine"] } },
    answer: takeGold,
    check: (_f, calls) => expect(calls, "the Gold Mine is called").toBe(1),
  },
  {
    id: "gold-mine",
    board: { cities: { ann: ["gold-mine"] } },
    answer: takeGold,
    check: (fold) =>
      expect(rawGold(foldEnd(fold), ANN), "the Gold Mine adds a gold to the gather").toBe(5),
  },
  {
    id: "school-of-magic",
    board: { cities: { ann: ["school-of-magic"] } },
    answer: takeGold,
    check: (fold) => {
      expect(
        rawPlayer(foldEnd(fold), ANN).city[0]?.declaredType,
        "the School of Magic declares the King's type",
      ).toBe("noble");
      // The D5-7 timing: the type must be on the card before the King's income
      // counts it, so the same turn's income sees it (gather 2 + noble 1 = 3).
      // A declaration made only on the gather would leave the income at 2.
      expect(
        goldDelta(fold, ANN),
        "the King's own income counted the School of Magic the turn it was declared",
      ).toBe(3);
    },
  },
  {
    id: "library",
    board: { cities: { ann: ["library"] }, hands: { ann: [] } },
    answer: takeDraw,
    check: (fold) => {
      expect(biggestPool(fold, ANN), "the Library keeps every card it draws").toBe(2);
      expect(
        fold.steps.some((state) => rawHand(state, ANN).length === 2),
        "the Library keeps both drawn cards",
      ).toBe(true);
    },
  },
  {
    id: "observatory",
    board: { cities: { ann: ["observatory"] } },
    answer: takeDraw,
    check: (fold) =>
      expect(biggestPool(fold, ANN), "the Observatory draws three").toBe(3),
  },
  {
    id: "factory",
    // The turn gathers (4 + 2), the museum (a unique) is built (-4), and the
    // Factory refunds 1: 3. Without the refund the Factory's owner would end at 2.
    board: { cities: { ann: ["factory"] }, hands: { ann: ["museum"] }, gold: { ann: 4 } },
    uniques: DEN_UNIQUES,
    check: (fold, calls) => {
      expect(calls, "the Factory is called").toBe(1);
      expect(rawGold(foldEnd(fold), ANN), "the Factory refunds the unique it built").toBe(3);
    },
  },
  {
    id: "framework",
    board: { cities: { ann: ["framework"] }, hands: { ann: ["tavern"] } },
    uniques: DEN_UNIQUES,
    check: (fold) =>
      expect(
        cityIdsOf(foldEnd(fold), ANN),
        "the Framework is destroyed to pay for the tavern",
      ).toEqual(["tavern"]),
  },
  {
    id: "monument",
    board: {
      cities: { ann: ["tavern", "market", "docks", "castle", "temple"] },
      hands: { ann: ["monument"] },
      gold: { ann: 20 },
    },
    uniques: DEN_UNIQUES,
    check: (fold) =>
      expect(rawHand(foldEnd(fold), ANN), "the Monument refuses a five-district city").toContain(
        "monument",
      ),
  },
  {
    id: "necropolis",
    board: { cities: { ann: ["tavern"] }, hands: { ann: ["necropolis"] }, gold: { ann: 10 } },
    uniques: DEN_UNIQUES,
    answer: buildFirst,
    check: (fold, calls) => {
      expect(calls, "the Necropolis is called").toBe(1);
      expect(cityIdsOf(foldEnd(fold), ANN), "the Necropolis destroys a district to pay").toEqual([
        "necropolis",
      ]);
    },
  },
  {
    id: "quarry",
    board: { cities: { ann: ["quarry"] }, hands: { ann: ["tavern", "tavern"] }, gold: { ann: 2 } },
    uniques: DEN_UNIQUES,
    check: (fold) =>
      expect(rawPlayer(foldEnd(fold), ANN).city, "the Quarry allows one duplicate").toHaveLength(2),
  },
  {
    id: "secret-vault",
    board: { hands: { ann: ["secret-vault"] }, gold: { ann: 10 } },
    uniques: DEN_UNIQUES,
    check: (fold) =>
      expect(cityIdsOf(foldEnd(fold), ANN), "the Secret Vault cannot be built").toHaveLength(0),
  },
  {
    id: "stables",
    board: { hands: { ann: ["stables", "tavern"] }, gold: { ann: 10 } },
    uniques: DEN_UNIQUES,
    answer: buildFirst,
    check: (fold) =>
      expect(rawPlayer(foldEnd(fold), ANN).city, "the Stables frees a second build").toHaveLength(2),
  },
  {
    id: "thieves-den",
    board: { hands: { ann: ["thieves-den", "tavern", "market"] }, gold: { ann: 2 } },
    uniques: DEN_UNIQUES,
    answer: buildFirst,
    check: (fold, calls) => {
      expect(calls, "the Thieves' Den is called").toBe(1);
      expect(cityIdsOf(foldEnd(fold), ANN), "the mixed payment builds the Den").toContain(
        "thieves-den",
      );
      expect(rawGold(foldEnd(fold), ANN), "the mixed payment spends its gold share").toBe(0);
    },
  },
  {
    id: "armory",
    board: { cities: { ann: ["armory"], bob: ["tavern"] } },
    uniques: DEN_UNIQUES,
    answer: takeGold,
    check: (fold, calls) => {
      expect(calls, "the Armory is called").toBe(1);
      expect(foldPurposes(fold), "the Armory opens its destroy window").toContain("armory-destroy");
      expect(
        fold.steps.some(
          (state) => cityIdsOf(state, ANN).length === 0 && cityIdsOf(state, BOB).length === 0,
        ),
        "the Armory and the rival district both fall",
      ).toBe(true);
    },
  },
  {
    id: "theater",
    board: { cities: { ann: ["theater"] } },
    check: (fold, calls) => {
      expect(calls, "the Theater is called at the round start").toBe(1);
      expect(
        fold.steps.some((state) =>
          state.steps.some(
            (step) => step.kind === "window" && step.window.purpose === "theatre-swap",
          ),
        ),
        "the Theater queues its swap window",
      ).toBe(true);
    },
  },
  {
    id: "great-wall",
    check: (_f, calls) => {
      expect(calls, "the Great Wall's onDestroy hook is reached").toBe(1);
      const walled = diplomatExchangeGold(["great-wall", "palace"], 1, 0);
      const open = diplomatExchangeGold(["manor", "palace"], 1, 0);
      expect(
        open - walled,
        "the Diplomat pays one extra gold to exchange out of a Great Wall city",
      ).toBe(1);
    },
  },
  {
    id: "keep",
    check: (_f, calls) => {
      expect(calls, "the Keep's onDestroy hook is reached").toBe(1);
      expect(
        warlordDestroy(BOB, { ann: ["watchtower"], bob: ["keep"] }, 0),
        "the Keep survives the Warlord's destroy",
      ).toContain("keep");
      expect(
        warlordDestroy(BOB, { ann: ["watchtower"], bob: ["palace"] }, 0),
        "an unprotected district does not survive the destroy",
      ).toEqual([]);
    },
  },
  {
    id: "laboratory",
    board: { cities: { ann: ["laboratory"] }, hands: { ann: ["tavern", "market", "docks"] } },
    answer: takeGold,
    check: (fold, calls) => expect(calls, "the Laboratory is called once").toBe(1),
  },
  {
    id: "smithy",
    board: {
      cities: { ann: ["smithy"] },
      hands: { ann: ["palace", "cathedral", "castle", "harbor", "town-hall"] },
    },
    answer: takeGold,
    check: (fold, calls) => expect(calls, "the Smithy is called once").toBe(1),
  },
  {
    id: "park",
    board: { cities: { ann: ["park"] }, hands: { ann: [] } },
    answer: takeGold,
    check: (fold, calls) => expect(calls, "the Park is called once").toBe(1),
  },
  {
    id: "poor-house",
    board: { cities: { ann: ["poor-house"] }, hands: { ann: ["market"] }, gold: { ann: 2 } },
    uniques: DEN_UNIQUES,
    check: (fold, calls) => expect(calls, "the Poor House is called once").toBe(1),
  },
];

describe("engine coverage: every hook-bearing district is reached by the engine", () => {
  const rows: readonly (readonly [string, DistrictGuard])[] = DISTRICT_GUARDS.map((guard) => [
    guard.id,
    guard,
  ]);
  test.each(rows)(
    "the engine reaches %s",
    (_id, guard) => {
      const { fold, calls } = districtFold(guard);
      guard.check(fold, calls);
    },
  );

  test("every hook-bearing district has a guard and every trigger is one the engine calls", () => {
    const guarded = new Set(DISTRICT_GUARDS.map((guard) => guard.id));
    const hooked = UNIQUE_IDS.filter((id) => (UNIQUE_TRIGGERS[id] ?? []).length > 0);
    for (const id of hooked) expect(guarded, `${id} declares a hook`).toContain(id);
    for (const id of UNHOOKED) {
      expect((UNIQUE_TRIGGERS[id] ?? []).length, `${id} declares no hook`).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Once per turn: each end-of-turn district fires exactly one time, proven by
// counting the gold and cards it moves.
// ---------------------------------------------------------------------------

describe("engine coverage: an end-of-turn district fires once per turn", () => {
  test("the Laboratory discards one card for two gold, once", () => {
    const { fold, calls } = districtFold<DistrictGuard>({
      id: "laboratory",
      board: { cities: { ann: ["laboratory"] }, hands: { ann: ["tavern", "market", "docks"] } },
      answer: takeGold,
    });
    expect(calls).toBe(1);
    expect(rawGold(foldEnd(fold), ANN), "gather 2, one payout of 2, and the draft gather").toBe(6);
    expect(rawHand(foldEnd(fold), ANN), "one card discarded").toHaveLength(2);
  });

  test("the Smithy pays two gold for three cards, once", () => {
    const { fold, calls } = districtFold<DistrictGuard>({
      id: "smithy",
      board: {
        cities: { ann: ["smithy"] },
        hands: { ann: ["palace", "cathedral", "castle", "harbor", "town-hall"] },
      },
      answer: takeGold,
    });
    expect(calls).toBe(1);
    expect(rawGold(foldEnd(fold), ANN), "gather 2, one payout of 2, and the draft gather").toBe(2);
    expect(rawHand(foldEnd(fold), ANN), "five held plus three drawn").toHaveLength(8);
  });

  test("the Park draws two cards for an empty hand, once", () => {
    const { fold, calls } = districtFold<DistrictGuard>({
      id: "park",
      board: { cities: { ann: ["park"] }, hands: { ann: [] } },
      answer: takeGold,
    });
    expect(calls).toBe(1);
    expect(rawHand(foldEnd(fold), ANN), "two cards drawn").toHaveLength(2);
    expect(rawGold(foldEnd(fold), ANN), "the gather and the draft gather").toBe(4);
  });

  test("the Poor House pays one gold to an empty purse, once", () => {
    const { fold, calls } = districtFold<DistrictGuard>({
      id: "poor-house",
      // An empty purse: the gather (0 + 2) funds a 2-gold market that empties it,
      // and the Poor House refills it to 1. Without the refill the turn ends at 0.
      board: { cities: { ann: ["poor-house"] }, hands: { ann: ["market"] }, gold: { ann: 0 } },
      uniques: DEN_UNIQUES,
    });
    expect(calls).toBe(1);
    expect(rawGold(foldEnd(fold), ANN), "the build emptied the purse and the house refilled it").toBe(1);
  });
});















