import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, advance, citadels, openPurpose, rawGenesis, rawGold, rawHand, cityIds,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "./driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../lockstep/games/citadels/districts.ts";
import { stateCodec } from "../../../lockstep/games/citadels/state.ts";
import { buildLimit, seatHolding } from "../../../lockstep/games/citadels/helpers.ts";

/**
 * Eighteenth pass. The D17 redesign (33b9165 + 5e86a02) moved the Witch's resume
 * identity out of the clobberable `pending` slot into an owned `state.resume`
 * field. This pass attacks what that redesign left: the resume stack is still a
 * generic [RESOLVE, arm, turn, ...] that does not match every bewitched
 * character's own turn shape, so two abilities whose first pass keys off the
 * stack around the turn window mis-run on the resume.
 *
 * rules.json (witch): "You then resume your turn as if you were playing the
 * bewitched character: you use that character's abilities and build limit, with
 * YOUR hand, YOUR gold, and YOUR city."
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

const HAND: readonly DistrictId[] = ["market","docks","harbor","palace","temple","church"];

/** ANN holds the Witch, BOB the bewitched character, CARA the king. */
const witchBoard = (name: CharacterId, seed: string, annGold = 5): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor(["witch", name]), seed);
  return {
    ...base, phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "witch"], [BOB, name], [CARA, "king"]]),
    callRank: 1, active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [], builtThisTurn: 0,
    players: base.players.map((player) => ({
      ...player,
      gold: player.seat === ANN ? annGold : player.seat === CARA ? 6 : 0,
      hand: player.seat === ANN ? [...HAND] : player.seat === CARA ? ["tavern","market","docks"] : [],
      city: player.seat === ANN ? [{ id: "tavern" as DistrictId, gold: 0 }] : [],
    })),
  };
};

type Choice = "draw" | "gold" | "build";

const policy = (bewitched: CharacterId, choice: Choice) =>
  (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn") {
      if (choice === "draw") return { t: "draw" };
      if (choice === "build") {
        const hand = rawHand(s, ANN);
        const city = cityIds(s, ANN);
        const index = hand.findIndex((id) => !city.includes(id));
        return index >= 0 ? { t: "build", card: index } : { t: "gold" };
      }
      return { t: "gold" };
    }
    if (purpose === "keep" || purpose === "scholar-keep") return { t: "keep", index: 0 };
    if (purpose === "choose-character") return { t: "name-character", character: bewitched };
    if (purpose === "witch-takeover" || purpose === "witch-resume") return { t: "pass" };
    return null;
  };

interface Fold { readonly end: CitadelsState; readonly purposes: readonly string[]; }

/** Fold the whole Witch segment (held turn + resume) to the round close, recording every window. */
const foldWhole = (name: CharacterId, choice: Choice, seed: string): Fold => {
  let s = witchBoard(name, seed);
  const purposes: string[] = [];
  for (let i = 0; i < 200; i += 1) {
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, policy(name, choice));
  }
  return { end: s, purposes };
};

/** Fold the Witch segment to the first state carrying the owned resume record. */
const resumeMid = (name: CharacterId, choice: Choice, seed: string): CitadelsState => {
  let s = witchBoard(name, seed);
  for (let i = 0; i < 200; i += 1) {
    if (s.resume != null) return s;
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advance(s, policy(name, choice));
  }
  throw new Error("the fold never reached the resume for " + name);
};

/** The windows opened strictly after the `witch-resume` window. */
const windowsAfterResume = (purposes: readonly string[]): readonly string[] => {
  const at = purposes.indexOf("witch-resume");
  return at < 0 ? [] : purposes.slice(at + 1);
};

/** The bewitched character's own plain turn from the same board (the Witch's +2 removed). */
const foldPlain = (mid: CitadelsState, name: CharacterId, choice: Choice): CitadelsState => {
  const start: CitadelsState = {
    ...mid,
    claimed: claimsOf([[ANN, name], [BOB, "witch"], [CARA, "king"]]),
    callRank: (specOfCharacter(name).rank - 1) as Rank,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [], builtThisTurn: 0, resume: null, bewitched: null,
    players: mid.players.map((player) =>
      player.seat === ANN ? { ...player, gold: rawGold(mid, ANN) - 2 } : player),
  };
  let s = advance(start, policy(name, choice));
  for (let i = 0; i < 200; i += 1) {
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advance(s, policy(name, choice));
    if (s.active !== ANN) break;
  }
  return s;
};

/** The state at the resume turn window for a character that opens one. */
const resumeWindow = (name: CharacterId): CitadelsState => {
  let s = witchBoard(name, "v18p-" + name);
  for (let i = 0; i < 200; i += 1) {
    const top = s.steps[0];
    if (s.resume != null && top !== undefined && top.kind === "window" && top.window.purpose === "turn") return s;
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advance(s, policy(name, "gold"));
  }
  throw new Error("no resume window for " + name);
};

const gold = (s: CitadelsState, seat: SeatId) => rawGold(s, seat);
const handSize = (s: CitadelsState, seat: SeatId) => rawHand(s, seat).length;

// ---------------------------------------------------------------------------
// D18-1: the Alchemist's Witch resume loses its end-of-turn build refund
//
// rules.json (alchemist): "At the end of your turn, take back the gold you paid
// to build districts this turn." rules.json (witch): the resume "uses that
// character's abilities ... with YOUR gold". The Alchemist's effect runs twice:
// a turn-open pass (detected by `atTurnTop`, which reads `ctx.rest[0]`) that arms
// the settle step below the turn window, and an end pass that refunds. The
// resume stack is [RESOLVE, arm, turn, ...]: the `arm` step fix16 planted
// directly above the resume turn window (kept by the D17 redesign) sits at
// `rest[0]`, so `atTurnTop` is false and the effect takes the END pass
// immediately: it refunds 0 and clears the pending, and the build then lands
// with no settle step below it. Measured: the resume ends on 5 gold where the
// plain turn ends on 7. Present at 73a5258 (fix16); clean at 536f78d.
// ---------------------------------------------------------------------------

test("D18-1 the Alchemist's Witch resume loses its end-of-turn build refund", () => {
  const whole = foldWhole("alchemist", "build", "v18-alchemist");
  const plain = foldPlain(resumeMid("alchemist", "build", "v18-alchemist"), "alchemist", "build");
  expect(cityIds(whole.end, ANN), "the resume built the same district the plain turn built")
    .toEqual(cityIds(plain, ANN));
  expect(
    gold(whole.end, ANN),
    "the resume runs the Alchemist's ability with the Witch's gold, so the gold she paid to " +
      "build must return. resume windows after `witch-resume`: " +
      windowsAfterResume(whole.purposes).join(",") +
      "; resume purse " + gold(whole.end, ANN) + " vs plain purse " + gold(plain, ANN),
  ).toBe(gold(plain, ANN));
});

// ---------------------------------------------------------------------------
// D18-2: the Navigator's Witch resume never offers the gain choice
//
// rules.json (navigator): "Gain either four gold or four cards." rules.json
// (witch): the resume "uses that character's abilities". The Navigator's turn
// window IS its gain choice, so an ordinary Navigator turn arms
// [turn(choice), RESOLVE, ...] and resolveTurn writes the chosen branch onto
// pending.note for the effect below it to read. The resume stack is the generic
// [RESOLVE, arm, turn, ...], so the Navigator effect runs BEFORE the turn window,
// reads the resume tag as its note (not the cards marker), takes the four-gold
// branch, and strips the turn window it never reached. The Witch can never take
// four cards on the resume: measured, no window opens after `witch-resume` and
// her hand does not grow.
// ---------------------------------------------------------------------------

test("D18-2 the Navigator's Witch resume never offers the four-cards choice", () => {
  const whole = foldWhole("navigator", "draw", "v18-navigator");
  const after = windowsAfterResume(whole.purposes);
  expect(
    after,
    "the Navigator's gain choice is its turn window; the resume must open one so the Witch " +
      "may take four cards. resume windows after `witch-resume`: " + after.join(","),
  ).toContain("turn");
  expect(
    handSize(whole.end, ANN),
    "a four-card resume draws four cards; the Witch's hand started at " + HAND.length + ". " +
      "resume windows after `witch-resume`: " + after.join(","),
  ).toBe(HAND.length + 4);
});

// ---------------------------------------------------------------------------
// Positive probes: the D17 redesign's clauses this pass did not break
// ---------------------------------------------------------------------------

/**
 * P1 - the redesign's owned resume record: set on the resume turn window, cleared
 * when the resumed turn ends. A record that leaked would make the Witch play the
 * bewitched character on every later turn.
 */
test("P1 the owned resume record opens and clears with the resumed turn", () => {
  const mid = resumeWindow("scholar");
  expect(mid.resume, "the resume turn window carries the owned identity").toEqual({
    seat: ANN,
    character: "scholar",
  });
  let s = mid;
  let cleared = false;
  for (let i = 0; i < 200; i += 1) {
    s = advance(s, policy("scholar", "gold"));
    if (s.resume == null) {
      cleared = true;
      break;
    }
    if (s.phase !== "turn") break;
  }
  expect(cleared, "the resume record cleared once the resumed turn ended").toBe(true);
  expect(s.resume, "no resume record leaks past the resumed turn").toBeFalsy();
});

/**
 * P2 - the owned resume record survives the codec, so a mid-resume snapshot
 * restored on a peer keeps the resume identity. The Scholar re-seats turn
 * windows and the Spy writes pending.note; both must round-trip.
 */
test("P2 the resume identity survives a mid-resume codec round-trip", () => {
  for (const name of ["scholar", "spy"] as CharacterId[]) {
    const mid = resumeWindow(name);
    const round = stateCodec.decode(stateCodec.encode(mid));
    expect(round.resume, "the resume identity survives encode/decode; " + name).toEqual(mid.resume);
  }
});

/**
 * P3 - a mid-resume snapshot does not leak the Witch's hidden information: the
 * resume record names the seat and character (both public), and `project` never
 * carries the record, the pending action, or any hand but the viewer's own.
 */
test("P3 a mid-resume snapshot leaks no hidden information through project", () => {
  const mid = resumeWindow("spy");
  const view = citadels.project(mid, CARA);
  expect(Object.keys(view), "the view carries no field for the resume record").not.toContain("resume");
  expect(view.myHand, "CARA sees only her own hand").toEqual(rawHand(mid, CARA));
  expect(handSize(mid, ANN), "the Witch holds cards the view must not show CARA").toBeGreaterThan(0);
  const serialized = JSON.stringify(view);
  for (const card of rawHand(mid, ANN)) {
    if (!rawHand(mid, CARA).includes(card)) {
      expect(serialized, "the Witch's hand card " + card + " crosses project to CARA")
        .not.toContain(card);
    }
  }
  expect(view.pending?.character, "the open pending action stays redacted to counts").not.toBe("witch");
});

/**
 * P4 - the fix17 rename removed the old `WITCH_RESUME_NOTE` plumbing: helpers.ts
 * no longer exports it. The tag the resume arm step carries is a locator only -
 * `seatHolding` and `buildLimit` key on the owned `resume` record, so a state with
 * the tag in `pending` but no owned record must not report the Witch as holder.
 */
test("P4 the old WITCH_RESUME_NOTE export is gone and the tag is inert", () => {
  const mid = resumeWindow("scholar");
  const tagless: CitadelsState = { ...mid, resume: null, pending: null };
  expect(
    seatHolding(tagless, "scholar"),
    "the tag alone (no owned record) must not name the Witch as the Scholar's holder",
  ).toBe(BOB);
  expect(
    buildLimit(tagless, ANN),
    "with no owned record the Witch builds at her own limit (1)",
  ).toBe(1);
  // The rank cursor happens to name the Scholar on a real resume, so move it: the
  // owned record alone must give the Witch the bewitched Scholar's limit.
  expect(
    buildLimit({ ...mid, callRank: 1 }, ANN),
    "the owned record gives the Witch the bewitched Scholar's limit (2)",
  ).toBe(2);
});

/**
 * P5 - the D13/D14/D15 ordering still holds: a refused threatened Scholar draws
 * before it builds and reaches the plain end state.
 */
test("P5 the refused threatened Scholar still reaches the plain end state", () => {
  const base = rawGenesis(SEATS3, castFor(["scholar"]), "v18-p5");
  const arm = (threats: readonly CharacterId[]): CitadelsState => ({
    ...base, phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "blackmailer"], [BOB, "scholar"], [CARA, "warlord"]]),
    callRank: specOfCharacter("scholar").rank, active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats, builtThisTurn: 0,
    players: base.players.map((player) => ({
      ...player,
      gold: player.seat === BOB ? 12 : 0,
      hand: [],
      city: player.seat === BOB ? [{ id: "museum" as DistrictId, gold: 0 }] : [],
    })),
  });
  const fold = (threats: readonly CharacterId[]) => {
    let s = arm(threats);
    for (let i = 0; i < 200; i += 1) {
      if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
      s = advance(s, (_seat, st) => {
        const purpose = openPurpose(st);
        if (purpose === "turn") return rawHand(st, BOB).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
        if (purpose === "keep" || purpose === "scholar-keep") return { t: "keep", index: 0 };
        if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
        if (purpose === "blackmailer-resolve") return { t: "choose", value: "no" };
        return null;
      });
    }
    return s;
  };
  const plain = fold([]);
  const refused = fold(["scholar"]);
  expect(cityIds(refused, BOB), "the refused Scholar built what the plain turn built")
    .toEqual(cityIds(plain, BOB));
  expect(gold(refused, BOB), "the refused Scholar reaches the plain purse").toBe(gold(plain, BOB));
});
