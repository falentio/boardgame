import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, cityIds, foldFrom, openPurpose, rawGenesis, rawGold, rawHand,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "./driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../lockstep/games/citadels/districts.ts";
import { stateCodec } from "../../../lockstep/games/citadels/state.ts";

const DEFAULTS: readonly CharacterId[] = [
  "assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord",
];

const castFor = (targets: readonly CharacterId[]): readonly CharacterId[] => {
  const cast = DEFAULTS.map((fallback, i) => {
    const rank = (i + 1) as Rank;
    return targets.find((t) => specOfCharacter(t).rank === rank) ?? fallback;
  });
  const nine = targets.find((t) => specOfCharacter(t).rank === 9);
  return nine === undefined ? cast : [...cast, nine];
};

const claimsOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

const stop = (steps: readonly CitadelsState[]): boolean => {
  const s = steps[steps.length - 1] as CitadelsState;
  return openPurpose(s) === "draft-pick" || s.phase !== "turn";
};

const HAND: readonly DistrictId[] = ["tavern", "palace", "dragon-gate", "market"];

const threatTurn = (character: CharacterId, entropy: string) => {
  const base = rawGenesis(SEATS3, castFor([character]), entropy);
  const partner =
    DEFAULTS.find((c) => specOfCharacter(c).rank > specOfCharacter(character).rank) ?? "warlord";
  const start: CitadelsState = {
    ...base,
    phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "blackmailer"], [BOB, character], [CARA, partner]]),
    callRank: specOfCharacter(character).rank, active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [character], builtThisTurn: 0,
    players: base.players.map((p) => ({
      ...p,
      gold: p.seat === BOB ? 20 : 0,
      hand: p.seat === BOB ? [...HAND] : [],
      city: p.seat === BOB ? [{ id: "museum" as DistrictId, gold: 0 }] : [],
    })),
  };
  const answer = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn") return rawHand(s, BOB).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
    if (purpose === "keep") return { t: "keep", index: 0 };
    if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
    if (purpose === "blackmailer-resolve") return { t: "choose", value: "no" };
    return null;
  };
  const run = foldFrom(start, answer, stop, 240, entropy);
  const frames = run.steps.map((s) => {
    const st = s as CitadelsState;
    return {
      purpose: openPurpose(st) ?? "-",
      city: cityIds(st, BOB),
      tuck: st.players.find((p) => p.seat === BOB)?.city[0]?.cards?.length ?? 0,
    };
  });
  const threatIdx = frames.findIndex((f) => f.purpose === "blackmailer-threat");
  return {
    purposes: frames.map((f) => f.purpose).join(","), threatIdx,
    cityAtThreat: threatIdx < 0 ? [] : frames[threatIdx]!.city,
    tuckAtThreat: threatIdx < 0 ? -1 : frames[threatIdx]!.tuck,
  };
};

const assertNothingBuiltBeforeThreat = (character: CharacterId, entropy: string): void => {
  const r = threatTurn(character, entropy);
  expect(r.threatIdx, "the blackmailer-threat window opened").toBeGreaterThanOrEqual(0);
  expect(
    r.cityAtThreat,
    "purposes " + r.purposes + ": " + character + " built " + r.cityAtThreat.join("+") + " before its threat resolved",
  ).toEqual(["museum"]);
  expect(
    r.tuckAtThreat,
    "purposes " + r.purposes + ": " + character + " tucked " + r.tuckAtThreat + " card(s) under its Museum before its threat resolved",
  ).toBe(0);
};

test("D12-1 a threatened Architect resolves its threat before it builds", () => {
  assertNothingBuiltBeforeThreat("architect", "v12-d1");
});

test("D12-2 a threatened Alchemist resolves its threat before it builds", () => {
  assertNothingBuiltBeforeThreat("alchemist", "v12-d2");
});

test("D12-3 a threatened Scholar resolves its threat before it builds", () => {
  assertNothingBuiltBeforeThreat("scholar", "v12-d3");
});

test("P1 a threatened King and Merchant still resolve the threat before they build", () => {
  for (const [character, entropy] of [
    ["king", "v12-p1-king"],
    ["merchant", "v12-p1-merch"],
  ] as const) {
    const r = threatTurn(character, entropy);
    expect(r.threatIdx, character + " reachable by a threat window").toBeGreaterThanOrEqual(0);
    expect(r.cityAtThreat, character + " gathers only before the threat").toEqual(["museum"]);
    expect(r.tuckAtThreat, character + " places nothing before the threat").toBe(0);
    const parts = r.purposes.split(",");
    const at = parts.indexOf("blackmailer-threat");
    const keep = parts.indexOf("keep");
    if (keep >= 0) expect(at < keep, character + " placement precedes threat: " + r.purposes).toBe(true);
  }
});

const armTwo = (entropy: string): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor(["merchant", "architect"]), entropy);
  return {
    ...base,
    phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "blackmailer"], [BOB, "merchant"], [CARA, "architect"]]),
    callRank: 6, active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: ["merchant", "architect"], builtThisTurn: 0,
    players: base.players.map((p) => ({ ...p, gold: p.seat === ANN ? 0 : 5, hand: [], city: [] })),
  };
};

const foldTwoReveal = (entropy: string) => {
  const answer = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const purpose = openPurpose(s);
    if (purpose === "turn") return { t: "gold" };
    if (purpose === "keep") return { t: "keep", index: 0 };
    if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
    if (purpose === "blackmailer-resolve") return { t: "choose", value: "reveal" };
    return null;
  };
  const run = foldFrom(armTwo(entropy), answer, stop, 200, entropy);
  const end = run.steps[run.steps.length - 1] as CitadelsState;
  return { bob: rawGold(end, BOB), cara: rawGold(end, CARA), ann: rawGold(end, ANN) };
};

test("P2 two refused markers, both revealed, loot exactly one (the lace)", () => {
  const loud = foldTwoReveal("v12-p2");
  expect(loud.bob, "the lace (Merchant, first name) loses all 8").toBe(0);
  expect(loud.cara, "the decoy has no lace, keeps 7").toBe(7);
  expect(loud.ann, "one lace, one looting: 8, not 15").toBe(8);
});

test("P3 the lace-spent marker shape survives the codec round-trip", () => {
  const base = rawGenesis(SEATS3, castFor(["merchant", "architect"]), "v12-p3");
  const doubled: CitadelsState = {
    ...base, phase: "turn", draft: null, threats: ["architect", "architect"],
  };
  const rebuilt = stateCodec.decode(stateCodec.encode(doubled));
  expect(rebuilt.threats, "the doubled marker must not be deduped by encode/decode").toEqual([
    "architect",
    "architect",
  ]);
});
