import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, cityIds, foldFrom, openPurpose, rawGenesis, rawGold, rawHand, rawFrame, rawStep,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "../../driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import { stateCodec } from "../../../../../lockstep/games/citadels/state.ts";
import { canThreat } from "../../../../../lockstep/games/citadels/characters/blackmailer.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";

/**
 * Fourteenth pass. Passes 1-13 swept the threat seam build-by-build and
 * ability-by-ability; fix13c relocated a threatened seat's ability windows below
 * the Blackmailer threat and re-arms the payload they read with an arm step. This
 * pass attacks the ORDER the relocation leaves behind: resolveTurn's threatened
 * branch splices the post-threat build window directly under the threat, ABOVE
 * the relocated ability windows, so a seat whose ability feeds its build (the
 * Scholar draws seven and keeps one) builds on its pre-ability hand and loses the
 * build the plain turn takes.
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
const arm = (o: {
  readonly character: CharacterId;
  readonly threats: readonly CharacterId[];
  readonly entropy: string;
} & Board): CitadelsState => {
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
      hand: [...(o.hands?.[p.seat] ?? p.hand)],
      city: (o.cities?.[p.seat] ?? []).map((id) => ({ id, gold: 0 })),
    })),
  };
};

const stop = (steps: readonly CitadelsState[]): boolean => {
  const s = steps[steps.length - 1] as CitadelsState;
  return openPurpose(s) === "draft-pick" || s.phase !== "turn";
};

/** Build the hand's first card whenever a build window opens; refuse the threat. */
const buildFirst = (threat: "none" | "refuse") =>
  (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const p = openPurpose(s);
    if (p === "turn") return rawHand(s, BOB).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
    if (p === "keep" || p === "scholar-keep") return { t: "keep", index: 0 };
    if (p === "blackmailer-threat") return threat === "none" ? null : { t: "choose", value: "refuse" };
    if (p === "blackmailer-resolve") return { t: "choose", value: "no" };
    return null;
  };

const fold = (o: Parameters<typeof arm>[0], threat: "none" | "refuse") => {
  const run = foldFrom(arm(o), buildFirst(threat), stop, 200, o.entropy);
  return { end: run.steps[run.steps.length - 1] as CitadelsState, purposes: run.steps.map((s) => openPurpose(s) ?? "-") };
};
const buildsOf = (s: CitadelsState): number => (s.players.find((p) => p.seat === BOB)?.city.length ?? 0) - 1;

/**
 * D14-1  A refused threatened Scholar runs its post-threat build window ABOVE the
 * relocated scholar-keep window, so it builds on its pre-draw hand. The Scholar's
 * ability is the seven-card draw and its keep ("Draw seven cards from the deck and
 * choose one to add to your hand"), and on the plain turn that ability lands
 * before the build, so the Scholar builds the card it drew. The threatened turn
 * gathers, resolves the threat, then offers the build on an EMPTY hand and only
 * then draws. Measured: the plain Scholar builds one district; the refused Scholar
 * builds none and ends holding the card it drew. This is the scholar/museum and
 * scholar/school pair the fix13c probe named, and it predates fix13c (it is the
 * D13 relocation's build-window splice).
 */
test("D14-1 a refused threatened Scholar builds before it draws, losing a build", () => {
  for (const [label, cityId] of [["school", "school-of-magic"], ["museum", "museum"]] as const) {
    const board: Board = {
      gold: { ann: 0, bob: 12, cara: 0 },
      hands: { ann: [], bob: [], cara: [] },
      cities: { ann: [], bob: [cityId as DistrictId], cara: [] },
    };
    const plain = fold({ character: "scholar", threats: [], entropy: "v14-d1-" + label, ...board }, "none");
    const refused = fold({ character: "scholar", threats: ["scholar"], entropy: "v14-d1-" + label, ...board }, "refuse");
    const keep = plain.purposes.indexOf("scholar-keep");
    // The plain turn gathers first (the gather is a `turn` window), then the
    // Scholar's keep, then the build (the next `turn` window): gather -> abilities
    // -> build (docs/design/citadels-full-game.md "A turn: gather ..., then
    // optionally build one district"). The keep must lead the build that follows
    // it, not the gather. Measured plain: -,turn,scholar-keep,turn,...
    const firstBuild = plain.purposes.findIndex((p, i) => i > keep && p === "turn");
    expect(keep, label + " plain: the Scholar's keep leads its build; " + plain.purposes.join(",")).toBeLessThan(firstBuild);
    // And the gather must lead the keep: the plain turn is gather -> abilities ->
    // build, so the D15 relocation plants the ability window BELOW the gather turn
    // window. A relocation revert (the ability drains above the gather) leaves
    // `-,scholar-keep,turn,...` and reddens here, which the keep-before-build
    // assertion above cannot see (it holds either way). Measured plain at head:
    // `-,turn,scholar-keep,turn,...`; with the plain relocation reverted:
    // `-,scholar-keep,turn,...`.
    const gatherAt = plain.purposes.indexOf("turn");
    expect(gatherAt, label + " plain: the gather turn window opened; " + plain.purposes.join(",")).toBeGreaterThanOrEqual(0);
    expect(
      keep,
      label + " plain: the gather leads the Scholar's keep (gather -> abilities -> build); " + plain.purposes.join(","),
    ).toBeGreaterThan(gatherAt);
    expect(buildsOf(plain.end), label + " plain: the Scholar builds the card it drew").toBe(1);
    // The rule: the threatened seat's ability drains before its post-threat build
    // window, exactly as the plain turn's draw precedes its build. The refused
    // fold's relocated keep window must therefore lead the first `turn` window
    // below the resolved threat.
    const rResolve = refused.purposes.indexOf("blackmailer-resolve");
    const rKeep = refused.purposes.indexOf("scholar-keep");
    const rBuild = refused.purposes.findIndex((p, i) => i > rResolve && p === "turn");
    expect(
      rResolve >= 0 && rBuild >= 0 && rKeep >= 0 && rKeep < rBuild,
      label + " refused: the draw must lead the post-threat build; " + refused.purposes.join(","),
    ).toBe(true);
    expect(
      buildsOf(refused.end),
      label + " refused: the Scholar built " + buildsOf(refused.end) + ", the plain turn built " + buildsOf(plain.end) + "; purposes " + refused.purposes.join(","),
    ).toBe(buildsOf(plain.end));
  }
});

/**
 * P1  The other two cases the fix13c probe named - cardinal/school and
 * architect/school - are probe-policy artifacts, not defects: their refused turns
 * reach the SAME end state as the plain turn. The Cardinal's income window carries
 * a zero shortfall and takes nothing, and the Architect's extra build windows are
 * relocated below the threat exactly as the rule requires; both settle on the same
 * gold, hand, and city. A regression that made either lose a build or a card
 * reddens this.
 */
test("P1 the refused Cardinal and Architect reach the plain turn's end state", () => {
  for (const character of ["cardinal", "architect"] as const) {
    const board: Board = {
      gold: { ann: 0, bob: 20, cara: 6 },
      hands: { ann: ["tavern"], bob: ["tavern", "market", "trading-post", "palace"], cara: ["market", "palace"] },
      cities: { ann: [], bob: ["school-of-magic"], cara: ["tavern"] },
    };
    const plain = fold({ character, threats: [], entropy: "v14-p1-" + character, ...board }, "none");
    const refused = fold({ character, threats: [character], entropy: "v14-p1-" + character, ...board }, "refuse");
    expect(rawGold(refused.end, BOB), character + " refused gold").toBe(rawGold(plain.end, BOB));
    expect([...rawHand(refused.end, BOB)].sort(), character + " refused hand").toEqual([...rawHand(plain.end, BOB)].sort());
    expect(cityIds(refused.end, BOB), character + " refused city").toEqual(cityIds(plain.end, BOB));
  }
});

/**
 * P2  The arm step (fix13c) survives the codec the engine runs between frames:
 * a mid-flight round-trip preserves both the stack and the re-armed pending, so a
 * relocated payload cannot be lost at a frame boundary.
 */
test("P2 the arm step survives a codec round-trip mid-flight", () => {
  const board: Board = {
    gold: { ann: 0, bob: 6, cara: 0 },
    hands: { ann: [], bob: ["palace", "tavern"], cara: [] },
    cities: { ann: [], bob: ["museum"], cara: [] },
  };
  let state = arm({ character: "scholar", threats: ["scholar"], entropy: "v14-p2", ...board });
  let armSeen = 0;
  let mismatch = 0;
  for (let i = 0; i < 40; i += 1) {
    if (state.steps.some((s) => s.kind === "arm")) {
      armSeen += 1;
      const round = stateCodec.decode(stateCodec.encode(state));
      if (JSON.stringify(round.steps) !== JSON.stringify(state.steps) || JSON.stringify(round.pending) !== JSON.stringify(state.pending)) {
        mismatch += 1;
      }
    }
    state = rawStep(state, rawFrame(i, [[BOB, { kind: "act", action: { t: "gold" } }] as never]));
    if (openPurpose(state) === "draft-pick" || state.phase !== "turn") break;
  }
  expect(armSeen, "the fold reached the arm step").toBeGreaterThan(0);
  expect(mismatch, "every arm step round-tripped unchanged").toBe(0);
});

/**
 * P3  The relocation's Witch exemption is unreachable, so it cannot be the
 * D13-12 the brief hunts: the Witch is rank 1, and canThreat refuses every rank-1
 * character, so the Blackmailer can never put a marker on her. A hand-built
 * threatened Witch is not a reachable game position.
 */
test("P3 a Witch can never be threatened, so her relocation exemption is unreachable", () => {
  const base = rawGenesis(SEATS3, castFor(["witch"]), "v14-p3");
  expect(specOfCharacter("witch").rank, "the Witch is rank 1").toBe(1);
  expect(canThreat(base, "witch"), "canThreat refuses the rank-1 Witch").toBe(false);
});

/**
 * P4  A refused threatened turn still closes exactly once, so the end-of-turn
 * hooks fire once (fix13c's endTurnThen change). The Smithy (2 gold for 3 cards,
 * onEndTurn) makes a double close visible as a doubled charge.
 */
test("P4 a refused threat fires the end-of-turn hook exactly once", () => {
  for (const character of ["scholar", "magician", "seer", "warlord"] as const) {
    const board: Board = {
      gold: { ann: 0, bob: 20, cara: 0 },
      hands: { ann: [], bob: ["palace", "tavern"], cara: [] },
      cities: { ann: [], bob: ["smithy"], cara: [] },
    };
    const plain = fold({ character, threats: [], entropy: "v14-p4-" + character, ...board }, "none");
    const refused = fold({ character, threats: [character], entropy: "v14-p4-" + character, ...board }, "refuse");
    expect(rawGold(refused.end, BOB), character + " refused gold: the hook fired twice if the refused purse is the plain purse minus 2").toBe(rawGold(plain.end, BOB));
  }
});
