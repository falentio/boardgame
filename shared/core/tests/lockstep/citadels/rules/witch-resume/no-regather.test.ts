import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, advance, cityIds, dealFor, foldFrom, openPurpose, rawGenesis, rawGold, rawHand,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "../../driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";

/**
 * Sixteenth pass. Passes 1-15 swept the Blackmailer threat seam and the turn
 * ORDER; fix15 (3a3c85d) relocated an ability window below the gather on the
 * plain turn (guard: skip a pass with an arm step above the turn window), so the
 * plain turn reads gather -> abilities -> build and refused == plain.
 *
 * This pass attacks what that relocation did to the Witch's resume. Her resume
 * turn is the bewitched character's turn played with the Witch's hand, gold, and
 * city: it uses the character's abilities and build limit, but gathers NOTHING
 * (her fixed +2 was the gather on her held turn). fix15's relocation moves the
 * bewitched ability's window BELOW the resume turn window, so the ability's own
 * pending now survives to that window; resolveTurn keys its "resume" marker off
 * the pending, so it no longer recognizes the resumed turn and gathers again.
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

interface Board {
  readonly gold?: Readonly<Record<string, number>>;
  readonly hands?: Readonly<Record<string, readonly DistrictId[]>>;
  readonly cities?: Readonly<Record<string, readonly DistrictId[]>>;
}
interface ArmOpts extends Board {
  readonly character: CharacterId;
  readonly threats: readonly CharacterId[];
  readonly entropy: string;
}
const arm = (o: ArmOpts): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor([o.character]), o.entropy);
  const partner = DEFAULTS.find((c) => specOfCharacter(c).rank > specOfCharacter(o.character).rank) ?? "warlord";
  return {
    ...base, phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "blackmailer"], [BOB, o.character], [CARA, partner]]),
    callRank: specOfCharacter(o.character).rank, active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: o.threats, builtThisTurn: 0,
    players: base.players.map((p) => ({
      ...p,
      gold: o.gold?.[p.seat] ?? p.gold,
      hand: [...(o.hands?.[p.seat] ?? [])],
      city: (o.cities?.[p.seat] ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

const stop = (steps: readonly CitadelsState[]): boolean => {
  const s = steps[steps.length - 1] as CitadelsState;
  return openPurpose(s) === "draft-pick" || s.phase !== "turn";
};
const seat = (s: CitadelsState, id: SeatId) => s.players.find((p) => p.seat === id)!;
/** The refused end state must equal the plain one: purse, hand, both cities, deck. */
const endKey = (s: CitadelsState): string =>
  seat(s, BOB).gold + "|" + [...rawHand(s, BOB)].sort().join(",") + "|" +
  seat(s, BOB).city.map((d) => d.id + ":" + d.gold).join(",") + "|" +
  seat(s, CARA).city.map((d) => d.id).join(",") + "|" + seat(s, CARA).gold + "|" + s.deck.length;

const fold = (o: ArmOpts, threat: "none" | "refuse") => {
  const policy = (seatId: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "turn") { const h = rawHand(s, seatId); return h.length > 0 ? { t: "build", card: 0 } : { t: "gold" }; }
    if (p === "trader-build") { const h = rawHand(s, seatId); return h.length > 0 ? { t: "build", card: 0 } : null; }
    if (p === "keep" || p === "scholar-keep") return { t: "keep", index: 0 };
    if (p === "blackmailer-threat") return threat === "none" ? null : { t: "choose", value: "refuse" };
    if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
    if (p === "warlord-destroy") return s.pending?.note === "warlord-destroy" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (p === "marshal-seize") return s.pending?.note === "marshal-seize" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (p === "diplomat-exchange") { const n = s.pending?.note; if (n === "diplomat-target") return { t: "target", seat: CARA }; return { t: "keep", index: 0 }; }
    if (p === "abbot-split") return { t: "choose", value: "0" };
    if (p === "magician-swap") return { t: "target", seat: CARA };
    if (p === "magician-discard") return { t: "keep", index: 0 };
    if (p === "wizard-take") return s.pending?.target === null ? { t: "target", seat: CARA } : { t: "keep", index: 0 };
    if (p === "seer-receive") return null;
    if (p === "seer-give") return { t: "keep", index: 0 };
    if (p === "artist-beautify") return { t: "keep", index: 0 };
    if (p === "choose-character") return { t: "name-character", character: "warlord" };
    if (p === "choose-seat") return { t: "target", seat: CARA };
    if (p === "choose-type") return { t: "name-type", type: "trade" };
    if (p === "tax-collect") return { t: "gold" };
    if (p === "cardinal-gold") return null;
    if (p === "emperor-crown") return null;
    return null;
  };
  const run = foldFrom(arm(o), policy, stop, 400, o.entropy);
  const end = run.steps[run.steps.length - 1] as CitadelsState;
  return { end, purposes: run.steps.map((s) => openPurpose(s) ?? "-") };
};

/** Answer the Witch's naming and drive a turn whose bewitched character is `bewitched`. */
const advanceTurn = (state: CitadelsState, bewitched: CharacterId): CitadelsState =>
  advance(state, (_seat, st) => {
    const p = openPurpose(st);
    if (p === "choose-character") return { t: "name-character", character: bewitched };
    if (p === "turn") return rawHand(st, ANN).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
    if (p === "keep" || p === "scholar-keep") return { t: "keep", index: 0 };
    if (p === "witch-takeover" || p === "witch-resume") return { t: "pass" };
    if (p === "warlord-destroy") return st.pending?.note === "warlord-destroy" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (p === "blackmailer-threat") return null;
    if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
    return null;
  });

// ---------------------------------------------------------------------------
// D16: the D15 relocation makes the Witch's resume turn gather a second time
// ---------------------------------------------------------------------------

/**
 * The rule (rules.json witch): "Gather resources, then call the name of another
 * character to bewitch; your turn is put on hold and you cannot build. ... You
 * then resume your turn as if you were playing the bewitched character: you use
 * that character's abilities and build limit, with YOUR hand, YOUR gold, and YOUR
 * city." The Witch's +2 is the gather of her held turn; the resume turn is the
 * bewitched character's turn with NO gather of its own (threat-and-gather.test.ts D4-1b pins
 * this for an income-only character).
 *
 * fix15's plain-turn relocation moves the bewitched ability's window below the
 * resume turn window, so the ability's own pending (here the Warlord's
 * warlord-pick) survives to that window. resolveTurn reads the resume marker off
 * the pending, so it no longer recognizes the resumed turn: neither the
 * WITCH_RESUME_NOTE branch nor the held-turn branch fires and it takes the GATHER
 * path. Measured on an empty-city board: the Witch's held turn gathers +2 and her
 * resume gathers a second +2, so her gold reaches 4 where the rule caps it at 2.
 * Before fix15 the same board ended at 2.
 */
test("D16-1 the Witch resume turn must not gather a second time", () => {
  const base = rawGenesis(SEATS3, castFor(["witch", "warlord"]), "v16-d1");
  let s: CitadelsState = {
    ...base, phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "witch"], [BOB, "warlord"], [CARA, "king"]]),
    callRank: 1, active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [], builtThisTurn: 0,
    players: base.players.map((p) => ({ ...p, gold: 0, hand: [], city: [] })),
  };
  const golds: number[] = [rawGold(s, ANN)];
  const purposes: string[] = [openPurpose(s) ?? "-"];
  for (let i = 0; i < 200; i += 1) {
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advanceTurn(s, "warlord");
    golds.push(rawGold(s, ANN));
    purposes.push(openPurpose(s) ?? "-");
  }
  expect(purposes, "the fold must reach the resume").toContain("witch-resume");
  expect(
    Math.max(...golds),
    "the Witch gathers once (+2 on her held turn); the resume adds nothing. " +
      "gold trail " + golds.join(",") + "; windows " + purposes.join(","),
  ).toBe(2);
});

/**
 * The same defect through a REAL deal, not a hand-built stack: a 3-player game
 * where ANN drafts the Witch and BOB the Warlord. ANN's empty city means her only
 * gold is the held-turn gather, so her purse must never exceed 2.
 */
test("D16-1b the Witch resume double-gather reproduces through a real deal", () => {
  const cast: readonly CharacterId[] = ["witch", "warlord", "magician", "king", "bishop", "merchant", "architect", "spy"];
  const dealt = dealFor(cast, SEATS3, { ann: "witch", bob: "warlord" }, undefined, "v16-d1b");
  let s: CitadelsState = {
    ...dealt,
    players: dealt.players.map((p) => ({ ...p, gold: 0, hand: [], city: [] })),
  };
  const golds: number[] = [rawGold(s, ANN)];
  for (let i = 0; i < 200; i += 1) {
    if (openPurpose(s) === "draft-pick" || s.phase !== "turn") break;
    s = advanceTurn(s, "warlord");
    golds.push(rawGold(s, ANN));
  }
  expect(
    Math.max(...golds),
    "the Witch purse across held turn and resume; gold trail " + golds.join(","),
  ).toBe(2);
});

// ---------------------------------------------------------------------------
// Positive probes: the clauses this pass did not break
// ---------------------------------------------------------------------------

/**
 * P1 - the D15 fix holds. On a plain turn the ability drains AFTER the gather, so
 * the Warlord's destroy sees the post-gather purse and both the plain and the
 * refused turn destroy the Barracks (refused == plain). Revert the plain
 * relocation and the refused turn stops matching the plain.
 */
test("P1 the plain turn still gathers before its ability (refused == plain)", () => {
  const board: Board = {
    gold: { ann: 0, bob: 0, cara: 0 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: [], cara: ["barracks"] },
  };
  const plain = fold({ character: "warlord", threats: [], entropy: "v16-p1", ...board }, "none");
  const refused = fold({ character: "warlord", threats: ["warlord"], entropy: "v16-p1", ...board }, "refuse");
  expect(cityIds(plain.end, CARA), "the plain Warlord destroys the Barracks").toEqual([]);
  expect(cityIds(refused.end, CARA), "the refused Warlord destroys the Barracks").toEqual([]);
  expect(rawGold(plain.end, BOB), "the plain Warlord pays the destroy price").toBe(0);
  expect(endKey(refused.end), "refused == plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});

/**
 * P2 - the first-pass guard holds for a multi-pass effect. The Spy walks four
 * passes over the turn window; a relocation that fires on a later pass hoists the
 * enclosing build window over the arm step and the turn gathers again. The Spy's
 * ability here moves no gold, so the turn must show exactly the gather's 2 gold.
 */
test("P2 the Spy gathers exactly once across its four passes", () => {
  const board: Board = {
    gold: { ann: 0, bob: 0, cara: 5 },
    hands: { ann: [], bob: [], cara: ["manor"] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = fold({ character: "spy", threats: [], entropy: "v16-p2", ...board }, "none");
  expect(
    rawGold(plain.end, BOB),
    "the Spy's turn shows one gather (2 gold); " + plain.purposes.join(","),
  ).toBe(2);
});

/**
 * The first-pass guard (helpers.ts `relocateEffectBelowThreat`) is load-bearing
 * for every effect whose ability walks the turn window more than once: a
 * relocation on a later pass hoists the enclosing build window over the arm step
 * that arms its gather marker, so the turn gathers again. Only the Spy had a
 * one-gather guard (P2 here, and purse-timing.test.ts's Spy row); this parameterized
 * guard pins the other four multi-pass effects. Each is folded on an
 * empty-purse board where its ability moves no gold, so the only gold BOB holds
 * is the turn's gather and the purse must never exceed 2. Neuter the guard
 * (`if (hasArmAbove || !hasWindowAbove)` -> `if (false)`) and every row
 * reddens: Spy 8, Assassin 4, Magistrate 4, Thief 4, Blackmailer 6.
 */
const MULTI_PASS: readonly (readonly [CharacterId, string])[] = [
  ["spy", "choose-type"],
  ["assassin", "choose-character"],
  ["magistrate", "choose-character"],
  ["thief", "choose-character"],
  ["blackmailer", "blackmailer-resolve"],
];

test("P4 every multi-pass effect gathers exactly once (the first-pass guard)", () => {
  for (const [character, window] of MULTI_PASS) {
    const base = rawGenesis(SEATS3, castFor([character]), "v16-p4-" + character);
    const filler: CharacterId = character === "assassin" ? "thief" : "assassin";
    const partner =
      DEFAULTS.find((c) => specOfCharacter(c).rank > specOfCharacter(character).rank && c !== filler) ?? "king";
    const armed: CitadelsState = {
      ...base, phase: "turn", draft: null,
      claimed: claimsOf([[ANN, filler], [BOB, character], [CARA, partner]]),
      callRank: specOfCharacter(character).rank, active: BOB,
      steps: [{ kind: "call" }, { kind: "end-round" }],
      pending: null, threats: [], builtThisTurn: 0,
      players: base.players.map((p) => ({ ...p, gold: 0, hand: [], city: [] })),
    };
    const policy = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
      const p = openPurpose(s);
      if (p === "turn") { const h = rawHand(s, BOB); return h.length > 0 ? { t: "build", card: 0 } : { t: "gold" }; }
      if (p === "keep") return { t: "keep", index: 0 };
      if (p === "choose-character") return { t: "name-character", character: "warlord" };
      if (p === "choose-seat") return { t: "target", seat: CARA };
      if (p === "choose-type") return { t: "name-type", type: "trade" };
      if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
      return null;
    };
    const run = foldFrom(armed, policy, stop, 300, "v16-p4-" + character);
    const purposes = run.steps.map((s) => openPurpose(s) ?? "-");
    const golds = run.steps.map((s) => rawGold(s, BOB));
    expect(purposes, character + " ran its ability: " + purposes.join(",")).toContain(window);
    expect(
      Math.max(...golds),
      character + " gathered exactly once (2 gold); gold trail " + golds.join(",") + "; windows " + purposes.join(","),
    ).toBe(2);
  }
});

/**
 * P3 - the Alchemist's settle refund still runs after its build on a refused
 * threat, so the refused turn reaches the plain turn's end state.
 */
test("P3 the Alchemist's settle refund still runs after its build under a refused threat", () => {
  const board: Board = {
    gold: { ann: 0, bob: 9, cara: 0 },
    hands: { ann: [], bob: ["palace", "tavern"], cara: [] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = fold({ character: "alchemist", threats: [], entropy: "v16-p3", ...board }, "none");
  const refused = fold({ character: "alchemist", threats: ["alchemist"], entropy: "v16-p3", ...board }, "refuse");
  expect(cityIds(refused.end, BOB).length, "the refused Alchemist builds").toBe(cityIds(plain.end, BOB).length);
  expect(endKey(refused.end), "the refused Alchemist matches the plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});
