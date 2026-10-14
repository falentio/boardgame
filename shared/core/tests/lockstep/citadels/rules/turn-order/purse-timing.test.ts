import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, cityIds, foldFrom, openPurpose, rawGenesis, rawGold, rawHand,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "../../driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";

/**
 * Fifteenth pass. Passes 1-14 swept the Blackmailer threat seam build-by-build
 * and ability-by-ability; fix13 relocated a threatened seat's ability windows
 * below the threat, and fix14 (536f78d) moved the post-threat build window below
 * those relocated windows so a threatened seat builds AFTER its ability.
 *
 * This pass attacks the ORDER the relocation leaves behind relative to the GATHER.
 * A plain turn runs the character effect at the resolve step ABOVE its gather
 * window, so the effect's windows drain BEFORE the gather. A threatened turn now
 * drains them BELOW the threat, i.e. AFTER the gather. An ability whose result
 * depends on the purse (the Warlord's destroy, the Marshal's seize, the Diplomat's
 * exchange, the Abbot's richest clause) therefore sees a DIFFERENT purse on a
 * refused turn than on a plain one - so the refused turn no longer ends where the
 * plain turn ends. The D14-1 fix unified the build order but not the gather order.
 *
 * The file's scope is wider than its name: besides the purse-sensitive family above
 * (D15-1 to D15-3), it pins the post-threat build order the fix rounds left behind
 * (P1 to P5: the Scholar's kept draw, the Alchemist's refund, the Trader's
 * trade-build window, the Navigator's gain, the Museum offer), the gather-count
 * guard for a multi-pass effect (the Spy), and the adaptive 26-character
 * refused-vs-plain sweep (P6) that catches a regression in the general order. The
 * name records the pass that found the first family, not the whole file.
 *
 * Every fold below re-reads the hand at every build window (the adaptive policy
 * verify-14 proved necessary), folds plain and refused from the SAME entropy so
 * the deck is identical, and drives every window the character opens.
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

const ALL: readonly CharacterId[] = ["assassin","witch","magistrate","thief","spy","magician","wizard","seer","king","emperor","patrician","bishop","abbot","cardinal","merchant","alchemist","trader","architect","navigator","scholar","warlord","diplomat","marshal","artist","queen","tax-collector"];

/** Adaptive: re-read the hand at every build window; refuse the threat. */
const policy = (threat: "none" | "refuse") =>
  (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "turn") { const h = rawHand(s, BOB); return h.length > 0 ? { t: "build", card: 0 } : { t: "gold" }; }
    if (p === "trader-build") { const h = rawHand(s, BOB); return h.length > 0 ? { t: "build", card: 0 } : null; }
    if (p === "keep" || p === "scholar-keep") return { t: "keep", index: 0 };
    if (p === "blackmailer-threat") return threat === "none" ? null : { t: "choose", value: "refuse" };
    if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
    if (p === "magician-swap") return { t: "target", seat: CARA };
    if (p === "magician-discard") return { t: "keep", index: 0 };
    if (p === "wizard-take") return s.pending?.target === null ? { t: "target", seat: CARA } : { t: "keep", index: 0 };
    if (p === "seer-receive") return null;
    if (p === "seer-give") return { t: "keep", index: 0 };
    if (p === "warlord-destroy") return s.pending?.note === "warlord-destroy" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (p === "marshal-seize") return s.pending?.note === "marshal-seize" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    if (p === "artist-beautify") return { t: "keep", index: 0 };
    if (p === "abbot-split") return { t: "choose", value: "0" };
    if (p === "diplomat-exchange") { const n = s.pending?.note; if (n === "diplomat-target") return { t: "target", seat: CARA }; return { t: "keep", index: 0 }; }
    if (p === "choose-character") return { t: "name-character", character: "king" };
    if (p === "choose-seat") return { t: "target", seat: CARA };
    if (p === "choose-type") return { t: "name-type", type: "trade" };
    return null;
  };

const fold = (o: ArmOpts, threat: "none" | "refuse") => {
  const run = foldFrom(arm(o), policy(threat), stop, 300, o.entropy);
  const end = run.steps[run.steps.length - 1] as CitadelsState;
  return { end, purposes: run.steps.map((s) => openPurpose(s) ?? "-") };
};
const seat = (s: CitadelsState, id: SeatId) => s.players.find((p) => p.seat === id)!;
/** The refused end state must equal the plain one: purse, hand, both cities, deck. */
const endKey = (s: CitadelsState): string =>
  seat(s, BOB).gold + "|" + [...rawHand(s, BOB)].sort().join(",") + "|" +
  seat(s, BOB).city.map((d) => d.id + ":" + d.gold).join(",") + "|" +
  seat(s, CARA).city.map((d) => d.id).join(",") + "|" + seat(s, CARA).gold + "|" + s.deck.length;

// ---------------------------------------------------------------------------
// D15: a refused threatened seat's purse-gated ability sees a different purse
// ---------------------------------------------------------------------------

/**
 * The rule (rules.json warlord): "You may destroy one district of your choice ...
 * by paying one fewer gold than its cost." A turn gathers two gold first, so a
 * Warlord with an empty purse gathers to 2 and can pay 2 to destroy a Barracks
 * (cost 3). The D15 fix gives the plain turn and the refused turn one order -
 * gather -> abilities -> build - so both Warlords destroy the Barracks and both
 * end with 0 gold. Measured: plain and refused each end 0||||0|57 with the rival's
 * city empty. Before the fix the plain Warlord drained its destroy window ABOVE
 * the gather, held 0 gold at the window, destroyed nothing, and ended 2|||barracks|0|56,
 * so refused != plain.
 */
test("D15-1 a refused threatened Warlord destroys exactly where the plain Warlord does", () => {
  const board: Board = {
    gold: { ann: 0, bob: 0, cara: 0 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: [], cara: ["barracks"] },
  };
  const plain = fold({ character: "warlord", threats: [], entropy: "v15-d1", ...board }, "none");
  const refused = fold({ character: "warlord", threats: ["warlord"], entropy: "v15-d1", ...board }, "refuse");
  expect(seat(refused.end, CARA).city.map((d) => d.id), "refused: the post-gather purse pays for the destroy").toEqual([]);
  expect(seat(plain.end, CARA).city.map((d) => d.id), "plain: the same gather pays for the destroy").toEqual([]);
  expect(rawGold(refused.end, BOB), "refused: 0 gold after the destroy").toBe(0);
  expect(rawGold(plain.end, BOB), "plain: 0 gold after the destroy").toBe(0);
  expect(
    endKey(refused.end),
    "the refused Warlord must end where the plain Warlord ends; refused " +
      refused.purposes.join(",") + " vs plain " + plain.purposes.join(","),
  ).toBe(endKey(plain.end));
});

/**
 * The rule (rules.json abbot): "If at any point during your turn you are not the
 * richest player, the richest player must give you 1 gold." The richest check is
 * purse-sensitive. Measured on a board where BOB (0 gold) is not richest before
 * the gather but IS tied-or-richest after it: the plain Abbot evaluates the clause
 * before its gather (so it takes 1 gold from the richest) and ends at 3; the
 * refused Abbot evaluates it after the gather (so it receives nothing) and ends
 * at 2.
 */
test("D15-2 a refused threatened Abbot resolves its richest clause on the post-gather purse", () => {
  const board: Board = {
    gold: { ann: 1, bob: 0, cara: 2 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = fold({ character: "abbot", threats: [], entropy: "v15-d2", ...board }, "none");
  const refused = fold({ character: "abbot", threats: ["abbot"], entropy: "v15-d2", ...board }, "refuse");
  expect(rawGold(refused.end, BOB), "the plain Abbot's clause is measured pre-gather").toBe(rawGold(plain.end, BOB));
  expect(
    endKey(refused.end),
    "the refused Abbot must end where the plain Abbot ends; refused " +
      refused.purposes.join(",") + " vs plain " + plain.purposes.join(","),
  ).toBe(endKey(plain.end));
});

/**
 * The same family for the other two purse-gated military abilities. The Marshal
 * "seize[s] one district costing three or less ... by paying its owner gold equal
 * to its cost", and the Diplomat "exchange[s] ... paying the difference if theirs
 * costs more". Measured: the refused Marshal seizes a Watchtower the plain Marshal
 * cannot afford, and the refused Diplomat completes an exchange (and pays the
 * difference) the plain Diplomat cannot.
 */
test("D15-3 the purse-timing family: a refused Marshal and Diplomat diverge from their plain turns", () => {
  const marshalBoard: Board = {
    gold: { ann: 0, bob: 0, cara: 0 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: [], cara: ["watchtower"] },
  };
  const pm = fold({ character: "marshal", threats: [], entropy: "v15-d3m", ...marshalBoard }, "none");
  const rm = fold({ character: "marshal", threats: ["marshal"], entropy: "v15-d3m", ...marshalBoard }, "refuse");
  expect(
    endKey(rm.end),
    "the refused Marshal must end where the plain Marshal ends; refused " + rm.purposes.join(","),
  ).toBe(endKey(pm.end));

  const dipBoard: Board = {
    gold: { ann: 0, bob: 0, cara: 0 },
    hands: { ann: [], bob: ["watchtower"], cara: ["barracks"] },
    cities: { ann: [], bob: ["watchtower"], cara: ["barracks"] },
  };
  const pd = fold({ character: "diplomat", threats: [], entropy: "v15-d3d", ...dipBoard }, "none");
  const rd = fold({ character: "diplomat", threats: ["diplomat"], entropy: "v15-d3d", ...dipBoard }, "refuse");
  expect(
    endKey(rd.end),
    "the refused Diplomat must end where the plain Diplomat ends; refused " + rd.purposes.join(","),
  ).toBe(endKey(pd.end));
});

/**
 * The double-gather regression guard for a multi-pass effect. The Spy walks four
 * passes (seat, type, peek, apply), each re-entering resolveTurn's turn window, so
 * a relocation that fires on a later pass hoists the enclosing BUILD window over
 * the arm step that arms its gather marker and the turn gathers again. Measured on
 * the engine-coverage Spy guard before the fix: purposes
 * [null,turn,choose-seat,turn,choose-type,turn,draft-pick] - three gathers - and a
 * goldDelta of 6 where 4 is correct. Here the Spy names a type the target holds
 * none of, so its ability moves no gold: the turn must then show exactly the
 * gather's 2 gold, plain and refused alike. A second gather leaves 4.
 */
test("the Spy gathers exactly once per turn across its four passes", () => {
  const board: Board = {
    gold: { ann: 0, bob: 0, cara: 5 },
    hands: { ann: [], bob: [], cara: ["manor"] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = fold({ character: "spy", threats: [], entropy: "v15-g1", ...board }, "none");
  const refused = fold({ character: "spy", threats: ["spy"], entropy: "v15-g1", ...board }, "refuse");
  expect(
    rawGold(plain.end, BOB),
    "the plain Spy gathered exactly once; " + plain.purposes.join(","),
  ).toBe(2);
  expect(
    rawGold(refused.end, BOB),
    "the refused Spy gathered exactly once; " + refused.purposes.join(","),
  ).toBe(2);
  expect(
    endKey(refused.end),
    "and the refused Spy still ends where the plain Spy ends; " + refused.purposes.join(","),
  ).toBe(endKey(plain.end));
});

// ---------------------------------------------------------------------------
// Positive probes: the clauses this pass did not break
// ---------------------------------------------------------------------------

/**
 * P1 - the D14-1 fix holds. A refused threatened Scholar's relocated scholar-keep
 * window leads its post-threat build window (the draw feeds the build), and the
 * refused turn reaches the plain turn's end state. Neuter the fix and this reddens.
 */
test("P1 the D14-1 order holds: the Scholar's kept draw leads the post-threat build, and the refused turn matches the plain", () => {
  const board: Board = {
    gold: { ann: 0, bob: 12, cara: 0 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: ["school-of-magic"], cara: [] },
  };
  const plain = fold({ character: "scholar", threats: [], entropy: "v15-p1", ...board }, "none");
  const refused = fold({ character: "scholar", threats: ["scholar"], entropy: "v15-p1", ...board }, "refuse");
  const rResolve = refused.purposes.indexOf("blackmailer-resolve");
  const rKeep = refused.purposes.indexOf("scholar-keep");
  const rBuild = refused.purposes.findIndex((p, i) => i > rResolve && p === "turn");
  expect(
    rResolve >= 0 && rKeep >= 0 && rBuild >= 0 && rKeep < rBuild,
    "the draw must lead the post-threat build; " + refused.purposes.join(","),
  ).toBe(true);
  expect(endKey(refused.end), "the refused Scholar matches the plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});

/**
 * P2 - the Alchemist's settle refund still runs AFTER its build on a refused
 * threat (the fix's `leadsWithResolve` branch), so it refunds only what the build
 * actually paid and the refused turn matches the plain one.
 */
test("P2 the Alchemist's settle refund still runs after its build on a refused threat", () => {
  const board: Board = {
    gold: { ann: 0, bob: 9, cara: 0 },
    hands: { ann: [], bob: ["palace", "tavern"], cara: [] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = fold({ character: "alchemist", threats: [], entropy: "v15-p2", ...board }, "none");
  const refused = fold({ character: "alchemist", threats: ["alchemist"], entropy: "v15-p2", ...board }, "refuse");
  expect(cityIds(refused.end, BOB).length, "the refused Alchemist builds").toBe(cityIds(plain.end, BOB).length);
  expect(endKey(refused.end), "the refused Alchemist matches the plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});

/**
 * P3 - the Trader's `trader-build` window and the turn's limit build both survive
 * a refused threat and reach the plain turn's end state.
 */
test("P3 the Trader's trade-build window and limit build survive a refused threat", () => {
  const board: Board = {
    gold: { ann: 0, bob: 12, cara: 0 },
    hands: { ann: [], bob: ["tavern", "market", "trading-post", "harbor"], cara: [] },
    cities: { ann: [], bob: ["tavern"], cara: [] },
  };
  const plain = fold({ character: "trader", threats: [], entropy: "v15-p3", ...board }, "none");
  const refused = fold({ character: "trader", threats: ["trader"], entropy: "v15-p3", ...board }, "refuse");
  expect(refused.purposes.filter((p) => p === "trader-build").length, "the trader-build window opens").toBeGreaterThan(0);
  expect(endKey(refused.end), "the refused Trader matches the plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});

/**
 * P4 - the Navigator's gain rides the resolve step, not a turn window, and its
 * refused turn (no build at all) reaches the plain turn's end state.
 */
test("P4 the Navigator's gain rides the resolve step; its refused turn matches the plain", () => {
  const board: Board = {
    gold: { ann: 0, bob: 0, cara: 0 },
    hands: { ann: [], bob: [], cara: [] },
    cities: { ann: [], bob: [], cara: [] },
  };
  const plain = fold({ character: "navigator", threats: [], entropy: "v15-p4", ...board }, "none");
  const refused = fold({ character: "navigator", threats: ["navigator"], entropy: "v15-p4", ...board }, "refuse");
  expect(refused.purposes, "the Navigator opens no trade-build window").not.toContain("trader-build");
  expect(endKey(refused.end), "the refused Navigator matches the plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});

/**
 * P5 - the new continuation shape holds: the rearm arm step does not clobber the
 * Museum's placement offer (the offer still tucks a card), and the refused
 * Museum-owning Scholar matches the plain one.
 */
test("P5 the rearm does not clobber the Museum offer under a refused threat", () => {
  const board: Board = {
    gold: { ann: 0, bob: 12, cara: 0 },
    hands: { ann: [], bob: ["tavern", "market"], cara: [] },
    cities: { ann: [], bob: ["museum"], cara: [] },
  };
  const plain = fold({ character: "scholar", threats: [], entropy: "v15-p5", ...board }, "none");
  const refused = fold({ character: "scholar", threats: ["scholar"], entropy: "v15-p5", ...board }, "refuse");
  const tuck = (s: CitadelsState) => seat(s, BOB).city[0]?.cards?.length ?? 0;
  expect(tuck(refused.end), "the Museum offer still tucks a card under a refused threat").toBe(tuck(plain.end));
  expect(tuck(refused.end), "and the tuck landed").toBe(1);
  expect(endKey(refused.end), "the refused Museum Scholar matches the plain: " + refused.purposes.join(",")).toBe(endKey(plain.end));
});

/**
 * P6 - the adaptive 26-character rich-board sweep: with a purse deep enough that
 * no ability is gold-gated, every character's refused turn reaches the plain end
 * state. This is the guard that would catch a regression in the general order; it
 * is deliberately blind to the D15 family (which needs a gated purse).
 */
test("P6 the adaptive 26-character rich-board sweep finds no refused-vs-plain divergence", () => {
  const board: Board = {
    gold: { ann: 0, bob: 30, cara: 0 },
    hands: { ann: [], bob: ["tavern", "market", "trading-post", "palace", "smithy"], cara: [] },
    cities: { ann: [], bob: [], cara: ["watchtower"] },
  };
  const divergences: string[] = [];
  for (const character of ALL) {
    const entropy = "v15-p6-" + character;
    const plain = fold({ character, threats: [], entropy, ...board }, "none");
    const refused = fold({ character, threats: [character], entropy, ...board }, "refuse");
    if (endKey(plain.end) !== endKey(refused.end)) {
      divergences.push(character + ": plain " + endKey(plain.end) + " vs refused " + endKey(refused.end));
    }
  }
  expect(divergences, divergences.join("; ")).toEqual([]);
});
