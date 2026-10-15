import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  type CitadelsState,
  type SeatId,
} from "../../driver.ts";
import {
  charactersOfRank,
  specOfCharacter,
  type CharacterId,
  type Rank,
} from "../../../../../lockstep/games/citadels/characters.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";

/**
 * Tenth-pass verifier artifacts. Counterexamples that fail against the head
 * under review, plus positive probes a regression of the held clauses would
 * break. These are counterexamples, not fixes.
 *
 * All three defects live in the Blackmailer's threat seam that the tenth pass
 * re-opened: when a threatened seat REFUSES, the reveal window
 * (`blackmailer-resolve`) clears the pending and the stack continues into the
 * SECOND turn window the threat was spliced above. `resolveTurn` then sees a
 * bare pending and treats that window as a gather window:
 *
 *   D10-1  A threatened seat that refuses gathers a second time. rules.json
 *          (blackmailer): "When a threatened player is called, they must gather
 *          resources, then resolve the threat." One gather. Measured: a King
 *          with 0 gold ends the refused turn at 4 (two gathers of 2), where the
 *          bribe path and an unthreatened turn both end at 2.
 *
 *   D10-2  A threatened Navigator that refuses loses its four gold or four
 *          cards entirely: the reveal window clears the pending before the
 *          Navigator's resolve step reads its gain choice. rules.json
 *          (navigator): "Gain either four gold or four cards." Measured: refused
 *          Navigator ends at 0 gold / 0 cards, where an unthreatened one ends at
 *          4 gold / 4 cards.
 *
 *   D10-3  A threatened Navigator resolves the threat BEFORE it gains, so the
 *          bribe is computed on the pre-gain purse. The threat window is spliced
 *          directly below the Navigator's turn window, but the Navigator's gain
 *          rides the resolve step BELOW the threat. Measured: the Navigator
 *          bribes 0 of its post-gain 4 (gold 4, Blackmailer 2), where the rule
 *          ("gather resources, then resolve the threat") wants half of 4 = 2
 *          (gold 2, Blackmailer 4). An ordinary character with the same 0 gold
 *          gathers 2 first and bribes 1 (King: gold 1, Blackmailer 3).
 */

const claimedOf = (pairs: readonly (readonly [SeatId, CharacterId])[]) =>
  [...pairs]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

/** A legal cast with the Blackmailer at rank 2 and `target` at its own rank. */
const castWithBlackmailer = (target: CharacterId): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    const at = charactersOfRank(rank as Rank);
    cast.push(
      (rank === 2
        ? "blackmailer"
        : specOfCharacter(target).rank === rank
          ? target
          : at[0]) as CharacterId,
    );
  }
  return cast;
};

/**
 * Fold BOB's threatened turn over a real deal. ANN owns the Blackmailer, BOB
 * holds `threatened` (or is unthreatened when `choice` is "none"), and BOB
 * answers the threat with `choice` (the Blackmailer answers the reveal window
 * with "no"). The turn window is answered with `turn`.
 */
const foldThreat = (opts: {
  readonly threatened: CharacterId;
  readonly gold: number;
  readonly hand: readonly DistrictId[];
  readonly city: readonly DistrictId[];
  readonly choice: "bribe" | "refuse" | "none";
  readonly turn: "gold" | "draw";
  readonly entropy: string;
  readonly guard?: number;
}): CitadelsState => {
  const base = rawGenesis(SEATS3, castWithBlackmailer(opts.threatened), opts.entropy);
  let cur: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claimedOf([[ANN, "blackmailer"], [BOB, opts.threatened], [CARA, "warlord"]]),
    callRank: specOfCharacter(opts.threatened).rank,
    active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    threats: opts.choice === "none" ? [] : [opts.threatened],
    builtThisTurn: 0,
    players: base.players.map((p) =>
      p.seat === BOB
        ? {
            ...p,
            gold: opts.gold,
            hand: [...opts.hand],
            city: opts.city.map((id) => ({ id, gold: 0 })),
          }
        : p,
    ),
  };
  for (let i = 0; i < (opts.guard ?? 30) && cur.phase === "turn" && cur.active === BOB; i += 1) {
    cur = advance(cur, (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn" && seat === BOB) {
        return opts.turn === "draw" ? { t: "draw" } : { t: "gold" };
      }
      if (purpose === "keep" && seat === BOB) return { t: "keep", index: 0 };
      if (purpose === "blackmailer-threat") return { t: "choose", value: opts.choice };
      if (purpose === "blackmailer-resolve") return { t: "choose", value: "no" };
      if (purpose === "tax-collect") return { t: "pass" };
      return null;
    });
  }
  return cur;
};

// ---------------------------------------------------------------------------
// D10-1: a threatened seat that refuses the threat gathers a second time.
// ---------------------------------------------------------------------------

test("D10-1 a threatened seat that refuses the threat gathers once, not twice", () => {
  // Controls: an unthreatened King turn gathers 2; a threatened King that bribes
  // gathers 2 and pays half rounded down (1) to the Blackmailer, ending at 1. One
  // gather either way.
  const plain = foldThreat({
    threatened: "king",
    gold: 0,
    hand: [],
    city: [],
    choice: "none",
    turn: "gold",
    entropy: "v10-d10-1-plain",
  });
  expect(rawGold(plain, BOB), "an unthreatened turn gathers 2 gold").toBe(2);

  const bribed = foldThreat({
    threatened: "king",
    gold: 0,
    hand: [],
    city: [],
    choice: "bribe",
    turn: "gold",
    entropy: "v10-d10-1-bribe",
  });
  expect(rawGold(bribed, BOB), "the bribe path gathers once (2, then half=1 crosses)").toBe(1);

  // Refusing must not gather a second time: the threat resolves on the post-gather
  // gold, then the turn takes its build window with no further gather. Measured on
  // this head: the refused seat re-enters the turn window with a bare pending and
  // gathers again, ending at 4.
  const refused = foldThreat({
    threatened: "king",
    gold: 0,
    hand: [],
    city: [],
    choice: "refuse",
    turn: "gold",
    entropy: "v10-d10-1-refuse",
  });
  expect(
    rawGold(refused, BOB),
    "the refused seat gathered twice: measured 4, expected 2 (one gather)",
  ).toBe(2);
});

// ---------------------------------------------------------------------------
// D10-2: a threatened Navigator that refuses loses its four gold / four cards.
// ---------------------------------------------------------------------------

test("D10-2 a threatened Navigator that refuses still gains its four gold", () => {
  const plain = foldThreat({
    threatened: "navigator",
    gold: 0,
    hand: [],
    city: [],
    choice: "none",
    turn: "gold",
    entropy: "v10-d10-2-plain",
  });
  expect(rawGold(plain, BOB), "an unthreatened Navigator gains its four gold").toBe(4);

  const refused = foldThreat({
    threatened: "navigator",
    gold: 0,
    hand: [],
    city: [],
    choice: "refuse",
    turn: "gold",
    entropy: "v10-d10-2-refuse",
  });
  expect(
    rawGold(refused, BOB),
    "the refused Navigator never gained its four gold: measured 0, expected 4",
  ).toBe(4);

  const refusedCards = foldThreat({
    threatened: "navigator",
    gold: 0,
    hand: [],
    city: [],
    choice: "refuse",
    turn: "draw",
    entropy: "v10-d10-2-refuse-draw",
  });
  expect(
    rawPlayer(refusedCards, BOB).hand.length,
    "the refused Navigator never drew its four cards: measured 0, expected 4",
  ).toBe(4);
});

// ---------------------------------------------------------------------------
// D10-3: a threatened Navigator resolves the threat before it gains.
// ---------------------------------------------------------------------------

test("D10-3 a threatened Navigator gains before it resolves the threat", () => {
  // An ordinary character gathers first: the King gathers 2 (0 -> 2), then bribes
  // half rounded down (1). Blackmailer 2 -> 3, King 0 -> 1.
  const king = foldThreat({
    threatened: "king",
    gold: 0,
    hand: [],
    city: [],
    choice: "bribe",
    turn: "gold",
    entropy: "v10-d10-3-king",
  });
  expect(rawGold(king, BOB), "the King gathered then bribed half of 2").toBe(1);
  expect(rawGold(king, ANN), "the Blackmailer took the King's half").toBe(3);

  // The Navigator must gain its four gold before the threat resolves, so the
  // bribe is half of 4 = 2: Navigator 4 -> 2, Blackmailer 2 -> 4. Measured on this
  // head: the threat resolves before the gain, so the Navigator bribes 0 and keeps
  // all 4.
  const nav = foldThreat({
    threatened: "navigator",
    gold: 0,
    hand: [],
    city: [],
    choice: "bribe",
    turn: "gold",
    entropy: "v10-d10-3-nav",
  });
  expect(
    rawGold(nav, BOB),
    "the Navigator bribed from the pre-gain purse (0): measured 4, expected 2",
  ).toBe(2);
  expect(
    rawGold(nav, ANN),
    "the Blackmailer never saw the Navigator's gain: measured 2, expected 4",
  ).toBe(4);
});

// ---------------------------------------------------------------------------
// Positive probes: pin the held clauses so a regression reddens this file too.
// ---------------------------------------------------------------------------

test("P1 an unthreatened turn gathers exactly once", () => {
  const base = rawGenesis(SEATS3, castWithBlackmailer("king"), "v10-p1");
  let cur: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claimedOf([[ANN, "blackmailer"], [BOB, "king"], [CARA, "warlord"]]),
    callRank: 4,
    active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((p) => (p.seat === BOB ? { ...p, gold: 0, hand: [], city: [] } : p)),
  };
  for (let i = 0; i < 20 && cur.phase === "turn" && cur.active === BOB; i += 1) {
    cur = advance(cur, (seat, state) =>
      openPurpose(state) === "turn" && seat === BOB ? { t: "gold" } : null,
    );
  }
  expect(rawGold(cur, BOB), "an ordinary turn gathers 2 gold exactly once").toBe(2);
});

test("P2 a threatened seat that bribes still builds after the threat (D5-5 holds)", () => {
  const base = rawGenesis(SEATS3, castWithBlackmailer("king"), "v10-p2");
  let cur: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: claimedOf([[ANN, "blackmailer"], [BOB, "king"], [CARA, "warlord"]]),
    callRank: 4,
    active: BOB,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    threats: ["king"],
    builtThisTurn: 0,
    players: base.players.map((p) =>
      p.seat === BOB ? { ...p, gold: 4, hand: ["market"] as DistrictId[], city: [] } : p,
    ),
  };
  let districtStoodWhileThreatOpen = false;
  for (let i = 0; i < 30 && cur.phase === "turn" && cur.active === BOB; i += 1) {
    cur = advance(cur, (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn" && seat === BOB) {
        const me = rawPlayer(state, BOB);
        const at = me.hand.indexOf("market");
        return at >= 0 ? { t: "build", card: at } : { t: "gold" };
      }
      if (purpose === "blackmailer-threat") return { t: "choose", value: "bribe" };
      if (purpose === "tax-collect") return { t: "pass" };
      return null;
    });
    if (openPurpose(cur) === "blackmailer-threat" && rawPlayer(cur, BOB).city.length > 0) {
      districtStoodWhileThreatOpen = true;
    }
  }
  expect(
    districtStoodWhileThreatOpen,
    "no district stood in the city while the threat was open",
  ).toBe(false);
  expect(
    rawPlayer(cur, BOB).city.map((d) => d.id),
    "the threatened build landed after the threat resolved",
  ).toContain("market");
});

test("P3 a Museum-owning threatened seat still tucks once on its bribe path", () => {
  const tucked = foldThreat({
    threatened: "king",
    gold: 0,
    hand: ["market", "tavern"],
    city: ["museum"],
    choice: "bribe",
    turn: "gold",
    entropy: "v10-p3",
  });
  const museum = rawPlayer(tucked, BOB).city.find((d) => d.id === "museum");
  expect(museum?.cards?.length ?? 0, "the Museum's placement offer still tucks one card").toBe(1);
});
