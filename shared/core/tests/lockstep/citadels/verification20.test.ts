import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, advance, openPurpose, rawGenesis, rawGold, rawHand, cityIds,
  type CitadelsAction, type CitadelsState,
} from "./driver.ts";
import type { SeatId } from "../../../lockstep/index.ts";
import {
  charactersOfRank, specOfCharacter, type CharacterId, type Rank,
} from "../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../lockstep/games/citadels/districts.ts";
import {
  END_TURN, relocateEffectBelowThreat, winStep,
} from "../../../lockstep/games/citadels/helpers.ts";
import { stateCodec } from "../../../lockstep/games/citadels/state.ts";
import type { Pending, Step } from "../../../lockstep/games/citadels/state.ts";

/**
 * Twentieth pass. The D19 fix (8c62749) makes `relocateEffectBelowThreat` skip on a
 * resume (`windows.ts` passes `state.resume != null`), so a resumed turn keeps its
 * ability windows ABOVE the resume turn window (which resolves as the build): the turn
 * reads abilities -> build, the plain order with no gather (standing order 13).
 *
 * This pass re-confirms that fix (P1, P4) and attacks the resume end to end. It finds
 * D20-1: the Cardinal's Witch resume cannot use its shortfall clause, because
 * `resolveTurn`'s shortfall branch carries a `!resumedWitch` guard that suppresses it on
 * the resume. rules.json (witch): the resume "use[s] that character's abilities and build
 * limit, with YOUR hand, YOUR gold, and YOUR city." rules.json (cardinal): "When you build
 * a district and lack the gold, you may take the shortfall from one player."
 */

// A legal cast holding the Witch at rank 1 and `target` at its own rank.
const castWithWitch = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1 as Rank; rank <= 8; rank = (rank + 1) as Rank) {
    const at = charactersOfRank(rank);
    cast.push(at.includes(target) ? target : (at[0] as CharacterId));
  }
  if (specOfCharacter(target).rank === 9) cast.push(target);
  cast[0] = "witch";
  return cast;
};

const claimsOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

const CHEAP: readonly DistrictId[] = [
  "tavern", "temple", "watchtower", "manor", "market", "church", "docks", "prison", "barracks",
];
const HAND: readonly DistrictId[] = ["market", "docks", "harbor", "palace", "temple", "church"];

/** One board for both folds: the deck, hands, cities, and golds are the caller's. */
const board = (
  cast: readonly CharacterId[],
  seed: string,
  golds: Readonly<Record<string, number>>,
  hands: Readonly<Record<string, readonly DistrictId[]>>,
  cities: Readonly<Record<string, readonly DistrictId[]>> = {},
): CitadelsState => {
  const base = rawGenesis(SEATS3, cast, seed);
  return {
    ...base,
    phase: "turn",
    draft: null,
    callRank: 1,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    threats: [],
    builtThisTurn: 0,
    deck: [...CHEAP, ...base.deck],
    players: base.players.map((player) => ({
      ...player,
      gold: golds[player.seat] ?? 0,
      hand: hands[player.seat] ?? [],
      city: (cities[player.seat] ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

/** Build the first buildable card at every build window; pass every other window. */
const buildPolicy = (name: CharacterId) =>
  (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn" || purpose === "trader-build") {
      const hand = rawHand(s, ANN);
      const city = cityIds(s, ANN);
      const index = hand.findIndex((id) => !city.includes(id));
      return index >= 0 ? { t: "build", card: index } : { t: "gold" };
    }
    if (purpose === "keep" || purpose === "scholar-keep") return { t: "keep", index: 0 };
    if (purpose === "choose-character") return { t: "name-character", character: name };
    if (purpose === "witch-takeover" || purpose === "witch-resume") return { t: "pass" };
    if (purpose === "cardinal-gold") return { t: "target", seat: CARA };
    return { t: "pass" } as CitadelsAction;
  };

/** True once ANN's turn is over: the open window names live seats that exclude ANN. */
const annTurnDone = (s: CitadelsState): boolean => {
  if (s.phase !== "turn") return true;
  const top = s.steps[0];
  if (top === undefined || top.kind !== "window") return false;
  if (top.window.purpose === "draft-pick") return true;
  const seats = top.window.seats;
  return seats.length > 0 && !seats.includes(ANN);
};

interface Fold {
  readonly end: CitadelsState;
  readonly purposes: readonly string[];
}

const fold = (state: CitadelsState, name: CharacterId): Fold => {
  let s = state;
  const purposes: string[] = [];
  for (let i = 0; i < 400 && !annTurnDone(s); i += 1) {
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, buildPolicy(name));
  }
  return { end: s, purposes };
};

/** The Witch segment: ANN holds the Witch, BOB the bewitched character. */
const foldResume = (opts: {
  readonly name: CharacterId;
  readonly seed: string;
  readonly golds: Readonly<Record<string, number>>;
  readonly hands: Readonly<Record<string, readonly DistrictId[]>>;
  readonly cities?: Readonly<Record<string, readonly DistrictId[]>>;
}): Fold =>
  fold(
    {
      ...board(castWithWitch(opts.name), opts.seed, opts.golds, opts.hands, opts.cities),
      claimed: claimsOf([[ANN, "witch"], [BOB, opts.name]]),
    },
    opts.name,
  );

/** The bewitched character's own plain turn on the same board, ANN claiming it. */
const foldPlain = (opts: {
  readonly name: CharacterId;
  readonly seed: string;
  readonly golds: Readonly<Record<string, number>>;
  readonly hands: Readonly<Record<string, readonly DistrictId[]>>;
  readonly cities?: Readonly<Record<string, readonly DistrictId[]>>;
}): Fold =>
  fold(
    {
      ...board(castWithWitch(opts.name), opts.seed, opts.golds, opts.hands, opts.cities),
      claimed: claimsOf([[ANN, opts.name]]),
      callRank: specOfCharacter(opts.name).rank,
      active: ANN,
      resume: null,
      bewitched: null,
    },
    opts.name,
  );

const city = (s: CitadelsState) => cityIds(s, ANN);
const gold = (s: CitadelsState) => rawGold(s, ANN);
const handSize = (s: CitadelsState) => rawHand(s, ANN).length;
const afterResume = (f: Fold): readonly string[] => {
  const at = f.purposes.indexOf("witch-resume");
  return at < 0 ? [] : f.purposes.slice(at + 1);
};

// ---------------------------------------------------------------------------
// D20-1: the Cardinal's Witch resume cannot use its shortfall clause.
//
// rules.json (witch): the resume "use[s] that character's abilities and build limit,
// with YOUR hand, YOUR gold, and YOUR city." rules.json (cardinal): "When you build a
// district and lack the gold, you may take the shortfall from one player, giving that
// player one card from your hand per gold taken." The plain Cardinal turn offers the
// shortfall (cardinal-gold) and retries the build; the resume never opens that offer, so
// a build the Cardinal could not afford is silently dropped and the resume diverges from
// the plain turn. Mechanism: resolveTurn's shortfall branch carries a `!resumedWitch`
// guard (helpers.ts:891), so `applyBuild` skips the offer whenever state.resume is set.
// ---------------------------------------------------------------------------

test("D20-1 the Cardinal's Witch resume cannot use its shortfall clause", () => {
  // ANN (the Witch) enters the resume on 4 gold (2 + her held +2) with a Palace (cost 5)
  // in hand; CARA holds the gold to cover the 1-gold shortfall.
  const opts = {
    name: "cardinal" as CharacterId,
    seed: "v20-cardinal",
    golds: { [ANN]: 2, [CARA]: 5, [BOB]: 0 } as Readonly<Record<string, number>>,
    hands: { [ANN]: ["palace"] as readonly DistrictId[], [CARA]: [] as readonly DistrictId[] },
  };
  const whole = foldResume(opts);
  const plain = foldPlain(opts);
  expect(whole.purposes, "the resume opened").toContain("witch-resume");
  expect(
    city(plain.end),
    "sanity: the plain Cardinal turn covers the shortfall and builds the Palace",
  ).toEqual(["palace"]);
  expect(
    city(whole.end),
    "the resume runs the Cardinal's abilities, so its shortfall clause must cover the " +
      "build it cannot afford. resume built=[" + city(whole.end).join(",") + "] gold=" +
      gold(whole.end) + " caraGold=" + rawGold(whole.end, CARA) + " windows after witch-resume=" +
      afterResume(whole).join(",") + "; plain built=[" + city(plain.end).join(",") + "] gold=" +
      gold(plain.end) + " caraGold=" + rawGold(plain.end, CARA) + " order=" + plain.purposes.join(","),
  ).toEqual(city(plain.end));
});

test("D20-1b the Cardinal resume diverges from the plain turn across seeds and hands", () => {
  const cases: readonly (readonly [string, Readonly<Record<string, number>>, readonly DistrictId[]])[] = [
    ["a", { [ANN]: 2, [CARA]: 5, [BOB]: 0 }, ["palace"]],
    ["b", { [ANN]: 1, [CARA]: 6, [BOB]: 0 }, ["palace"]],
    ["c", { [ANN]: 3, [CARA]: 4, [BOB]: 0 }, ["palace"]],
    ["d", { [ANN]: 0, [CARA]: 9, [BOB]: 0 }, ["palace"]],
  ];
  const bad: string[] = [];
  for (const [tag, golds, hand] of cases) {
    const opts = {
      name: "cardinal" as CharacterId,
      seed: "v20-cardinal-" + tag,
      golds,
      hands: { [ANN]: hand, [CARA]: [] as readonly DistrictId[] },
    };
    const whole = foldResume(opts);
    const plain = foldPlain(opts);
    if (city(whole.end).join("|") !== city(plain.end).join("|") || handSize(whole.end) !== handSize(plain.end)) {
      bad.push(
        tag + ": resume built=[" + city(whole.end).join(",") + "] hand=" + handSize(whole.end) +
          " vs plain built=[" + city(plain.end).join(",") + "] hand=" + handSize(plain.end),
      );
    }
  }
  expect(bad, "resumes that diverge from the plain turn: " + bad.join(" | ")).toEqual([]);
});

// ---------------------------------------------------------------------------
// P1: the D19 fix holds - no window-opening resume leads with its build window.
//
// Standing order 13: the plain turn order is gather -> abilities -> build. The resume
// has no gather, so it must be abilities -> build. Every window-opening character's
// resume must open its ability window before any build turn window.
// ---------------------------------------------------------------------------

test("P1 no window-opening resume leads with its build window (the D19 fix)", () => {
  const cases: readonly (readonly [CharacterId, string, readonly DistrictId[]])[] = [
    ["thief", "choose-character", []],
    ["spy", "choose-seat", []],
    ["blackmailer", "blackmailer-resolve", []],
    ["magician", "magician-swap", []],
    ["wizard", "wizard-take", []],
    ["seer", "seer-receive", []],
    ["emperor", "emperor-crown", []],
    ["abbot", "abbot-split", []],
    ["cardinal", "cardinal-gold", []],
    ["trader", "trader-build", []],
    ["scholar", "scholar-keep", []],
    ["warlord", "warlord-destroy", []],
    ["diplomat", "diplomat-exchange", []],
    ["marshal", "marshal-seize", []],
    ["artist", "artist-beautify", ["tavern"]],
    ["tax-collector", "tax-collect", []],
  ];
  const leading: string[] = [];
  for (const [name, ability, citySeed] of cases) {
    const whole = foldResume({
      name,
      seed: "v20-p1-" + name,
      golds: { [ANN]: 10, [BOB]: 0, [CARA]: 0 },
      hands: { [ANN]: [...HAND], [BOB]: ["temple"], [CARA]: ["church"] },
      cities: citySeed.length === 0 ? {} : { [ANN]: citySeed },
    });
    const after = afterResume(whole);
    const firstTurn = after.indexOf("turn");
    const at = after.indexOf(ability);
    if (firstTurn >= 0 && at >= 0 && firstTurn < at) {
      leading.push(name + " after=" + after.join(","));
    }
    // The ability must actually have opened (a non-vacuous check).
    if (at < 0) leading.push(name + " ability window " + ability + " never opened: " + after.join(","));
  }
  expect(leading, "these resumes open a build window before the ability window: " + leading.join(" | ")).toEqual([]);
});

// ---------------------------------------------------------------------------
// P2: the resume reaches the plain turn's end state for window-opening and
// income-only characters (the D18/D19 fixes hold), and the Alchemist still refunds.
// ---------------------------------------------------------------------------

test("P2 the resume reaches the plain turn's end state for its ability and limit", () => {
  const bad: string[] = [];
  for (const name of ["magician", "scholar", "architect", "trader", "seer"] as CharacterId[]) {
    const opts = {
      name,
      seed: "v20-p2-" + name,
      golds: { [ANN]: 10, [BOB]: 0, [CARA]: 0 } as Readonly<Record<string, number>>,
      hands: { [ANN]: [...HAND] as readonly DistrictId[] },
    };
    const whole = foldResume(opts);
    const plain = foldPlain(opts);
    if (city(whole.end).join("|") !== city(plain.end).join("|") || handSize(whole.end) !== handSize(plain.end) || gold(whole.end) !== gold(plain.end)) {
      bad.push(
        name + ": resume built=[" + city(whole.end).join(",") + "] hand=" + handSize(whole.end) +
          " gold=" + gold(whole.end) + " vs plain built=[" + city(plain.end).join(",") +
          "] hand=" + handSize(plain.end) + " gold=" + gold(plain.end),
      );
    }
  }
  expect(bad, "resumes that diverge from the plain turn: " + bad.join(" | ")).toEqual([]);
});

test("P2b the Alchemist's resume still refunds its build spend (D18-1 holds)", () => {
  const whole = foldResume({
    name: "alchemist",
    seed: "v20-p2b",
    golds: { [ANN]: 10, [BOB]: 0, [CARA]: 0 },
    hands: { [ANN]: [...HAND] },
  });
  const after = afterResume(whole);
  expect(city(whole.end).length, "the resume built a district").toBeGreaterThan(0);
  expect(
    gold(whole.end),
    "the resume runs the Alchemist's refund: 12 (10 + held +2) entered, one build paid, refunded. windows after witch-resume=" + after.join(","),
  ).toBe(12);
});

// ---------------------------------------------------------------------------
// P3: the resume identity round-trips the codec and clears at the resume end.
// ---------------------------------------------------------------------------

test("P3 the resume record round-trips the codec and clears at the resume end", () => {
  let mid: CitadelsState | null = null;
  let s: CitadelsState = {
    ...board(
      castWithWitch("scholar"),
      "v20-p3",
      { [ANN]: 10, [BOB]: 0, [CARA]: 0 },
      { [ANN]: [...HAND] },
    ),
    claimed: claimsOf([[ANN, "witch"], [BOB, "scholar"]]),
  };
  for (let i = 0; i < 400 && !annTurnDone(s); i += 1) {
    if (s.resume != null) { mid = s; break; }
    s = advance(s, buildPolicy("scholar"));
  }
  expect(mid, "the fold reached the resume").not.toBeNull();
  const snapshot = mid as CitadelsState;
  const round = stateCodec.decode(stateCodec.encode(snapshot));
  expect(round.resume, "the resume identity survives a codec round-trip").toEqual(snapshot.resume);
  const whole = foldResume({
    name: "scholar",
    seed: "v20-p3",
    golds: { [ANN]: 10, [BOB]: 0, [CARA]: 0 },
    hands: { [ANN]: [...HAND] },
  });
  expect(whole.end.resume, "no resume record leaks past the resumed turn").toBeFalsy();
});

// ---------------------------------------------------------------------------
// P4: the D19 fix's structural claim - relocateEffectBelowThreat is a no-op on a
// resume and still relocates on a plain turn (so the D15 plain order is preserved).
// ---------------------------------------------------------------------------

test("P4 relocateEffectBelowThreat skips a resume and still relocates a plain turn", () => {
  const ability: Step = winStep("warlord-destroy", [ANN]);
  const turn: Step = winStep("turn", [ANN]);
  const pending: Pending = {
    actor: ANN,
    character: "warlord",
    target: null,
    namedCharacter: null,
    namedType: null,
    cards: [],
    gold: 0,
    amount: 0,
    note: null,
  };
  // The effect pushed its ability window above the gather turn window.
  const steps: readonly Step[] = [ability, turn, END_TURN, { kind: "end-round" }];
  expect(
    relocateEffectBelowThreat(steps, pending, ANN, "warlord", true),
    "a resumed turn keeps its ability window above the resume turn window (no relocation)",
  ).toEqual(steps);
  const relocated = relocateEffectBelowThreat(steps, pending, ANN, "warlord", false);
  expect(
    relocated[0],
    "a plain turn relocates the ability below the gather turn window (gather -> abilities -> build)",
  ).toEqual(turn);
  expect(
    relocated.findIndex((step) => step.kind === "window" && step.window.purpose === "warlord-destroy"),
    "the ability window now drains after the turn window",
  ).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// P5: the resume runs with the Witch's seat even when the seat holds two
// characters (2-3 player games), and the plain-turn order is preserved.
// ---------------------------------------------------------------------------

test("P5 the resume runs the bewitched character's income on the Witch's purse", () => {
  // ANN is the Witch, BOB the Merchant; on the resume ANN plays the Merchant's turn
  // with HER city (empty trade), so she gains the Merchant's +1 on top of her held +2
  // and pays for the market build: 10 + 2 + 1 - 2 = 11.
  const whole = foldResume({
    name: "merchant",
    seed: "v20-p5",
    golds: { [ANN]: 10, [BOB]: 0, [CARA]: 0 },
    hands: { [ANN]: ["market"] },
  });
  expect(afterResume(whole), "the resume opened").not.toEqual([]);
  expect(
    gold(whole.end),
    "the resume runs the Merchant's income on the Witch's purse: 10 + 2 held + 1 merchant - 2 build",
  ).toBe(11);
});

test("P5b a two-character seat resumes as the bewitched character with the Witch's seat", () => {
  // ANN holds BOTH the Witch (rank 1) and the Merchant (rank 6), so the bewitched
  // Merchant is owned by ANN. rules.json (witch): "When the bewitched character is
  // called, its owner gathers resources" (the takeover gather lands on ANN) "You then
  // resume your turn as if you were playing the bewitched character" (the resume runs
  // the Merchant's income on ANN's purse and builds). So ANN gathers the held +2, the
  // takeover +2, and the Merchant's +1, then pays for the market build: 10 + 2 + 2 + 1 - 2 = 13.
  let s: CitadelsState = {
    ...board(
      castWithWitch("merchant"),
      "v20-p5b",
      { [ANN]: 10, [BOB]: 0, [CARA]: 0 },
      { [ANN]: ["market"] },
    ),
    claimed: claimsOf([[ANN, "witch"], [ANN, "merchant"], [BOB, "assassin"]]),
  };
  const purposes: string[] = [];
  for (let i = 0; i < 400 && !annTurnDone(s); i += 1) {
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, buildPolicy("merchant"));
  }
  expect(purposes, "the resume opened").toContain("witch-resume");
  expect(
    gold(s),
    "the seat gathers for the held Witch turn and the bewitched takeover, then runs the Merchant's income and builds",
  ).toBe(13);
  expect(city(s), "the resume built on the Witch's seat").toEqual(["market"]);
});
