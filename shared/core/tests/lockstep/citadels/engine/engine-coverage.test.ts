import { describe, expect, test } from "vitest";
import { CHARACTER_CATALOG, specOfCharacter } from "../../../../lockstep/games/citadels/characters.ts";
import {
  UNIQUE_EFFECTS,
  UNIQUE_IDS,
  UNIQUE_TRIGGERS,
} from "../../../../lockstep/games/citadels/districts/effects.ts";
import { specOfDistrict, type DistrictId } from "../../../../lockstep/games/citadels/districts.ts";
import type { CharacterId } from "../../../../lockstep/games/citadels/characters.ts";
import { citadels } from "../../../../lockstep/games/citadels/index.ts";
import { buildLimit } from "../../../../lockstep/games/citadels/helpers.ts";
import type { SeatId } from "../../../../index.ts";
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
  foldFrom,
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
} from "../driver.ts";
import type { PlacedDistrict } from "../../../../lockstep/games/citadels/state.ts";

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

/** A cast with the Blackmailer at rank 2 and the target at its own rank. */
const castWithThreat = (target: CharacterId): readonly CharacterId[] => {
  const cast = [...castWith("blackmailer")];
  cast[specOfCharacter(target).rank - 1] = target;
  return cast;
};

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
      // The D5-1..4 resume: the bewitched character's own ability runs on the
      // resumed turn. With the Architect bewitched, the resume draws its two
      // cards onto the Witch's hand. Removing the resume's resolve step leaves
      // the hand empty.
      const witchCast = castWith("witch").slice();
      witchCast[0] = "witch";
      witchCast[specOfCharacter("architect").rank - 1] = "architect";
      const base = rawGenesis(SEATS3, witchCast, "coverage-witch-resume");
      let resumed: CitadelsState = {
        ...base,
        phase: "turn",
        draft: null,
        claimed: [
          { seat: CARA, character: "architect" },
          { seat: BOB, character: "thief" },
          { seat: ANN, character: "witch" },
        ],
        callRank: 1,
        active: ANN,
        steps: [{ kind: "call" }, { kind: "end-round" }],
        pending: null,
        builtThisTurn: 0,
        players: base.players.map((player) =>
          player.seat === ANN ? { ...player, gold: 10, hand: [], city: [] } : player,
        ),
      };
      for (let i = 0; i < 200 && resumed.phase !== "draft"; i += 1) {
        resumed = advance(resumed, (seat, state) => {
          const purpose = openPurpose(state);
          if (purpose === "choose-character") {
            return { t: "name-character", character: "architect" };
          }
          if (purpose === "turn") return { t: "gold" };
          if (purpose === "keep") return { t: "keep", index: 0 };
          return null;
        });
      }
      expect(
        rawHand(resumed, ANN),
        "the resume ran the bewitched Architect's two-card draw",
      ).toHaveLength(2);
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
      // The D5-5 deferral: a threatened seat gathers, resolves the threat, then
      // builds. Nothing stands in its city while the threat is open, and the
      // build lands only after. A build that lands ahead of the threat, or one
      // dropped with the deferral, both fail these two rows.
      const base = rawGenesis(SEATS3, castWith("blackmailer"), "coverage-blackmailer-defer");
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
      const answerThreat = (_seat: SeatId, state: CitadelsState): CitadelsAction | null => {
        const purpose = openPurpose(state);
        if (purpose === "turn") return { t: "build", card: 0 };
        if (purpose === "blackmailer-threat") return { t: "choose", value: "bribe" };
        return null;
      };
      let threatState: CitadelsState | null = null;
      let end = armed;
      for (let i = 0; i < 40 && end.phase !== "draft"; i += 1) {
        if (threatState === null && openPurpose(end) === "blackmailer-threat") threatState = end;
        end = advance(end, answerThreat);
      }
      expect(
        threatState === null ? [] : cityIdsOf(threatState, BOB),
        "no district stands in the threatened seat's city while the threat is open",
      ).toEqual([]);
      expect(cityIdsOf(end, BOB), "the threatened build lands after the threat").toContain(
        "tavern",
      );

      // The refuse path. Every row above answers the threat with a bribe, so a
      // refused threat was never folded by the guard and the tenth pass found
      // three defects in it: D10-1 a refused seat gathered a second time, D10-2 a
      // refused Navigator lost the gain its reveal wiped, D10-3 the Navigator's
      // threat resolved before it gained. rules.json (blackmailer): "When a
      // threatened player is called, they must gather resources, then resolve the
      // threat ... or refuse. If they refuse you may reveal their marker." The
      // Blackmailer answers the reveal window with an idle, so no gold crosses and
      // only the ordering of gather and threat is under test.
      const refuse = (threatened: CharacterId, gold: number): CitadelsState => {
        const base = rawGenesis(
          SEATS3,
          castWithThreat(threatened),
          "coverage-blackmailer-refuse",
        );
        let cur: CitadelsState = {
          ...base,
          phase: "turn",
          draft: null,
          claimed: [
            { seat: CARA, character: "assassin" },
            { seat: ANN, character: "blackmailer" },
            { seat: BOB, character: threatened },
          ],
          callRank: specOfCharacter(threatened).rank,
          active: BOB,
          steps: [{ kind: "call" }, { kind: "end-round" }],
          pending: null,
          builtThisTurn: 0,
          threats: [threatened, "assassin"],
          players: base.players.map((player) =>
            player.seat === BOB ? { ...player, gold, hand: [], city: [] } : player,
          ),
        };
        for (let i = 0; i < 40 && cur.phase !== "draft"; i += 1) {
          cur = advance(cur, (_seat, state) => {
            const purpose = openPurpose(state);
            if (purpose === "turn") return { t: "gold" };
            if (purpose === "keep") return { t: "keep", index: 0 };
            if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
            return null;
          });
        }
        return cur;
      };
      // The threat resolves once, so its marker is off the table at the turn's end.
      expect(
        refuse("king", 0).threats ?? [],
        "the refused threat resolved and its marker came off",
      ).not.toContain("king");
      // One gather: 0 + 2. A second gather on the post-threat build window is the
      // D10-1 double gather, measured 4 on the head this guard missed.
      expect(rawGold(refuse("king", 0), BOB), "the refused King gathered exactly once").toBe(2);
      // The gain lands before the threat opens, and the reveal that follows a
      // refused threat must not wipe it: 0 + 4, measured 0 on that head.
      expect(
        rawGold(refuse("navigator", 0), BOB),
        "the refused Navigator kept the four gold it gained",
      ).toBe(4);
      expect(
        rawGold(refuse("navigator", 0), ANN),
        "the Blackmailer took nothing from the unrevealed refusal",
      ).toBe(2);
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
    check: (fold) => {
      expect(handDelta(fold, ANN), "the Cardinal draws 1 card per religious").toBe(3);
      // The D5-6 shortfall clause: a Cardinal that cannot pay for its build takes
      // the gap from a donor and still lands the district. The cathedral (cost 5)
      // sits against 1 gold plus the 2-gold gather, so the donor covers 2.
      const short = foldTurn({
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
      expect(
        cityIdsOf(foldEnd(short), ANN),
        "the Cardinal builds the cathedral its donor paid for",
      ).toContain("cathedral");
      expect(rawGold(foldEnd(short), BOB), "the donor covers the shortfall").toBe(8);
    },
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

/** The fold inputs `districtFold` reads. A table row adds `check` on top of these. */
interface DistrictFoldInput {
  readonly id: DistrictId;
  readonly board?: Board;
  readonly uniques?: readonly DistrictId[];
  readonly answer?: (seat: SeatId, state: CitadelsState) => CitadelsAction | null;
}

interface DistrictGuard extends DistrictFoldInput {
  /** Test-row label; defaults to `id`, and differs when one district has two guards. */
  readonly label?: string;
  readonly check: (fold: Fold, calls: number) => void;
}

const districtFold = (guard: DistrictFoldInput): { readonly fold: Fold; readonly calls: number } => {
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
    label: "gold-mine-hook",
    board: { cities: { ann: ["gold-mine"] } },
    answer: takeGold,
    check: (_f, calls) => expect(calls, "the Gold Mine is called").toBe(1),
  },
  {
    id: "gold-mine",
    label: "gold-mine-gold",
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
    guard.label ?? guard.id,
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
    const { fold, calls } = districtFold({
      id: "laboratory",
      board: { cities: { ann: ["laboratory"] }, hands: { ann: ["tavern", "market", "docks"] } },
      answer: takeGold,
    });
    expect(calls).toBe(1);
    expect(rawGold(foldEnd(fold), ANN), "gather 2, one payout of 2, and the draft gather").toBe(6);
    expect(rawHand(foldEnd(fold), ANN), "one card discarded").toHaveLength(2);
  });

  test("the Smithy pays two gold for three cards, once", () => {
    const { fold, calls } = districtFold({
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
    const { fold, calls } = districtFold({
      id: "park",
      board: { cities: { ann: ["park"] }, hands: { ann: [] } },
      answer: takeGold,
    });
    expect(calls).toBe(1);
    expect(rawHand(foldEnd(fold), ANN), "two cards drawn").toHaveLength(2);
    expect(rawGold(foldEnd(fold), ANN), "the gather and the draft gather").toBe(4);
  });

  test("the Poor House pays one gold to an empty purse, once", () => {
    const { fold, calls } = districtFold({
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
















// ---------------------------------------------------------------------------
// A two-character seat. In a 2- or 3-player game each seat drafts two characters
// (setup.ts perSeat = 2). No row above folds such a seat — every guard hands its
// seats one claim — so a defect that lives only in the two-character dimension
// (the seventh- and eighth-pass families) is unreachable by this guard suite.
// These two rows fold a seat that holds two claims.
// ---------------------------------------------------------------------------

describe("engine coverage: a two-character seat", () => {
  /**
   * D8-1 teeth. ANN holds the Witch AND the Architect (a two-character seat);
   * her city holds a School of Magic. The Witch bewitches the Bishop and resumes
   * as it, playing the Bishop with her own city. The school must declare the
   * Bishop's religious colour before the income above the turn window counts it.
   * Remove the resume declaration (characters/witch.ts) and the card stays
   * undeclared: declaredType undefined and the purse one gold short (4, not 5).
   */
  test("the Witch's resume declares the School of Magic of a two-character seat", () => {
    const base = rawGenesis(SEATS3, castWith("witch"), "coverage-two-char-witch");
    const armed: CitadelsState = {
      ...base,
      phase: "turn",
      draft: null,
      claimed: [
        { seat: ANN, character: "witch" },
        { seat: ANN, character: "architect" },
        { seat: BOB, character: "bishop" },
        { seat: CARA, character: "warlord" },
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
              gold: 0,
              hand: ["tavern"] as DistrictId[],
              city: [{ id: "school-of-magic" as DistrictId, gold: 0 }],
            }
          : player,
      ),
    };
    const steps: CitadelsState[] = [armed];
    for (let i = 0; i < 300 && steps[steps.length - 1]!.phase !== "draft"; i += 1) {
      steps.push(
        advance(steps[steps.length - 1]!, (_seat, state) => {
          const purpose = openPurpose(state);
          if (purpose === "choose-character") return { t: "name-character", character: "bishop" };
          if (purpose === "witch-takeover" || purpose === "witch-resume") return { t: "pass" };
          if (purpose === "turn") return { t: "gold" };
          if (purpose === "keep") return { t: "keep", index: 0 };
          return null;
        }),
      );
    }
    const end = steps[steps.length - 1] as CitadelsState;
    const school = rawPlayer(end, ANN).city.find((district) => district.id === "school-of-magic");
    expect(
      school?.declaredType,
      "the Witch's resumed turn declared her School of Magic the Bishop's colour",
    ).toBe("religious");
    // The Witch gathers +2 on her held turn (gold 2); the resumed Bishop turn then
    // adds 1 per religious, counting the declared school (gold 3). Without the
    // resume declaration the school is unique, the Bishop adds 0, and the fold
    // never reaches 3 before the second character's gather moves it past.
    expect(
      steps.some((state) => rawGold(state, ANN) === 3),
      "the Bishop income counted the declared school on the resume",
    ).toBe(true);
  });

  /**
   * D8-2 teeth. ANN holds two claims (assassin rank 1, merchant rank 6) and owns
   * the Theater; the theatre-swap window is open owed by ANN. rules.json
   * (theatre): "In 2-3 player games you choose which of your two characters to
   * give and randomly take one of your opponent's." ANN answers with keep index
   * 1 (the merchant). A resolver that always gives the lowest-rank claim keeps
   * merchant and gives assassin, failing both rows.
   */
  test("the Theater owner gives the claim it chooses from a two-character seat", () => {
    const base = rawGenesis(SEATS3, castWith("assassin"), "coverage-two-char-theater");
    const armed: CitadelsState = {
      ...base,
      phase: "turn",
      draft: null,
      claimed: [
        { seat: ANN, character: "assassin" },
        { seat: ANN, character: "merchant" },
        { seat: BOB, character: "king" },
        { seat: BOB, character: "bishop" },
        { seat: CARA, character: "architect" },
        { seat: CARA, character: "warlord" },
      ],
      callRank: 1,
      active: ANN,
      steps: [
        { kind: "window", window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] } },
        { kind: "call" },
        { kind: "end-round" },
      ],
      pending: null,
      builtThisTurn: 0,
    };
    const after = advance(armed, (seat) => (seat === ANN ? { t: "keep", index: 1 } : null));
    const annAfter = after.claimed
      .filter((claim) => claim.seat === ANN)
      .map((claim) => claim.character);
    expect(annAfter, "the owner gave its higher-rank claim").not.toContain("merchant");
    expect(annAfter, "the owner kept its lowest-rank claim").toContain("assassin");
  });
});


// ---------------------------------------------------------------------------
// The Museum's once-per-turn placement offer. No row above folds a character
// turn that OWNS a Museum, so the ninth-pass defects (D9-1, D9-2) were
// unreachable by this guard suite. These two rows fold a Museum-owning turn:
// the offer rides the `keep` window, so a character turn that reaches it must
// open that window and route its report to `museumPlace`.
// ---------------------------------------------------------------------------

describe("engine coverage: a character turn that owns a Museum", () => {
  const museumOf = (state: CitadelsState, seat: SeatId) =>
    rawPlayer(state, seat).city.find((district) => district.id === "museum");

  /**
   * D9-1 teeth. ANN holds the Alchemist and her city holds a Museum; her hand is
   * [market, tavern] and she starts at 0 gold. The turn gathers 2, builds the
   * cost-1 Market (2 -> 1), and the V2-7 settle refunds the 1: gold ends at 2,
   * and the Museum's offer must then tuck one card. The Alchemist's build leaves a
   * NON-null spend pending standing when the turn closes; an offer that appends a
   * bare `keep` window (routing by pending-is-null) overwrites it, so the refund
   * never lands and the card is never tucked. Revert the MUSEUM_OFFER_NOTE tag or
   * the resolveKeep tag check and both assertions below go RED (gold 0, cards
   * undefined). The control — the same turn with no Museum — ends at the same gold.
   */
  test("the Alchemist's build with a Museum keeps its refund and still tucks", () => {
    const withMuseum = foldTurn({
      character: "alchemist",
      cast: castWith("alchemist"),
      seats: SEATS3,
      board: { cities: { ann: ["museum"] }, hands: { ann: ["market", "tavern"] }, gold: { ann: 0 } },
      answer: policy(buildOrGold),
    });
    expect(
      rawGold(foldEnd(withMuseum), ANN),
      "the Museum's offer did not steal the Alchemist's spend pending: gather 2, build 1, refund 1",
    ).toBe(2);
    expect(
      museumOf(foldEnd(withMuseum), ANN)?.cards?.length ?? 0,
      "the Museum's placement offer tucked one card under the Alchemist's Museum",
    ).toBe(1);
  });

  /**
   * D9-2 teeth. ANN holds the Navigator and owns a Museum; her hand is [market,
   * tavern]. The Navigator's turn window is its gain choice (answered with gold),
   * and the turn takes no build (rules.json navigator: "You cannot build any
   * districts this turn"). The Museum's offer must still open on that turn: the
   * Navigator branch once returned early and never reached withMuseumOffer. Remove
   * the offer splice from the Navigator branch (helpers.ts resolveTurn) and no
   * `keep` window ever opens: both assertions below go RED.
   */
  test("the Navigator's turn still opens the Museum's placement offer", () => {
    const folded = foldTurn({
      character: "navigator",
      cast: castWith("navigator"),
      seats: SEATS3,
      board: { cities: { ann: ["museum"] }, hands: { ann: ["market", "tavern"] }, gold: { ann: 0 } },
      answer: policy(buildOrGold),
    });
    expect(
      foldPurposes(folded),
      "the Navigator's turn reached the Museum's placement offer (a keep window opened)",
    ).toContain("keep");
    expect(
      museumOf(foldEnd(folded), ANN)?.cards?.length ?? 0,
      "the Navigator tucked a card under its Museum",
    ).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// The two-marker dimension. Every threat row above folds a SINGLE threatened
// seat (threats: [threatened, "assassin"], and the assassin is rank 1, so it is
// never the threatened one in play), so the eleventh-pass defects in the second
// marker were unreachable here. These two rows fold BOTH markers in one round.
// ---------------------------------------------------------------------------

describe("engine coverage: the Blackmailer's two threat markers", () => {
  const EMPTY_HAND: readonly DistrictId[] = [];
  const ONE_CARD: readonly DistrictId[] = ["tavern"];
  const MUSEUM_CITY: readonly PlacedDistrict[] = [{ id: "museum", gold: 0 }];

  /** The threatened purse at the threat window: the Merchant's +1, the Architect's +0. */
  const purseOf = (character: CharacterId): number => (character === "merchant" ? 8 : 7);

  /**
   * Fold a round in which both markers are threatened, both seats refuse, and the
   * Blackmailer answers every reveal with reveal. rules.json (blackmailer): "one
   * shows the flowered lace and is the target ... revealing the flowered lace
   * takes all their gold." Exactly one marker carries the lace, so exactly one
   * seat is ever looted. The Merchant (rank 6) is called before the Architect
   * (rank 7), so naming the Merchant as the lace folds the lace resolving first
   * and naming the Architect folds the decoy first.
   */
  const foldBoth = (
    lace: CharacterId,
    decoy: CharacterId,
    reveal: "reveal" | "spare",
    entropy: string,
  ): CitadelsState => {
    const base = rawGenesis(SEATS3, castWithThreat(lace), entropy);
    let cur: CitadelsState = {
      ...base,
      phase: "turn",
      draft: null,
      claimed: [
        { seat: ANN, character: "blackmailer" },
        { seat: BOB, character: "merchant" },
        { seat: CARA, character: "architect" },
      ],
      callRank: 6,
      active: BOB,
      steps: [{ kind: "call" }, { kind: "end-round" }],
      pending: null,
      builtThisTurn: 0,
      threats: [lace, decoy],
      players: base.players.map((player) => ({
        ...player,
        gold: player.seat === ANN ? 0 : 5,
        hand: [...EMPTY_HAND],
        city: [],
      })),
    };
    const answer = (_seat: SeatId, state: CitadelsState): CitadelsAction | null => {
      const purpose = openPurpose(state);
      if (purpose === "turn") return { t: "gold" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
      if (purpose === "blackmailer-resolve") return { t: "choose", value: reveal };
      return null;
    };
    for (let i = 0; i < 40 && cur.phase !== "draft"; i += 1) cur = advance(cur, answer);
    return cur;
  };

  /**
   * D11-1 teeth, both orders. The Blackmailer places two markers and reveals both
   * refusals; the rule allows exactly one looting, of the laced marker's seat.
   * The reveal once answered "is this the lace?" with threats[0] - the first
   * threat STILL STANDING - so once the target's marker left the list the decoy
   * inherited the lace and was looted too: measured 15 gold out of ten on the
   * table. Reverting the spent-lace record (the doubled survivor written by
   * spendMarker in characters/blackmailer.ts) re-loots the decoy in the
   * lace-first order and stops the lace from looting in the decoy-first order, so
   * the assertions below go RED either way. The control isolates it: with every
   * reveal declined no gold crosses at all.
   */
  test("a revealed laced target is looted and a refused decoy never is", () => {
    const quiet = foldBoth("merchant", "architect", "spare", "coverage-two-quiet");
    expect(rawGold(quiet, BOB), "a refused, unrevealed threat costs nothing").toBe(8);
    expect(rawGold(quiet, CARA)).toBe(7);
    expect(rawGold(quiet, ANN), "no reveal, no looting").toBe(0);

    const orders: readonly (readonly [CharacterId, CharacterId])[] = [
      ["merchant", "architect"],
      ["architect", "merchant"],
    ];
    for (const [lace, decoy] of orders) {
      const loud = foldBoth(lace, decoy, "reveal", "coverage-two-" + lace);
      const laceSeat = lace === "merchant" ? BOB : CARA;
      const decoySeat = lace === "merchant" ? CARA : BOB;
      expect(
        rawGold(loud, laceSeat),
        "revealing the flowered lace took all of the laced seat's gold",
      ).toBe(0);
      expect(
        rawGold(loud, decoySeat),
        "the decoy's marker carries no lace: revealing it took nothing",
      ).toBe(purseOf(decoy));
      expect(rawGold(loud, ANN), "one lace, one looting").toBe(purseOf(lace));
    }
  });

  /**
   * D11-2 teeth. A threatened Navigator owning a Museum. The Navigator's turn
   * window is its gain choice and the Museum's once-per-turn placement is an
   * ability, so rules.json (blackmailer) "A threatened player must resolve the
   * threat before using abilities or building" puts the threat above the offer.
   * The offer was spliced at the head of the continuation the resolve step left,
   * which is exactly where the threat window sits: measured purposes ran turn,
   * keep, blackmailer-threat - the seat tucked a card before it resolved. Revert
   * the threat splice in the Navigator branch (helpers.ts resolveTurn) and the
   * keep window moves back above the threat: the ordering assertion goes RED.
   */
  test("a threatened Navigator resolves the threat before its Museum offer", () => {
    const base = rawGenesis(
      SEATS3,
      castWithThreat("navigator"),
      "coverage-navigator-museum-threat",
    );
    let cur: CitadelsState = {
      ...base,
      phase: "turn",
      draft: null,
      claimed: [
        { seat: ANN, character: "blackmailer" },
        { seat: BOB, character: "navigator" },
      ],
      callRank: specOfCharacter("navigator").rank,
      active: BOB,
      steps: [{ kind: "call" }, { kind: "end-round" }],
      pending: null,
      builtThisTurn: 0,
      threats: ["navigator", "assassin"],
      players: base.players.map((player) =>
        player.seat === BOB
          ? { ...player, gold: 0, hand: [...ONE_CARD], city: [...MUSEUM_CITY] }
          : player,
      ),
    };
    const purposes: (string | null)[] = [];
    const answer = (_seat: SeatId, state: CitadelsState): CitadelsAction | null => {
      const purpose = openPurpose(state);
      if (purpose === "turn") return { t: "gold" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    };
    for (let i = 0; i < 40 && cur.phase !== "draft"; i += 1) {
      purposes.push(openPurpose(cur));
      cur = advance(cur, answer);
    }
    const at = purposes.indexOf("blackmailer-threat");
    const keep = purposes.indexOf("keep");
    expect(at, "the threatened Navigator was called").toBeGreaterThanOrEqual(0);
    expect(
      at < keep,
      "measured order " + purposes.join(",") + ": the placement offer ran first",
    ).toBe(true);
    const museum = rawPlayer(cur, BOB).city.find((district) => district.id === "museum");
    expect(
      museum?.cards?.length ?? 0,
      "the Museum's offer still opened and tucked one card",
    ).toBe(1);
  });

  /**
   * D12-1..3 teeth, and the sweep that proves there is no fourth. The rule is
   * shape-independent: rules.json (blackmailer) "A threatened player must resolve
   * the threat before using abilities or building", over the turn model
   * (docs/design/citadels-full-game.md) "A turn: gather (2 gold, or draw 2 keep 1),
   * then optionally build one district."
   *
   * Both verification passes folded a threatened seat with an EMPTY hand, so the
   * stack shape a build-capable character leaves was never folded: a character
   * whose effect reshapes the turn stack pushed its build windows above the
   * threat window, and the seat built before its marker resolved.
   *   D12-1 the Architect's withBuildLimit hoists three turn windows above the
   *         blackmailer-threat: measured turn,turn,turn,keep,blackmailer-threat
   *         with four districts already in the city.
   *   D12-2 the Alchemist's atTop pass splices a bare RESOLVE between the turn
   *         window and the threat: measured turn,turn,keep,blackmailer-threat with
   *         the Tavern built and a card tucked under the Museum.
   *   D12-3 the Scholar's withBuildLimit hoists two turn windows above the
   *         threat: measured scholar-keep,turn,turn,turn,keep,blackmailer-threat
   *         with two districts already built.
   * resolveTurn (helpers.ts) searched the stack for the threat window instead of
   * reading rest[0], so the seat gathers, opens the threat on the post-gather
   * purse, and builds only below the resolved threat whatever the shape.
   */
  test("a threatened seat resolves its threat before it builds, on every stack shape", () => {
    const HAND: readonly DistrictId[] = ["tavern", "palace", "dragon-gate", "market"];
    const claimsByRank = (
      pairs: readonly (readonly [SeatId, CharacterId])[],
    ): readonly { readonly seat: SeatId; readonly character: CharacterId }[] =>
      [...pairs]
        .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
        .map(([seat, character]) => ({ seat, character }));

    /**
     * Fold one threatened turn: BOB holds the character, a non-empty hand, twenty
     * gold and a Museum, with the Blackmailer's marker already in threats. The
     * seat answers every window the engine opens, takes the greedy build, and
     * REFUSES the threat, so the deferred build after a refused marker is in the
     * frame the assertions read.
     */
    const threatenedTurn = (
      character: CharacterId,
      entropy: string,
      threats: readonly CharacterId[] = [character],
    ): {
      readonly purposes: readonly (string | null)[];
      readonly cityAtThreat: readonly DistrictId[];
      readonly tuckAtThreat: number;
      readonly finalCity: readonly DistrictId[];
      readonly finalGold: number;
      readonly finalHand: number;
      readonly finalTuck: number;
    } => {
      const base = rawGenesis(SEATS3, castWithThreat(character), entropy);
      const partner =
        base.cast.find((id) => specOfCharacter(id).rank > specOfCharacter(character).rank) ??
        base.cast[base.cast.length - 1] ??
        character;
      let cur: CitadelsState = {
        ...base,
        phase: "turn",
        draft: null,
        claimed: claimsByRank([[ANN, "blackmailer"], [BOB, character], [CARA, partner]]),
        callRank: specOfCharacter(character).rank,
        active: BOB,
        steps: [{ kind: "call" }, { kind: "end-round" }],
        pending: null,
        builtThisTurn: 0,
        threats: [...threats],
        players: base.players.map((player) =>
          player.seat === BOB
            ? { ...player, gold: 20, hand: [...HAND], city: [...MUSEUM_CITY] }
            : player,
        ),
      };
      const purposes: (string | null)[] = [];
      const cities: (readonly DistrictId[])[] = [];
      const tucks: number[] = [];
      for (let i = 0; i < 60 && cur.phase === "turn"; i += 1) {
        purposes.push(openPurpose(cur));
        cities.push(cityIdsOf(cur, BOB));
        tucks.push(rawPlayer(cur, BOB).city[0]?.cards?.length ?? 0);
        cur = advance(cur, (seat, state) => {
          const purpose = openPurpose(state);
          if (purpose === "turn") return buildOrGold(seat, state);
          if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
          return windowAnswer(seat, state);
        });
      }
      const at = purposes.indexOf("blackmailer-threat");
      return {
        purposes,
        cityAtThreat: at < 0 ? [] : (cities[at] ?? []),
        tuckAtThreat: at < 0 ? -1 : (tucks[at] ?? -1),
        finalCity: cityIdsOf(cur, BOB),
        finalGold: rawGold(cur, BOB),
        finalHand: rawHand(cur, BOB).length,
        finalTuck: rawPlayer(cur, BOB).city[0]?.cards?.length ?? 0,
      };
    };

    // The three stack-reshaping characters D12 folded, with the deferral's own
    // teeth: the build must land BELOW the threat, not be dropped by it.
    const reshapers: readonly (readonly [CharacterId, readonly DistrictId[]])[] = [
      ["architect", ["tavern", "market", "palace"]],
      ["alchemist", ["tavern"]],
      ["scholar", ["tavern", "market"]],
    ];
    for (const [character, built] of reshapers) {
      const r = threatenedTurn(character, "coverage-d12-" + character);
      // The Alchemist's settle step must still ride the threat: its end-of-turn
      // refund reads the gold the build spent, so a threat that strands that
      // resolve (or drops it below a second end-turn) silently costs the seat its
      // build. Fold the same turn unthreatened and demand the same purse, city and
      // hand - D12-2 measured 4 gold threatened against 5 unthreatened.
      if (character === "alchemist") {
        const plain = threatenedTurn("alchemist", "coverage-d12-alchemist-plain", []);
        expect(plain.finalCity, "the control turn builds the Tavern").toEqual(["museum", "tavern"]);
        expect(r.finalGold, "the settlement refund still lands: " + r.purposes.join(",")).toBe(
          plain.finalGold,
        );
        expect(r.finalHand, "the settlement left the hand alone").toBe(plain.finalHand);
      }
      expect(r.purposes, character + " opens its threat window").toContain("blackmailer-threat");
      expect(
        r.cityAtThreat,
        character + " gathered only before its threat resolved: " + r.purposes.join(","),
      ).toEqual(["museum"]);
      expect(
        r.tuckAtThreat,
        character + " tucked nothing under its Museum before its threat resolved: " +
          r.purposes.join(","),
      ).toBe(0);
      expect(
        r.finalCity,
        character + " still builds below the resolved threat: " + r.purposes.join(","),
      ).toEqual(["museum", ...built]);
      // The Museum's once-per-turn placement is an ability too, so it opens below
      // the resolved threat (D11-2's clause) and still tucks one card.
      expect(
        r.finalTuck,
        character + " still tucks one card below the resolved threat: " + r.purposes.join(","),
      ).toBe(1);
    }

    // The sweep: every threatenable character, each with a non-empty hand and a
    // buildable card. The Trader is held out and reported to the coordinator: its
    // trade-build windows sit above the turn window, so it builds trade districts
    // before the threat opens - the same clause, but the fix needs a shared-file
    // change outside this unit's scope (orchestrate/citadels D12-4).
    const heldOut = new Set<CharacterId>(["trader"]);
    const THREATENABLE: readonly CharacterId[] = [
      "assassin", "witch", "magistrate", "thief", "spy", "magician", "wizard", "seer",
      "king", "emperor", "patrician", "bishop", "abbot", "cardinal", "merchant", "alchemist",
      "trader", "architect", "navigator", "scholar", "warlord", "diplomat", "marshal", "artist",
      "queen", "tax-collector",
    ];
    const swept = THREATENABLE.filter((id) => !heldOut.has(id));
    expect(swept.length, "the sweep covers every threatenable character but the held-out Trader").toBe(25);
    for (const character of swept) {
      const r = threatenedTurn(character, "coverage-d12-sweep-" + character);
      const at = r.purposes.indexOf("blackmailer-threat");
      expect(at, character + " is called while its marker stands").toBeGreaterThanOrEqual(0);
      expect(
        r.cityAtThreat,
        character + " built or tucked before its threat resolved: " + r.purposes.join(","),
      ).toEqual(["museum"]);
      expect(
        r.tuckAtThreat,
        character + " tucked a card before its threat resolved: " + r.purposes.join(","),
      ).toBe(0);
      expect(
        r.purposes.slice(at + 1).includes("turn"),
        character + " keeps its build window below the resolved threat: " + r.purposes.join(","),
      ).toBe(true);
    }
  });
});


/* ---------------------------------------------------------------------------
 * D13 threat-window sweep and guards. The engine relocates a threatened seat's
 * own ability windows below the Blackmailer threat window (helpers.ts:
 * relocateEffectBelowThreat), so folding a threatened turn and DRIVING EVERY
 * window must show a pristine board at the blackmailer-threat frame. Pass 12
 * missed the Trader because its policy drove only the turn window; this sweep
 * drives every purpose a character opens.
 * ------------------------------------------------------------------------- */

const SWEEP_BASE: Record<number, CharacterId> = {
  1: "assassin", 2: "thief", 3: "magician", 4: "king", 5: "bishop", 6: "merchant",
  7: "architect", 8: "warlord",
};
const SWEEP_HAND: readonly DistrictId[] = ["tavern", "market", "trading-post", "palace"];

const sweepClaims = (
  pairs: readonly (readonly [SeatId, CharacterId])[],
): readonly { readonly seat: SeatId; readonly character: CharacterId }[] =>
  [...pairs]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

const sweepStop = (steps: readonly CitadelsState[]): boolean => {
  const last = steps[steps.length - 1] as CitadelsState;
  const purpose = openPurpose(last);
  return purpose === "blackmailer-threat" || purpose === "draft-pick" || last.phase !== "turn";
};

const sweepDrive = (_seat: SeatId, state: CitadelsState): CitadelsAction | null => {
  const purpose = openPurpose(state);
  if (purpose === "turn") {
    return rawHand(state, BOB).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
  }
  switch (purpose) {
    case "keep":
    case "scholar-keep":
    case "artist-beautify":
    case "seer-give":
    case "magician-discard":
      return { t: "keep", index: 0 };
    case "trader-build":
      return rawHand(state, BOB).length > 0 ? { t: "build", card: 0 } : null;
    case "wizard-take":
    case "diplomat-exchange":
    case "marshal-seize":
    case "warlord-destroy":
    case "emperor-crown":
    case "seer-receive":
      return state.pending !== null && state.pending.target === null
        ? { t: "target", seat: CARA }
        : { t: "keep", index: 0 };
    case "magician-swap":
      return { t: "target", seat: CARA };
    case "tax-collect":
      return { t: "gold" };
    case "choose-character":
      return { t: "name-character", character: "king" };
    case "choose-seat":
      return { t: "target", seat: CARA };
    case "choose-type":
      return { t: "name-type", type: "noble" };
    case "abbot-split":
      return state.pending?.note === "abbot-tie" ? { t: "target", seat: CARA } : { t: "choose", value: "0" };
    default:
      return null;
  }
};


interface SweepFrame {
  readonly threatIdx: number;
  readonly purposes: string;
  readonly caraCity: readonly DistrictId[];
  readonly bobCity: readonly DistrictId[];
  readonly markers: readonly number[];
  readonly caraGold: number;
  readonly caraHand: number;
}

/** Read the board at the blackmailer-threat frame (the last frame if none opened). */
const frameAt = (run: Fold, _character: CharacterId): SweepFrame => {
  const threatIdx = run.steps.findIndex((s) => openPurpose(s) === "blackmailer-threat");
  const at = threatIdx < 0 ? run.steps.length - 1 : threatIdx;
  const frame = run.steps[at] as CitadelsState;
  const cara = frame.players.find((p) => p.seat === CARA)!;
  const bob = frame.players.find((p) => p.seat === BOB)!;
  return {
    threatIdx,
    purposes: run.steps.map((s) => openPurpose(s) ?? "-").join(","),
    caraCity: cara.city.map((d) => d.id),
    bobCity: bob.city.map((d) => d.id),
    markers: bob.city.map((d) => d.gold),
    caraGold: cara.gold,
    caraHand: cara.hand.length,
  };
};

const sweepStart = (
  character: CharacterId,
  entropy: string,
  extraClaims: readonly (readonly [SeatId, CharacterId])[] = [],
): CitadelsState => {
  const rank = specOfCharacter(character).rank;
  const cast: CharacterId[] = [];
  for (let r = 1; r <= 8; r += 1) {
    cast.push(r === rank ? character : r === 2 ? "blackmailer" : (SWEEP_BASE[r] as CharacterId));
  }
  if (rank === 9) cast.push(character);
  const base = rawGenesis(SEATS3, cast, entropy);
  const partner = (SWEEP_BASE[rank === 4 ? 6 : 4] ?? "king") as CharacterId;
  const claims = sweepClaims(
    extraClaims.length > 0 ? extraClaims : [[ANN, "blackmailer"], [BOB, character], [CARA, partner]],
  );
  const start: CitadelsState = {
    ...base, phase: "turn", draft: null,
    claimed: claims,
    callRank: rank, active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [character], builtThisTurn: 0, bewitched: null,
    players: base.players.map((p) => ({
      ...p,
      gold: p.seat === BOB ? 20 : p.seat === CARA ? 6 : 4,
      hand: p.seat === BOB ? [...SWEEP_HAND]
        : p.seat === CARA ? (["market", "palace"] as DistrictId[])
        : (["tavern"] as DistrictId[]),
      city: p.seat === BOB ? [{ id: "museum" as DistrictId, gold: 0 }]
        : p.seat === CARA ? [{ id: "tavern" as DistrictId, gold: 0 }]
        : [],
    })),
  };
  return start;
};

const sweepFold = (character: CharacterId, entropy: string): SweepFrame => {
  const run = foldFrom(sweepStart(character, entropy), sweepDrive, sweepStop, 600, entropy);
  return frameAt(run, character);
};

const THREATENABLE: readonly CharacterId[] = CHARACTER_CATALOG.map((spec) => spec.id)
  .filter((id) => id !== "blackmailer");

describe("D13 guard: a threatened seat lands nothing before the threat (relocation)", () => {
  test("the threatenable set is every character but the Blackmailer (26)", () => {
    expect(THREATENABLE.length).toBe(26);
    expect(THREATENABLE).not.toContain("blackmailer");
  });

  test("every threatenable character reaches its threat window with a pristine board", () => {
    for (const character of THREATENABLE) {
      const r = sweepFold(character, "d13-sweep-" + character);
      expect(r.threatIdx, character + " reached its threat window: " + r.purposes).toBeGreaterThanOrEqual(0);
      expect(r.caraCity, character + " a rival's city changed: " + r.purposes).toEqual(["tavern"]);
      expect(r.bobCity, character + " its own city changed: " + r.purposes).toEqual(["museum"]);
      expect(r.markers, character + " a district was marked: " + r.purposes).toEqual([0]);
      expect(r.caraGold, character + " took a rival's gold: " + r.purposes).toBe(6);
      expect(r.caraHand, character + " took a rival's card: " + r.purposes).toBe(2);
    }
  });
});

describe("D13 guard: buildBlockedByThreat keys on the ACTING character", () => {
  test("a threatened two-character seat refuses on the acting character, not the first claim", () => {
    const start = sweepStart("warlord", "d13-twoclaim", [
      [ANN, SWEEP_BASE[2] as CharacterId],
      [BOB, "king"],
      [BOB, "warlord"],
      [CARA, SWEEP_BASE[6] as CharacterId],
    ]);
    const run = foldFrom(start, sweepDrive, sweepStop, 600, "d13-twoclaim-fold");
    const r = frameAt(run, "warlord");
    expect(r.threatIdx, "the threatened Warlord (acting char) reached its threat: " + r.purposes).toBeGreaterThanOrEqual(0);
    expect(r.caraCity, "the Warlord destroyed before its threat: " + r.purposes).toEqual(["tavern"]);
    expect(r.bobCity, "the seat built before its threat: " + r.purposes).toEqual(["museum"]);
    expect(r.markers, "a district was marked: " + r.purposes).toEqual([0]);
  });
});

describe("D13 guard: the Architect's build limit is the live clause (BUILD_LIMITS)", () => {
  test("buildLimit reads the live BUILD_LIMITS entry, not the withBuildLimit pre-seed mirror", () => {
    const base = rawGenesis(SEATS3, castWith("architect"), "d13-ablimit");
    const armed: CitadelsState = {
      ...base, phase: "turn", draft: null,
      claimed: [{ seat: ANN, character: "architect" }],
      callRank: specOfCharacter("architect").rank, active: ANN,
      steps: [{ kind: "call" }, { kind: "end-round" }], pending: null,
    };
    expect(buildLimit(armed, ANN)).toBe(3);
  });

  test("a threatened Architect still builds its full limit below the resolved threat", () => {
    const start = sweepStart("architect", "d13-abend");
    const run = foldFrom(start, sweepDrive, (steps) => {
      const last = steps[steps.length - 1] as CitadelsState;
      return openPurpose(last) === "draft-pick" || last.phase !== "turn";
    }, 600, "d13-abend-fold");
    const end = run.steps[run.steps.length - 1] as CitadelsState;
    expect(end.players.find((p) => p.seat === BOB)!.city.length).toBeGreaterThanOrEqual(3);
  });
});
