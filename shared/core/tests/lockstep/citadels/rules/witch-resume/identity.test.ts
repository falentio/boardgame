import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, advance, cityIds, dealFor, openPurpose, rawGenesis, rawGold, rawHand,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "../../driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";
import { stateCodec } from "../../../../../lockstep/games/citadels/state.ts";
import { buildLimit } from "../../../../../lockstep/games/citadels/helpers.ts";

/**
 * Seventeenth pass. fix16 (73a5258) made the Witch's resume stack carry the
 * resume marker on an arm step above the resume turn window, so the D15
 * relocation's first-pass guard skips it and resolveTurn still recognizes the
 * resume. This pass attacked what the fix left behind: the resume marker still
 * rode the single pending slot, and the bewitched character's own effect wrote
 * that same slot. The D17 redesign moved the marker into the owned `state.resume`
 * field, and D17-1 to D17-5 pin the fixed resume.
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

interface ResumeOpts {
  readonly annGold?: number;
  readonly annHand?: readonly DistrictId[];
  readonly annCity?: readonly DistrictId[];
  readonly bobCity?: readonly DistrictId[];
  readonly caraGold?: number;
  readonly caraHand?: readonly DistrictId[];
  readonly caraCity?: readonly DistrictId[];
}

/** ANN holds the Witch, BOB the bewitched character, over a hand-built board. */
const resumeBoard = (bewitched: CharacterId, o: ResumeOpts = {}, seed = "v17-" + bewitched): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor(["witch", bewitched]), seed);
  return {
    ...base, phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "witch"], [BOB, bewitched], [CARA, "king"]]),
    callRank: 1, active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [], builtThisTurn: 0,
    players: base.players.map((p) => ({
      ...p,
      gold: p.seat === ANN ? (o.annGold ?? 0) : p.seat === CARA ? (o.caraGold ?? 0) : 0,
      hand: p.seat === ANN ? [...(o.annHand ?? [])] : p.seat === CARA ? [...(o.caraHand ?? [])] : [],
      city: p.seat === ANN ? (o.annCity ?? []).map((id) => ({ id, gold: 0 }))
        : p.seat === BOB ? (o.bobCity ?? []).map((id) => ({ id, gold: 0 }))
        : (o.caraCity ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

/**
 * Fold the Witch's segment: her held turn, then the resume. Stops at the first
 * turn window that is not ANN's, so the other seats' turns do not confound it.
 */
const foldResume = (
  state: CitadelsState,
  bewitched: CharacterId,
  policy: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
): { readonly end: CitadelsState; readonly purposes: readonly string[]; readonly annGold: readonly number[] } => {
  let s = state;
  const purposes: string[] = [];
  const annGold: number[] = [];
  let resumeDone = false;
  for (let i = 0; i < 400; i += 1) {
    const top = s.steps[0];
    const annTurn =
      top !== undefined && top.kind === "window" && top.window.purpose === "turn" && top.window.seats[0] === ANN;
    if (resumeDone && top !== undefined && top.kind === "window" && top.window.purpose === "turn" && !annTurn) break;
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    purposes.push(openPurpose(s) ?? "-");
    annGold.push(rawGold(s, ANN));
    if (openPurpose(s) === "witch-resume") resumeDone = true;
    s = advance(s, (seat, st) => {
      const p = openPurpose(st);
      if (p === "choose-character") return { t: "name-character", character: bewitched };
      if (p === "witch-takeover" || p === "witch-resume") return { t: "pass" };
      return policy(seat, st);
    });
  }
  return { end: s, purposes, annGold };
};

/** The bewitched character's own plain turn on the same board, ANN claiming it. */
const plainBoard = (character: CharacterId, o: ResumeOpts = {}, seed = "v17p-" + character): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor([character]), seed);
  return {
    ...base, phase: "turn", draft: null,
    claimed: claimsOf([[ANN, character], [BOB, "king"], [CARA, "warlord"]]),
    callRank: specOfCharacter(character).rank, active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [], builtThisTurn: 0,
    players: base.players.map((p) => ({
      ...p,
      gold: p.seat === ANN ? (o.annGold ?? 0) : p.seat === CARA ? (o.caraGold ?? 0) : 0,
      hand: p.seat === ANN ? [...(o.annHand ?? [])] : p.seat === CARA ? [...(o.caraHand ?? [])] : [],
      city: p.seat === ANN ? (o.annCity ?? []).map((id) => ({ id, gold: 0 }))
        : p.seat === BOB ? (o.bobCity ?? []).map((id) => ({ id, gold: 0 }))
        : (o.caraCity ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

const foldPlain = (
  state: CitadelsState,
  policy: (seat: SeatId, state: CitadelsState) => CitadelsAction | null,
): { readonly end: CitadelsState; readonly purposes: readonly string[] } => {
  let s = state;
  const purposes: string[] = [];
  for (let i = 0; i < 300; i += 1) {
    const top = s.steps[0];
    if (top !== undefined && top.kind === "window" && top.window.purpose === "turn" && top.window.seats[0] !== ANN) break;
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    purposes.push(openPurpose(s) ?? "-");
    s = advance(s, (seat, st) => policy(seat, st));
  }
  return { end: s, purposes };
};

const gold = (s: CitadelsState, seat: SeatId) => rawGold(s, seat);

/** Pass every character-owned window; take the gather as gold. */
const idleTurn = (seat: SeatId, s: CitadelsState): CitadelsAction | null => {
  const p = openPurpose(s);
  if (p === "turn") return { t: "gold" };
  if (p === "keep" || p === "scholar-keep") return { t: "keep", index: 0 };
  if (p === "blackmailer-threat") return null;
  if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
  if (p === "trader-build") return null;
  if (p === "cardinal-gold") return null;
  return null;
};

// ---------------------------------------------------------------------------
// D17-1: the Scholar's resume gathered a second time
// ---------------------------------------------------------------------------

/**
 * rules.json (scholar): "Draw seven cards from the deck and choose one to add to
 * your hand; shuffle the other six back into the deck. Your building limit this
 * turn is two." rules.json (witch): the resume runs the bewitched ability with
 * the Witch's hand, gold, and city and gathers NOTHING (her +2 was the held
 * turn). fix16 kept the resume turn window from gathering for the Warlord, whose
 * effect opens its window above the resume turn window. The Scholar's effect
 * instead calls withBuildLimit, which re-seats its two turn windows ABOVE the
 * fix16 arm step, and it wrote its own pending record (note null) at the
 * resolve step. The resume turn window therefore read a null note and took the
 * GATHER branch: the Witch's gold reached 4 on an empty board where the rule
 * caps it at 2.
 */
test("D17-1 the Scholar's Witch resume gathered a second time", () => {
  const r = foldResume(resumeBoard("scholar"), "scholar", idleTurn);
  expect(
    Math.max(...r.annGold),
    "the Witch gathers once (+2 on her held turn); the Scholar resume adds nothing. " +
      "gold trail " + r.annGold.join(",") + "; windows " + r.purposes.join(","),
  ).toBe(2);
});

/**
 * The same defect through a REAL deal: a 3-player game where ANN drafts the Witch
 * and BOB the Scholar. ANN's only gold is her held-turn gather, so her purse must
 * never exceed 2.
 */
test("D17-1b the Scholar resume double-gather reproduced through a real deal", () => {
  const dealt = dealFor(castFor(["witch", "scholar"]), SEATS3, { ann: "witch", bob: "scholar" }, undefined, "v17-scholar-deal");
  let s: CitadelsState = { ...dealt, players: dealt.players.map((p) => ({ ...p, gold: 0, hand: [], city: [] })) };
  const golds: number[] = [gold(s, ANN)];
  let resumeDone = false;
  for (let i = 0; i < 400; i += 1) {
    const top = s.steps[0];
    const annTurn =
      top !== undefined && top.kind === "window" && top.window.purpose === "turn" && top.window.seats[0] === ANN;
    if (resumeDone && top !== undefined && top.kind === "window" && top.window.purpose === "turn" && !annTurn) break;
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    if (openPurpose(s) === "witch-resume") resumeDone = true;
    s = advance(s, (seat, st) => {
      const p = openPurpose(st);
      if (p === "choose-character") return { t: "name-character", character: "scholar" };
      if (p === "witch-takeover" || p === "witch-resume") return { t: "pass" };
      return idleTurn(seat, st);
    });
    golds.push(gold(s, ANN));
  }
  expect(
    Math.max(...golds),
    "the Witch purse across held turn and resume; gold trail " + golds.join(","),
  ).toBe(2);
});

// ---------------------------------------------------------------------------
// D17-2: the Abbot's resume computed its income on the holder's city
// ---------------------------------------------------------------------------

/**
 * rules.json (abbot): "Gain either 1 gold or 1 card per religious district in
 * your city". On the resume the acting player is the Witch, so the count is HER
 * city's religious districts. The Abbot's split window wrote
 * pending.note = "abbot-split", which clobbered the resume marker; seatHolding
 * (helpers.ts) keyed the Witch lookup off pending.note === WITCH_RESUME_NOTE, so
 * it fell back to the real Abbot holder and paid the income to that seat, counted
 * on that seat's city. Board: the Witch's city is empty, the Abbot holder's city
 * holds two religious districts. The holder must end on its takeover gather alone
 * (2 gold); it ended on 4.
 */
test("D17-2 the Abbot's resume paid income to the bewitched holder, not the Witch", () => {
  const policy = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "abbot-split") return { t: "choose", value: "0" };
    return idleTurn(_seat, s);
  };
  const r = foldResume(resumeBoard("abbot", { annGold: 0, annCity: [], bobCity: ["temple", "church"] }), "abbot", policy);
  expect(
    gold(r.end, BOB),
    "the Abbot holder's purse: only its takeover gather (2). The resume's abbot income " +
      "counted the holder's city and paid the holder. windows " + r.purposes.join(","),
  ).toBe(2);
});

// ---------------------------------------------------------------------------
// D17-3: the Spy's resume never ran the Spy's ability
// ---------------------------------------------------------------------------

/**
 * rules.json (spy): "Choose another player and name a district type, then look at
 * that player's hand: for each card of the named type, take 1 gold from the player
 * and gain 1 card from the deck." The Spy's effect dispatches on pending.note
 * (null -> seat, spy-seat -> type, spy-type -> peek, spy-peek -> apply). The resume
 * armed pending.character = "spy" with note "witch-resume", which the effect
 * mistook for its own in-flight state: it fell through to the apply branch with
 * no target and ran nothing. The Witch's resume must offer the Spy's naming
 * windows and loot the target. Board: CARA holds two trade cards and 4 gold; the
 * resume must take 2 gold from CARA and draw 2 cards to the Witch.
 */
test("D17-3 the Spy's resume ran no naming or loot", () => {
  const policy = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "choose-seat") return { t: "target", seat: CARA };
    if (p === "choose-type") return { t: "name-type", type: "trade" };
    return idleTurn(_seat, s);
  };
  const r = foldResume(resumeBoard("spy", { caraGold: 4, caraHand: ["tavern", "market"] }), "spy", policy);
  expect(r.purposes, "the Spy's naming windows open on the resume; " + r.purposes.join(",")).toContain("choose-seat");
  expect(gold(r.end, CARA), "the resume loots CARA's gold per matching trade card").toBe(2);
  expect(gold(r.end, ANN), "the loot lands on the Witch").toBe(4);
});

// ---------------------------------------------------------------------------
// D17-4: the Blackmailer's resume never assigned its threats
// ---------------------------------------------------------------------------

/**
 * rules.json (blackmailer): "Assign two threat markers facedown to two different
 * characters". The Blackmailer's effect dispatches on pending.note (null ->
 * arm threat-1, threat-1 -> arm threat-2, threat-2 -> commit). The resume armed
 * pending.character = "blackmailer" with note "witch-resume", so the effect
 * mistook it for its own in-flight state and committed an empty namedCharacter,
 * assigning no threats. The Witch's resume must record two threats.
 */
test("D17-4 the Blackmailer's resume assigned no threat markers", () => {
  const policy = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "blackmailer-resolve") return { t: "name-character", character: "king" };
    return idleTurn(_seat, s);
  };
  const r = foldResume(resumeBoard("blackmailer"), "blackmailer", policy);
  expect(
    (r.end.threats ?? []).length,
    "the Blackmailer's resume must assign its markers; threats " + JSON.stringify(r.end.threats) +
      "; windows " + r.purposes.join(","),
  ).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// D17-5: the Emperor's resume paid the crown reward to the wrong seat
// ---------------------------------------------------------------------------

/**
 * rules.json (emperor): "You must take the crown from its holder and give it to a
 * different player, not yourself, then take either 1 gold or 1 random card from
 * that player's stash or hand." On the resume the acting player is the Witch, so
 * the crown must leave her and the reward must come to her. The Emperor's window
 * wrote pending.note = "emperor-target", clobbering the resume marker, so
 * seatHolding reported the real Emperor holder and the reward landed on that seat.
 * Board: the Witch has 0 gold and the recipient has 3; the reward must raise the
 * Witch, not the holder.
 */
test("D17-5 the Emperor's resume paid the crown reward to the bewitched holder", () => {
  const policy = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "emperor-crown") {
      return s.pending?.note === "emperor-reward" ? { t: "gold" } : { t: "target", seat: CARA };
    }
    return idleTurn(_seat, s);
  };
  const r = foldResume(resumeBoard("emperor", { annGold: 0, caraGold: 3 }), "emperor", policy);
  expect(
    gold(r.end, BOB),
    "the Emperor holder's purse: its takeover gather (2) and nothing more. The resume's " +
      "crown window clobbered the resume marker, so seatHolding reported the holder and the " +
      "reward landed on it. windows " + r.purposes.join(","),
  ).toBe(2);
});

// ---------------------------------------------------------------------------
// Positive probes: the clauses this pass did not break
// ---------------------------------------------------------------------------

/**
 * P1 - fix16 holds for the Warlord: its resume gathers nothing. The Warlord's
 * effect opens its window above the resume turn window, so the fix16 arm step sits
 * above the turn window and the relocation skips the pass. Neuter the fix16 arm
 * step and this reddens (D16-1).
 */
test("P1 the Warlord's resume gathers nothing (fix16 holds)", () => {
  const policy = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "warlord-destroy") return s.pending?.note === "warlord-destroy" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    return idleTurn(_seat, s);
  };
  const r = foldResume(resumeBoard("warlord"), "warlord", policy);
  expect(Math.max(...r.annGold), "the Warlord resume adds no gather; windows " + r.purposes.join(",")).toBe(2);
});

/**
 * P2 - the plain turn order still holds: gather -> abilities -> build. The
 * Scholar's plain turn opens its keep window AFTER the gather turn window and
 * before the build. Revert the D15 plain relocation and this reddens.
 */
test("P2 the plain turn still gathers before its ability", () => {
  const r = foldPlain(plainBoard("scholar"), idleTurn);
  const gatherAt = r.purposes.indexOf("turn");
  const keepAt = r.purposes.indexOf("scholar-keep");
  expect(gatherAt, "the plain gather turn window opened; " + r.purposes.join(",")).toBeGreaterThanOrEqual(0);
  expect(keepAt, "the Scholar's keep window opened; " + r.purposes.join(",")).toBeGreaterThan(gatherAt);
});

/**
 * P3 - the multi-pass first-pass guard still holds: the Spy's plain turn gathers
 * exactly once across its four passes. Neuter the guard
 * (hasArmAbove || !hasWindowAbove) and this reddens.
 */
test("P3 the Spy's plain turn gathers exactly once across its four passes", () => {
  const r = foldPlain(plainBoard("spy"), idleTurn);
  expect(
    gold(r.end, ANN),
    "the Spy's turn shows one gather (2 gold); windows " + r.purposes.join(","),
  ).toBe(2);
});

/**
 * P4 - the D14-1 contract still holds: a refused threatened Scholar draws before
 * it builds and reaches the plain end state. Restore the pre-D14 splice and this
 * reddens.
 */
test("P4 a refused threatened Scholar reaches the plain end state", () => {
  const arm = (threats: readonly CharacterId[]): CitadelsState => {
    const base = rawGenesis(SEATS3, castFor(["scholar"]), "v17-p4");
    return {
      ...base, phase: "turn", draft: null,
      claimed: claimsOf([[ANN, "blackmailer"], [BOB, "scholar"], [CARA, "warlord"]]),
      callRank: specOfCharacter("scholar").rank, active: BOB,
      steps: [{ kind: "call" }, { kind: "end-round" }],
      pending: null, threats, builtThisTurn: 0,
      players: base.players.map((p) => ({
        ...p,
        gold: p.seat === BOB ? 12 : 0,
        hand: [],
        city: p.seat === BOB ? [{ id: "museum" as DistrictId, gold: 0 }] : [],
      })),
    };
  };
  const fold = (threats: readonly CharacterId[]) => {
    let s = arm(threats);
    for (let i = 0; i < 200; i += 1) {
      if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
      s = advance(s, (_seat, st) => {
        const p = openPurpose(st);
        if (p === "turn") return rawHand(st, BOB).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
        if (p === "keep" || p === "scholar-keep") return { t: "keep", index: 0 };
        if (p === "blackmailer-threat") return { t: "choose", value: "refuse" };
        if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
        return null;
      });
    }
    return s;
  };
  const plain = fold([]);
  const refused = fold(["scholar"]);
  expect(cityIds(refused, BOB), "the refused Scholar built what the plain turn built").toEqual(cityIds(plain, BOB));
  expect(gold(refused, BOB), "the refused Scholar reaches the plain purse").toBe(gold(plain, BOB));
});

// ---------------------------------------------------------------------------
// P5 - the redesign owns the resume identity in a dedicated state field
// ---------------------------------------------------------------------------

/** Fold the Witch's held turn and resume, stopping AT the resume turn window. */
const resumeWindowState = (bewitched: CharacterId): CitadelsState => {
  let s = resumeBoard(bewitched);
  for (let i = 0; i < 200; i += 1) {
    const top = s.steps[0];
    if (
      top !== undefined && top.kind === "window" && top.window.purpose === "turn" &&
      s.resume !== null && s.resume !== undefined
    ) {
      return s;
    }
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advance(s, (seat, st) => {
      const p = openPurpose(st);
      if (p === "choose-character") return { t: "name-character", character: bewitched };
      if (p === "witch-takeover" || p === "witch-resume") return { t: "pass" };
      return idleTurn(seat, st);
    });
  }
  throw new Error("the fold never reached the resume turn window");
};

/**
 * The resume identity is owned state (CitadelsState.resume), not the shared
 * pending slot a bewitched effect overwrites. The engine encodes and decodes the
 * state between frames, so a mid-resume snapshot must restore the identity or the
 * resumed turn would lose it across a frame boundary. The Scholar re-seats turn
 * windows and the Spy writes pending.note; both must round-trip.
 */
test("P5 the resume identity survives a mid-resume codec round-trip", () => {
  for (const bewitched of ["scholar", "spy"] as CharacterId[]) {
    const mid = resumeWindowState(bewitched);
    expect(mid.resume, "the resume opened with an owned identity; " + bewitched).toEqual({
      seat: ANN,
      character: bewitched,
    });
    const round = stateCodec.decode(stateCodec.encode(mid));
    expect(
      round.resume,
      "the resume identity survives encode/decode; " + bewitched,
    ).toEqual(mid.resume);
  }
});

/**
 * The resume record is turn-local: it must be cleared when the resumed turn
 * ends, or the Witch's seat would keep playing the bewitched character on every
 * later turn. Fold the resume past its own turn window and assert the record is
 * gone. Neuter the end-of-turn clear and this reddens.
 */
test("P6 the resume record clears when the resumed turn ends", () => {
  let s = resumeBoard("scholar");
  let sawResume = false;
  let sawClear = false;
  for (let i = 0; i < 300; i += 1) {
    const hasResume = s.resume !== null && s.resume !== undefined;
    if (hasResume) sawResume = true;
    // The resume record is turn-local: it opens on the resume turn window and
    // clears as that window's turn closes. A state past the resume whose record
    // is gone is the clear; a state past the resume that still carries it is the
    // leak this guards.
    if (sawResume && !hasResume) {
      sawClear = true;
      break;
    }
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advance(s, (seat, st) => {
      const p = openPurpose(st);
      if (p === "choose-character") return { t: "name-character", character: "scholar" };
      if (p === "witch-takeover" || p === "witch-resume") return { t: "pass" };
      return idleTurn(seat, st);
    });
  }
  expect(sawResume, "the fold reached the resume").toBe(true);
  expect(sawClear, "the resume record cleared once the resumed turn ended").toBe(true);
  expect(s.resume, "no resume record leaks past the resumed turn").toBeFalsy();
});

/**
 * The resume identity is read from the owned field, not inferred from the rank
 * cursor. The cursor happens to coincide with the bewitched rank on a real
 * resume, so a direct read pins the owned record as the source: with the record
 * set and the cursor pointed elsewhere, buildLimit must still report the
 * bewitched character's limit (the rule: the resume uses the bewitched
 * character's build limit). Neuter the buildLimit resume branch and this
 * reddens.
 */
test("P7 buildLimit reads the resume character from the owned field", () => {
  const mid = resumeWindowState("scholar");
  const cursorMoved = { ...mid, callRank: 1 };
  expect(
    buildLimit(cursorMoved, ANN),
    "the resume's build limit is the bewitched Scholar's (2), not the Witch's (1)",
  ).toBe(2);
});
