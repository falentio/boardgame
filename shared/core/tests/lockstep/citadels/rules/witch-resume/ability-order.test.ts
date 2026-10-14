import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, advance, openPurpose, rawGenesis, rawGold, rawHand, cityIds,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "../../driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";
import { armCharacterTurn, RESOLVE, END_TURN, winStep } from "../../../../../lockstep/games/citadels/helpers.ts";
import { stateCodec } from "../../../../../lockstep/games/citadels/state.ts";
import type { Step } from "../../../../../lockstep/games/citadels/state.ts";

/**
 * Nineteenth pass. The D18 fix (29d31dd + 511a50a) extracted `applyCall`'s turn-shape
 * arming into `armCharacterTurn` and made the Witch's resume call the SAME helper, so a
 * resumed turn is the bewitched character's own armed turn. That closed D18-1 (the
 * Alchemist's lost refund) and D18-2 (the Navigator's missing choice).
 *
 * This pass attacks what the shared shape leaves open for every OTHER window-opening
 * character. `armCharacterTurn` produces the plain gather-turn shape `[RESOLVE, turn,
 * END_TURN]`, which `relocateEffectBelowThreat` then reorders into `[turn, arm,
 * ...abilityWindows, END_TURN]`. But `resolveTurn` visits that leading turn window with
 * `resumedWitch` true, so it takes the `alreadyGathered` (BUILD) branch: the resume's
 * build window lands ABOVE the bewitched ability window, the reverse of the plain turn's
 * gather -> abilities -> build (standing order 13). When the Witch does not build at that
 * leading window the turn closes and the post-ability build window is dropped, so a
 * Scholar cannot build the card it just kept.
 *
 * rules.json (witch): the resume "use[s] that character's abilities and build limit,
 * with YOUR hand, YOUR gold, and YOUR city."
 */

const DEFAULTS: readonly CharacterId[] = ["assassin","thief","magician","king","bishop","merchant","architect","warlord"];
const castFor = (targets: readonly CharacterId[]): readonly CharacterId[] => {
  const cast = DEFAULTS.map((fallback, i) => {
    const rank = (i + 1) as Rank;
    return targets.find((t) => specOfCharacter(t).rank === rank) ?? fallback;
  });
  const nine = targets.find((t) => specOfCharacter(t).rank === 9);
  return nine === undefined ? cast : [...cast, nine];
};
const claimsOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs].sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

// Nine cheap DISTINCT districts at the deck top, so a card the Scholar keeps is buildable.
const CHEAP: readonly DistrictId[] = ["tavern","temple","watchtower","manor","market","church","docks","prison","barracks"];
const HAND: readonly DistrictId[] = ["market","docks","harbor","palace","temple","church"];

// One board for both folds: identical deck, hands, gold, and cities, so a divergence is
// the turn shape, not the deal. ANN starts on `annGold`; the held turn adds the Witch's
// fixed +2 and the plain turn its own gather +2, so both folds enter the ability on the
// same purse (annGold + 2).
const board = (name: CharacterId, seed: string, annHand: readonly DistrictId[], annGold: number, annCity: readonly DistrictId[] = []): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor(["witch", name]), seed);
  return {
    ...base, phase: "turn", draft: null,
    callRank: 1, active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [], builtThisTurn: 0,
    deck: [...CHEAP, ...base.deck],
    players: base.players.map((player) => ({
      ...player, gold: player.seat === ANN ? annGold : 0,
      hand: player.seat === ANN ? [...annHand] : [],
      city: player.seat === ANN ? annCity.map((id) => ({ id, gold: 0 })) : [],
    })),
  };
};

type Choice = "build" | "draw";
// Build the first buildable card whenever a build window opens; draw at a turn window
// only when the fold asks for the Navigator's card branch; answer every other window.
const policy = (name: CharacterId, choice: Choice) =>
  (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn" || purpose === "trader-build") {
      if (choice === "draw") return { t: "draw" };
      const hand = rawHand(s, ANN); const city = cityIds(s, ANN);
      const index = hand.findIndex((id) => !city.includes(id));
      return index >= 0 ? { t: "build", card: index } : { t: "gold" };
    }
    if (purpose === "keep" || purpose === "scholar-keep") return { t: "keep", index: 0 };
    if (purpose === "choose-character") return { t: "name-character", character: name };
    if (purpose === "witch-takeover" || purpose === "witch-resume") return { t: "pass" };
    if (purpose === "seer-receive" || purpose === "seer-give") return { t: "keep", index: 0 };
    if (purpose === "choose-seat") return { t: "target", seat: CARA };
    if (purpose === "choose-type") return { t: "name-type", type: "trade" };
    return { t: "pass" } as CitadelsAction;
  };

const openSeats = (s: CitadelsState): readonly SeatId[] => {
  const top = s.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.seats : [];
};

interface Fold { readonly end: CitadelsState; readonly purposes: readonly string[]; }

/** The Witch segment: ANN holds the Witch, BOB the bewitched character. */
const foldResume = (name: CharacterId, seed: string, annHand: readonly DistrictId[], choice: Choice, annGold = 10, annCity: readonly DistrictId[] = []): Fold => {
  let s: CitadelsState = { ...board(name, seed, annHand, annGold, annCity), claimed: claimsOf([[ANN, "witch"], [BOB, name]]) };
  const purposes: string[] = [];
  for (let i = 0; i < 300; i += 1) {
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, policy(name, choice));
  }
  return { end: s, purposes };
};

/**
 * The bewitched character's own plain turn on the same board, ANN claiming it. The fold
 * stops as soon as the open window no longer names ANN, so no other seat's turn confounds
 * the comparison.
 */
const foldPlain = (name: CharacterId, seed: string, annHand: readonly DistrictId[], choice: Choice, annGold = 10, annCity: readonly DistrictId[] = []): Fold => {
  let s: CitadelsState = {
    ...board(name, seed, annHand, annGold, annCity),
    claimed: claimsOf([[ANN, name]]),
    callRank: specOfCharacter(name).rank, active: ANN, resume: null, bewitched: null,
  };
  const purposes: string[] = [];
  for (let i = 0; i < 300; i += 1) {
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    if (s.steps[0]?.kind === "window" && !openSeats(s).includes(ANN)) break;
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, policy(name, choice));
  }
  return { end: s, purposes };
};

/** The state at the first resume window for a character. */
const resumeMid = (name: CharacterId, seed: string): CitadelsState => {
  let s: CitadelsState = { ...board(name, seed, [], 10), claimed: claimsOf([[ANN, "witch"], [BOB, name]]) };
  for (let i = 0; i < 300; i += 1) {
    if (s.resume != null) return s;
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advance(s, policy(name, "build"));
  }
  throw new Error("the fold never reached the resume for " + name);
};

const gold = (s: CitadelsState, seat: SeatId) => rawGold(s, seat);
const handSize = (s: CitadelsState, seat: SeatId) => rawHand(s, seat).length;
const city = (s: CitadelsState, seat: SeatId) => cityIds(s, seat);
const afterResume = (fold: Fold) => fold.purposes.slice(fold.purposes.indexOf("witch-resume") + 1);

// ---------------------------------------------------------------------------
// D19-1: the Scholar's Witch resume cannot build the card it kept.
//
// rules.json (witch): the resume "use[s] that character's abilities and build
// limit, with YOUR hand, YOUR gold, and YOUR city". rules.json (scholar): "Draw
// seven cards ... choose one to add to your hand ... Your building limit this turn
// is two." The plain turn is gather -> keep -> build, so the kept card is
// buildable. On the resume the turn window is the build window and the keep window
// sits BELOW it; closing the turn after the keep drops the post-ability build
// window, so the kept card can never be built and the resume does not reach the
// plain turn's end state. Measured: resume builds 0 and keeps 1; the plain turn
// builds the kept card.
// ---------------------------------------------------------------------------

test("D19-1 the Scholar's Witch resume cannot build the card it kept", () => {
  const seed = "v19-scholar";
  const whole = foldResume("scholar", seed, [], "build");
  const plain = foldPlain("scholar", seed, [], "build");
  expect(
    city(whole.end, ANN).length,
    "the resume runs the Scholar's ability and build limit, so it must build the card it kept. " +
      "resume city=[" + city(whole.end, ANN).join(",") + "] hand=" + handSize(whole.end, ANN) +
      " gold=" + gold(whole.end, ANN) + " windows after witch-resume=" + afterResume(whole).join(",") +
      "; plain city=[" + city(plain.end, ANN).join(",") + "] hand=" + handSize(plain.end, ANN) +
      " gold=" + gold(plain.end, ANN) + " order=" + plain.purposes.join(","),
  ).toBe(city(plain.end, ANN).length);
});

test("D19-1b the Scholar resume diverges from the plain turn across seeds", () => {
  // The rule is that the resume reaches the plain turn's end state; this asserts
  // the rule (not the defect's literal counts) over several deals.
  const bad: string[] = [];
  for (let i = 0; i < 6; i += 1) {
    const seed = "v19-scholar-" + i;
    const whole = foldResume("scholar", seed, [], "build");
    const plain = foldPlain("scholar", seed, [], "build");
    const rc = city(whole.end, ANN).length, pc = city(plain.end, ANN).length;
    const rh = handSize(whole.end, ANN), ph = handSize(plain.end, ANN);
    if (rc !== pc || rh !== ph) {
      bad.push(seed + ": resume builds " + rc + " keeps " + rh + ", plain builds " + pc + " keeps " + ph);
    }
  }
  expect(bad, "resumes that diverge from the plain turn: " + bad.join(" | ")).toEqual([]);
});

// ---------------------------------------------------------------------------
// D19-2: the resume's build window leads the bewitched ability window.
//
// Standing order 13: the plain turn order is gather -> abilities -> build. The
// resume has no gather, so it must be abilities -> build. The engine instead opens
// the resume turn window as the build window and drains the bewitched ability's
// windows BELOW it, so the build precedes the ability - the reverse of the plain
// turn. Measured for the Magician: the resume opens turn, magician-swap; the plain
// turn opens turn(gather), magician-swap, then a turn(build) window.
// ---------------------------------------------------------------------------

test("D19-2 the resume builds before the bewitched ability, not after", () => {
  const seed = "v19-magician";
  const whole = foldResume("magician", seed, ["tavern","temple"], "build");
  const after = afterResume(whole);
  const firstTurn = after.indexOf("turn");
  const ability = after.indexOf("magician-swap");
  const plain = foldPlain("magician", seed, ["tavern","temple"], "build");
  const plainAbility = plain.purposes.indexOf("magician-swap");
  const plainBuildAfterAbility = plain.purposes.findIndex((p, i) => i > plainAbility && p === "turn");
  expect(
    firstTurn >= 0 && ability >= 0 && firstTurn < ability,
    "the resume's build window leads the ability window (build before ability). " +
      "resume windows after witch-resume=" + after.join(","),
  ).toBe(false);
  expect(
    plainBuildAfterAbility > plainAbility,
    "the plain turn's build window follows its ability window. plain order=" + plain.purposes.join(","),
  ).toBe(true);
});

test("D19-2b no window-opening resume leads with its build window", () => {
  // For each character whose ability opens a window, the resume must NOT open the
  // build turn window before the ability window: the plain turn is gather ->
  // abilities -> build, so the resume (no gather) must be abilities -> build.
  const cases: readonly (readonly [CharacterId, string])[] = [
    ["magician","magician-swap"],
    ["wizard","wizard-take"],
    ["spy","choose-seat"],
    ["thief","choose-character"],
    ["blackmailer","blackmailer-resolve"],
    ["emperor","emperor-crown"],
    ["abbot","abbot-split"],
    ["cardinal","cardinal-gold"],
    ["tax-collector","tax-collect"],
    ["warlord","warlord-destroy"],
    ["marshal","marshal-seize"],
    ["diplomat","diplomat-exchange"],
    ["artist","artist-beautify"],
  ];
  const leading: string[] = [];
  for (const [name, ability] of cases) {
    // The Artist needs a district in the city to beautify, so seed one for it.
    const whole = foldResume(name, "v19-ord-" + name, ["tavern","temple"], "build", 10, name === "artist" ? ["tavern"] : []);
    const after = afterResume(whole);
    const firstTurn = after.indexOf("turn");
    const at = after.indexOf(ability);
    // A resume that leads with its build window puts a build turn before the ability.
    if (firstTurn >= 0 && at >= 0 && firstTurn < at) {
      leading.push(name + " after=" + after.join(","));
    }
  }
  expect(
    leading,
    "these resumes open their build turn window before the ability window: " + leading.join(" | "),
  ).toEqual([]);
});

// ---------------------------------------------------------------------------
// Positive probes: the clauses this pass did not break.
// ---------------------------------------------------------------------------

/** P1 - D18-1 stays closed: the Alchemist's resume refunds the gold it spent building. */
test("P1 the Alchemist's Witch resume still refunds its build spend", () => {
  const whole = foldResume("alchemist", "v19-p1", [...HAND], "build");
  const after = afterResume(whole);
  expect(city(whole.end, ANN).length, "the resume built a district").toBeGreaterThan(0);
  // The Witch enters the resume on 12 (10 + her held +2), builds one district, and the
  // Alchemist's end pass returns its gold.
  expect(
    gold(whole.end, ANN),
    "the resume runs the Alchemist's refund. windows after witch-resume=" + after.join(","),
  ).toBe(12);
});

/** P2 - D18-2 stays closed: the Navigator's resume offers the four-card choice. */
test("P2 the Navigator's Witch resume still offers the four-card gain", () => {
  const whole = foldResume("navigator", "v19-p2", [...HAND], "draw");
  const after = afterResume(whole);
  expect(after, "the Navigator's choice window opens on the resume. after=" + after.join(",")).toContain("turn");
  expect(handSize(whole.end, ANN), "a four-card resume draws four").toBe(10);
});

/**
 * P3 - the D17 identity holds: the resume record opens on the resume turn, survives the
 * codec (a mid-resume snapshot must round-trip on a peer), and clears at the resume's end.
 */
test("P3 the resume record round-trips the codec and clears at the resume end", () => {
  const whole = foldResume("scholar", "v19-p3", [], "build");
  expect(whole.purposes, "the resume window opened").toContain("witch-resume");
  expect(whole.end.resume, "no resume record leaks past the resumed turn").toBeFalsy();
  const mid = resumeMid("scholar", "v19-p3");
  const round = stateCodec.decode(stateCodec.encode(mid));
  expect(round.resume, "the resume identity survives a codec round-trip").toEqual(mid.resume);
});

// ---------------------------------------------------------------------------
// P4: the D18 fix's structural claim - applyCall and the resume arm the SAME turn
// shape through one helper, so a future character's shape cannot diverge. This pins
// the helper both callers use: the Navigator's turn window (its gain choice) opens
// ABOVE the resolve that reads the choice; every other character's resolve opens
// above the gather turn window.
// ---------------------------------------------------------------------------

test("P4 applyCall and the resume share one arming helper with the per-character shape", () => {
  const rest: readonly Step[] = [{ kind: "end-round" }];
  expect(
    armCharacterTurn("navigator", ANN, rest),
    "the Navigator's turn window is its choice and must precede its resolve",
  ).toEqual([winStep("turn", [ANN]), RESOLVE, END_TURN, ...rest]);
  expect(
    armCharacterTurn("scholar", ANN, rest),
    "every other character resolves its ability above the gather turn window",
  ).toEqual([RESOLVE, winStep("turn", [ANN]), END_TURN, ...rest]);
  // A null character (the takeover/resume edge) takes the non-Navigator shape.
  expect(armCharacterTurn(null, ANN, rest)).toEqual([RESOLVE, winStep("turn", [ANN]), END_TURN, ...rest]);
});
