import { expect, test } from "vitest";
import {
  ANN, BOB, CARA, SEATS3, cityIds, foldFrom, openPurpose, rawGenesis, rawGold, rawHand,
  type CitadelsAction, type CitadelsState, type SeatId,
} from "./driver.ts";
import { specOfCharacter, type CharacterId, type Rank } from "../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../lockstep/games/citadels/districts.ts";

/**
 * Thirteenth pass: the threatened-seat mechanism, swept over ABILITIES instead of
 * builds. rules.json (blackmailer): "A threatened player must resolve the threat
 * before using abilities or building." The D12 fix refuses a build at the build
 * seam (tryBuild, buildBlockedByThreat) and the D10 fix seats the threat below the
 * threatened seat's gather, but nothing refuses an ABILITY. Every character whose
 * effect opens a window above its turn window therefore runs that ability first:
 * the threat window is spliced below the turn window (withThreat, helpers.ts), and
 * the effect's own windows are pushed above that same turn window.
 *
 * Each counterexample folds a threatened seat with a buildable hand, a Museum in
 * its city, a rival holding cards and one district, and a policy that drives every
 * window the character opens; it then reads the state AT the blackmailer-threat
 * frame and asserts the ability had not landed.
 */
const BASE: Record<number, CharacterId> = {
  1: "assassin", 2: "thief", 3: "magician", 4: "king", 5: "bishop", 6: "merchant",
  7: "architect", 8: "warlord",
};
const claimsOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs].sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));
const stop = (steps: readonly CitadelsState[]): boolean => {
  const s = steps[steps.length - 1] as CitadelsState;
  return openPurpose(s) === "draft-pick" || s.phase !== "turn";
};
/** A hand of four affordable districts: enough for every build limit in the game. */
const HAND: readonly DistrictId[] = ["tavern", "market", "trading-post", "palace"];

interface ThreatFold {
  readonly purposes: string;
  readonly threatIdx: number;
  readonly bobCity: readonly DistrictId[];
  readonly caraCity: readonly DistrictId[];
  readonly bobHand: number;
  readonly caraHand: number;
  readonly bobGold: number;
  readonly caraGold: number;
  readonly markers: readonly number[];
  readonly minCaraHandBeforeThreat: number;
  readonly finalBobCity: readonly DistrictId[];
}

const threatFold = (character: CharacterId, entropy: string): ThreatFold => {
  const rank = specOfCharacter(character).rank;
  const partner = (BASE[rank === 4 ? 6 : 4] ?? "king") as CharacterId;
  const cast: CharacterId[] = [];
  for (let r = 1; r <= 8; r += 1) {
    cast.push(r === rank ? character : r === 2 ? "blackmailer" : (BASE[r] as CharacterId));
  }
  if (rank === 9) cast.push(character);
  const base = rawGenesis(SEATS3, cast, entropy);
  const start: CitadelsState = {
    ...base,
    phase: "turn", draft: null,
    claimed: claimsOf([[ANN, "blackmailer"], [BOB, character], [CARA, partner]]),
    callRank: rank, active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null, threats: [character], builtThisTurn: 0, taxPot: 4,
    players: base.players.map((p) => ({
      ...p,
      gold: p.seat === BOB ? 20 : p.seat === CARA ? 6 : 4,
      hand: p.seat === BOB ? [...HAND]
        : p.seat === CARA ? (["market", "palace"] as DistrictId[])
        : (["tavern"] as DistrictId[]),
      city: p.seat === BOB ? [{ id: "museum" as DistrictId, gold: 0 }]
        : p.seat === CARA ? [{ id: "tavern" as DistrictId, gold: 0 }]
        : [],
    })),
  };
  const answer = (_seat: SeatId, s: CitadelsState): CitadelsAction | null => {
    const st = s as CitadelsState;
    const purpose = openPurpose(st);
    if (purpose === "turn") return rawHand(st, BOB).length > 0 ? { t: "build", card: 0 } : { t: "gold" };
    if (purpose === "trader-build") return rawHand(st, BOB).length > 0 ? { t: "build", card: 0 } : null;
    if (purpose === "keep") return { t: "keep", index: 0 };
    if (purpose === "scholar-keep") return { t: "keep", index: 0 };
    if (purpose === "blackmailer-threat") return { t: "choose", value: "refuse" };
    if (purpose === "blackmailer-resolve") return { t: "choose", value: "no" };
    if (purpose === "magician-swap") return { t: "target", seat: CARA };
    if (purpose === "magician-discard") return { t: "keep", index: 0 };
    if (purpose === "seer-receive") return null;
    if (purpose === "seer-give") return { t: "keep", index: 0 };
    if (purpose === "wizard-take") {
      return st.pending !== null && st.pending.target === null ? { t: "target", seat: CARA } : { t: "keep", index: 0 };
    }
    if (purpose === "warlord-destroy") {
      return st.pending?.note === "warlord-destroy" ? { t: "keep", index: 0 } : { t: "target", seat: CARA };
    }
    if (purpose === "marshal-seize") {
      return st.pending?.note === "marshal-target" ? { t: "target", seat: CARA } : { t: "keep", index: 0 };
    }
    if (purpose === "artist-beautify") return { t: "keep", index: 0 };
    if (purpose === "abbot-split") {
      return st.pending?.note === "abbot-tie" ? { t: "target", seat: CARA } : { t: "choose", value: "0" };
    }
    if (purpose === "diplomat-exchange") {
      return st.pending !== null && st.pending.target === null ? { t: "target", seat: CARA } : { t: "keep", index: 0 };
    }
    if (purpose === "emperor-crown") {
      return st.pending !== null && st.pending.target === null ? { t: "target", seat: CARA } : { t: "draw" };
    }
    if (purpose === "tax-collect") return { t: "choose", value: "take" };
    if (purpose === "choose-character") return { t: "name-character", character: "king" };
    if (purpose === "choose-seat") return { t: "target", seat: CARA };
    if (purpose === "choose-type") return { t: "name-type", type: "trade" };
    if (purpose === "cardinal-gold") return { t: "pay", amount: 0 };
    return null;
  };
  const run = foldFrom(start, answer, stop, 260, entropy);
  const frames = run.steps.map((s) => {
    const st = s as CitadelsState;
    const cara = st.players.find((p) => p.seat === CARA)!;
    return {
      purpose: openPurpose(st) ?? "-",
      bobCity: cityIds(st, BOB),
      caraCity: cityIds(st, CARA),
      bobHand: st.players.find((p) => p.seat === BOB)!.hand.length,
      caraHand: cara.hand.length,
      bobGold: rawGold(st, BOB),
      caraGold: rawGold(st, CARA),
      markers: st.players.find((p) => p.seat === BOB)!.city.map((d) => d.gold),
    };
  });
  const threatIdx = frames.findIndex((f) => f.purpose === "blackmailer-threat");
  const at = threatIdx < 0 ? frames.length - 1 : threatIdx;
  return {
    purposes: frames.map((f) => f.purpose).join(","),
    threatIdx,
    bobCity: frames[at]!.bobCity,
    caraCity: frames[at]!.caraCity,
    bobHand: frames[at]!.bobHand,
    caraHand: frames[at]!.caraHand,
    bobGold: frames[at]!.bobGold,
    caraGold: frames[at]!.caraGold,
    markers: frames[at]!.markers,
    minCaraHandBeforeThreat: frames
      .slice(0, threatIdx < 0 ? frames.length : threatIdx)
      .reduce((low, f) => Math.min(low, f.caraHand), 99),
    finalBobCity: cityIds(run.steps[run.steps.length - 1] as CitadelsState, BOB),
  };
};

/** The board every fold starts from: what the ability frame must still read. */
const PRISTINE = {
  bobCity: ["museum"] as readonly DistrictId[],
  caraCity: ["tavern"] as readonly DistrictId[],
  bobHand: 4,
  caraHand: 2,
  bobGold: 22,
  caraGold: 6,
  bobMarkers: [0] as readonly number[],
};

/** The purpose sequence as an array, so indexOf is an exact frame match. */
const partsOf = (r: ThreatFold): readonly string[] => r.purposes.split(",");

const assertAbilityWaited = (r: ThreatFold, character: CharacterId, note: string): void => {
  expect(r.threatIdx, character + " reached its threat window; purposes " + r.purposes).toBeGreaterThanOrEqual(0);
  expect(r.caraCity, character + " " + note + ": a rival's city changed; purposes " + r.purposes).toEqual(PRISTINE.caraCity);
  expect(r.bobCity, character + " " + note + ": its own city changed; purposes " + r.purposes).toEqual(PRISTINE.bobCity);
  expect(r.markers, character + " " + note + ": a district was marked; purposes " + r.purposes).toEqual(PRISTINE.bobMarkers);
};

test("D13-1 a threatened Warlord resolves its threat before it destroys", () => {
  const r = threatFold("warlord", "v13-d1");
  assertAbilityWaited(r, "warlord", "destroyed a rival's district");
  expect(r.caraCity, "warlord destroyed " + JSON.stringify(PRISTINE.caraCity) + ": purposes " + r.purposes).toEqual(["tavern"]);
});

test("D13-2 a threatened Marshal resolves its threat before it seizes", () => {
  const r = threatFold("marshal", "v13-d2");
  assertAbilityWaited(r, "marshal", "seized a rival's district");
  expect(r.caraGold, "marshal paid the seized district's cost to its rival; purposes " + r.purposes).toBe(PRISTINE.caraGold);
});

test("D13-3 a threatened Diplomat resolves its threat before it exchanges", () => {
  const r = threatFold("diplomat", "v13-d3");
  assertAbilityWaited(r, "diplomat", "exchanged cards with a rival");
});

test("D13-4 a threatened Emperor resolves its threat before it takes the crown", () => {
  const r = threatFold("emperor", "v13-d4");
  assertAbilityWaited(r, "emperor", "took the crown and a card from a rival");
  expect(r.caraHand, "emperor emptied a rival's hand; purposes " + r.purposes).toBe(PRISTINE.caraHand);
});

test("D13-5 a threatened Wizard resolves its threat before it takes a card", () => {
  const r = threatFold("wizard", "v13-d5");
  assertAbilityWaited(r, "wizard", "looked at a rival's hand and took a card");
  expect(r.caraHand, "wizard emptied a rival's hand; purposes " + r.purposes).toBe(PRISTINE.caraHand);
});

test("D13-6 a threatened Magician resolves its threat before it swaps hands", () => {
  const r = threatFold("magician", "v13-d6");
  assertAbilityWaited(r, "magician", "swapped its whole hand with a rival's");
  expect(r.bobHand, "wizard held the rival's hand: " + r.bobHand + " cards; purposes " + r.purposes).toBe(PRISTINE.bobHand);
});

test("D13-7 a threatened Seer resolves its threat before it takes and gives cards", () => {
  const r = threatFold("seer", "v13-d7");
  assertAbilityWaited(r, "seer", "took a card from every rival and gave one back");
  expect(
    r.minCaraHandBeforeThreat,
    "seer emptied a rival's hand mid-take; purposes " + r.purposes,
  ).toBeGreaterThanOrEqual(PRISTINE.caraHand);
});

test("D13-8 a threatened Spy resolves its threat before it peeks and takes", () => {
  const r = threatFold("spy", "v13-d8");
  assertAbilityWaited(r, "spy", "peeked at a rival's hand and took gold");
  expect(r.caraGold, "spy took gold from its target; purposes " + r.purposes).toBe(PRISTINE.caraGold);
  expect(r.bobHand, "spy drew a card per matching card; purposes " + r.purposes).toBe(PRISTINE.bobHand);
});

test("D13-9 a threatened Thief resolves its threat before it names its victim", () => {
  const r = threatFold("thief", "v13-d9");
  assertAbilityWaited(r, "thief", "named the character it robs");
  const robbedAfter = partsOf(r).indexOf("thief-rob") > partsOf(r).indexOf("blackmailer-threat");
  expect(robbedAfter, "the robbery was decided before the threat; purposes " + r.purposes).toBe(false);
});

test("D13-10 a threatened Artist resolves its threat before it beautifies", () => {
  const r = threatFold("artist", "v13-d10");
  assertAbilityWaited(r, "artist", "marked one of its districts");
  expect(r.bobGold, "artist spent a gold from its stash; purposes " + r.purposes).toBe(PRISTINE.bobGold);
});

test("D13-11 a threatened Tax Collector resolves its threat before it takes the token", () => {
  const r = threatFold("tax-collector", "v13-d11");
  assertAbilityWaited(r, "tax-collector", "emptied the 4-gold tax token");
  expect(r.bobGold, "tax-collector took the token's " + 4 + " gold; purposes " + r.purposes).toBe(PRISTINE.bobGold);
});

/* Positive probes: the threats that DID hold. A regression that reintroduces a
   build or an ability ahead of the threat turns one of these red. */
test("P1 an innocent threatened character gathers only before its threat", () => {
  for (const [character, entropy] of [
    ["king", "v13-p1-king"],
    ["merchant", "v13-p1-merchant"],
    ["bishop", "v13-p1-bishop"],
    ["patrician", "v13-p1-patrician"],
    ["queen", "v13-p1-queen"],
    ["navigator", "v13-p1-navigator"],
  ] as const) {
    const r = threatFold(character, entropy);
    expect(r.threatIdx, character + " reachable by a threat window").toBeGreaterThanOrEqual(0);
    expect(r.bobCity, character + " built before its threat; purposes " + r.purposes).toEqual(PRISTINE.bobCity);
    expect(r.caraCity, character + " changed a rival; purposes " + r.purposes).toEqual(PRISTINE.caraCity);
    expect(r.markers, character + " marked a district; purposes " + r.purposes).toEqual(PRISTINE.bobMarkers);
  }
});

test("P2 the refused threat still defers the build until the marker is spent", () => {
  for (const [character, entropy] of [
    ["king", "v13-p2-king"],
    ["architect", "v13-p2-architect"],
    ["scholar", "v13-p2-scholar"],
    ["trader", "v13-p2-trader"],
    ["alchemist", "v13-p2-alchemist"],
  ] as const) {
    const r = threatFold(character, entropy);
    const threatAt = r.purposes.indexOf("blackmailer-threat");
    const buildsAfter = r.finalBobCity.length;
    expect(threatAt, character + " folds a threat window").toBeGreaterThanOrEqual(0);
    expect(
      r.bobCity,
      character + " built before the threat resolved; purposes " + r.purposes,
    ).toEqual(PRISTINE.bobCity);
    expect(buildsAfter, character + " lost its build to the marker; purposes " + r.purposes).toBeGreaterThan(1);
  }
});

test("P3 a threatened Seat with a Museum places nothing before the threat", () => {
  for (const [character, entropy] of [
    ["king", "v13-p3-king"],
    ["architect", "v13-p3-architect"],
    ["scholar", "v13-p3-scholar"],
    ["warlord", "v13-p3-warlord"],
    ["trader", "v13-p3-trader"],
  ] as const) {
    const r = threatFold(character, entropy);
    const parts = partsOf(r);
    const threatAt = parts.indexOf("blackmailer-threat");
    const keepAt = parts.indexOf("keep");
    expect(keepAt, character + " opens its Museum offer; purposes " + r.purposes).toBeGreaterThanOrEqual(0);
    expect(threatAt < keepAt, character + " placed before the threat; purposes " + r.purposes).toBe(true);
    expect(
      r.markers.reduce((n, g) => n + g, 0),
      character + " tucked a card under its Museum; purposes " + r.purposes,
    ).toBe(0);
  }
});
