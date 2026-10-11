import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  advance,
  castWith,
  openPurpose,
  rawGenesis,
  rawGold,
  rawPlayer,
  type CitadelsAction,
  type CitadelsState,
  type SeatId,
} from "./driver.ts";
import { specOfCharacter, type CharacterId } from "../../../lockstep/games/citadels/characters.ts";
import { specOfDistrict, type DistrictId } from "../../../lockstep/games/citadels/districts.ts";
import type { Claim } from "../../../lockstep/games/citadels/state.ts";

/**
 * Ninth-pass verifier artifacts. Two counterexamples that fail against the head
 * under review, plus positive probes a regression of the held clauses would
 * break. These are counterexamples, not fixes.
 *
 * Both defects live in the Museum's once-per-turn placement offer (helpers.ts
 * withMuseumOffer / resolveKeep), the clause the sixth-pass turn-model rewrite
 * (gather-then-build, D6-2) reshaped. The offer rides a `keep` window and tells
 * it apart from the gather keep by a *bare* pending; two turn shapes break that
 * contract:
 *
 *   D9-1  The Alchemist's two-pass settle (V2-7) deliberately leaves a NON-null
 *         pending (its build spend) standing when the turn closes. The Museum's
 *         offer then opens a `keep` window on top of that pending, and
 *         resolveKeep routes it to the gather-keep branch: the Alchemist's spend
 *         pending is overwritten with the turn-gathered marker, so the refund
 *         never lands AND the card is never tucked.
 *
 *   D9-2  The Navigator's turn returns early from resolveTurn (its gain choice,
 *         no build) without ever reaching closeTurn/withMuseumOffer, so its
 *         Museum never opens a placement window on its own turn at all.
 */

const sorted = (pairs: readonly (readonly [SeatId, CharacterId])[]): readonly Claim[] =>
  [...pairs]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

const museumOf = (state: CitadelsState, seat: SeatId) =>
  rawPlayer(state, seat).city.find((district) => district.id === "museum");

/** The first affordable, non-duplicate hand card, or null when none builds. */
const buildable = (state: CitadelsState, seat: SeatId): number | null => {
  const me = rawPlayer(state, seat);
  const inCity = new Set(me.city.map((district) => district.id));
  const index = me.hand.findIndex(
    (id) => !inCity.has(id) && specOfDistrict(id).cost <= me.gold,
  );
  return index >= 0 ? index : null;
};

/**
 * Fold one ANN turn where ANN holds `character`, her city is `city`, over a
 * real deal. The turn builds the first affordable non-duplicate card and tucks a
 * card under the Museum whenever the engine offers the placement window.
 */
const foldTurn = (
  character: CharacterId,
  city: readonly DistrictId[],
  gold: number,
  hand: readonly DistrictId[],
  entropy: string,
): CitadelsState => {
  const rank = specOfCharacter(character).rank;
  const base = rawGenesis(SEATS3, castWith(character), entropy);
  const seeded: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: sorted([[ANN, character], [BOB, "king"], [CARA, "warlord"]]),
    callRank: rank,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN
        ? { ...player, gold, hand: [...hand], city: city.map((id) => ({ id, gold: 0 })) }
        : player,
    ),
  };
  let cur = seeded;
  for (let i = 0; i < 80 && cur.phase === "turn" && cur.active === ANN; i += 1) {
    cur = advance(cur, (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn" && seat === ANN) {
        const index = buildable(state, ANN);
        return index === null ? { t: "gold" } : { t: "build", card: index };
      }
      if (purpose === "keep") return { t: "keep", index: 0 };
      if (purpose === "tax-collect") return { t: "pass" };
      return null;
    });
  }
  return cur;
};

// ---------------------------------------------------------------------------
// D9-1: the Alchemist's build-spend pending collides with the Museum's keep
// offer, losing both the refund and the tuck.
// ---------------------------------------------------------------------------

test("D9-1 an Alchemist that builds still gets its refund and its Museum tuck", () => {
  // Control: same Alchemist turn, no Museum. The turn gathers 2, builds a cost-1
  // Market (gold 2 -> 1), and the V2-7 settle refunds the 1: gold ends at 2.
  const control = foldTurn("alchemist", [], 0, ["market"], "v9-d9-1-control");
  expect(
    rawGold(control, ANN),
    "the Alchemist refund lands with no Museum (the V2-7 clause holds)",
  ).toBe(2);

  // With a Museum, the same turn must end at the same gold (the Museum changes no
  // gold) AND the tuck must happen.
  const withMuseum = foldTurn("alchemist", ["museum"], 0, ["market", "tavern"], "v9-d9-1-museum");
  expect(
    rawGold(withMuseum, ANN),
    "the Museum's keep offer stole the Alchemist's spend pending: refund lost (measured 0, expected 2)",
  ).toBe(2);
  expect(
    museumOf(withMuseum, ANN)?.cards?.length ?? 0,
    "the Museum's placement offer was misrouted to the gather keep and never tucked",
  ).toBe(1);
});

// ---------------------------------------------------------------------------
// D9-2: the Navigator's turn never opens the Museum placement offer.
// ---------------------------------------------------------------------------

test("D9-2 a Navigator owning a Museum is offered its once-per-turn placement", () => {
  const base = rawGenesis(SEATS3, castWith("navigator"), "v9-d9-2");
  const seeded: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: sorted([[ANN, "navigator"], [BOB, "king"], [CARA, "warlord"]]),
    callRank: 7,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN
        ? {
            ...player,
            gold: 0,
            hand: ["market", "tavern"] as DistrictId[],
            city: [{ id: "museum" as DistrictId, gold: 0 }],
          }
        : player,
    ),
  };
  let cur = seeded;
  let sawKeep = false;
  for (let i = 0; i < 30 && cur.phase === "turn"; i += 1) {
    if (openPurpose(cur) === "keep") sawKeep = true;
    cur = advance(cur, (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn" && seat === ANN) return { t: "gold" };
      if (purpose === "keep") return { t: "keep", index: 0 };
      return null;
    });
  }
  expect(
    sawKeep,
    "the Navigator's turn never reached the Museum's placement offer (no keep window opened)",
  ).toBe(true);
  expect(
    museumOf(cur, ANN)?.cards?.length ?? 0,
    "the Navigator tucked a card under its Museum",
  ).toBe(1);
});

// ---------------------------------------------------------------------------
// Positive probes: pin the held clauses so a regression reddens this file too.
// ---------------------------------------------------------------------------

test("P1 the Alchemist refund holds without a Museum (V2-7)", () => {
  const built = foldTurn("alchemist", [], 3, ["castle"], "v9-p1");
  // Gather 2 (3 -> 5), build the cost-4 Castle (5 -> 1), refund the 4 (1 -> 5).
  expect(rawGold(built, ANN), "the Alchemist is refunded the Castle's 4 gold").toBe(5);
});

test("P2 a King owning a Museum still tucks (the offer's ordinary path)", () => {
  const tucked = foldTurn("king", ["museum"], 0, ["market", "tavern"], "v9-p2");
  expect(
    museumOf(tucked, ANN)?.cards?.length ?? 0,
    "the King's Museum placement offer still fires and tucks one card",
  ).toBe(1);
});

test("P3 a two-character seat's second-claim Architect still gets limit three", () => {
  // ANN holds [assassin, architect]; the rank cursor calls the architect (second
  // claim). The D7-2 clause must read the acting character, not the first claim.
  const base = rawGenesis(SEATS3, castWith("architect"), "v9-p3");
  const seeded: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: sorted([[ANN, "assassin"], [ANN, "architect"], [BOB, "king"], [CARA, "warlord"]]),
    callRank: 7,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN
        ? { ...player, gold: 10, hand: ["tavern", "market", "docks"] as DistrictId[], city: [] }
        : player,
    ),
  };
  let cur = seeded;
  for (let i = 0; i < 40 && cur.phase === "turn" && cur.active === ANN; i += 1) {
    cur = advance(cur, (seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "turn" && seat === ANN) {
        const index = buildable(state, ANN);
        return index === null ? { t: "gold" } : { t: "build", card: index };
      }
      return null;
    });
  }
  expect(
    rawPlayer(cur, ANN).city.length,
    "the second-claim Architect builds three districts (D7-2 holds)",
  ).toBe(3);
});
