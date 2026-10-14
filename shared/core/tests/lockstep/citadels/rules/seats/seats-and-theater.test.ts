import { expect, test } from "vitest";
import { ANN, BOB, CARA, SEATS3, advance, openPurpose, rawGenesis, rawGold, rawPlayer, rawRandom, type CitadelsAction, type CitadelsState, type SeatId } from "../../driver.ts";
import { seatId } from "../../../../../index.ts";
import { autoAction, framesToEnd, replayFrames, sealedFrames, tableOf } from "../../driver.ts";
import { at } from "../../../harness.ts";
import { stateCodec } from "../../../../../lockstep/games/citadels/state.ts";
import { citadels } from "../../../../../lockstep/games/citadels/index.ts";
import { charactersOfRank, specOfCharacter, type CharacterId, type Rank } from "../../../../../lockstep/games/citadels/characters.ts";
import { theaterResolve } from "../../../../../lockstep/games/citadels/districts/theater.ts";
import type { DistrictId } from "../../../../../lockstep/games/citadels/districts.ts";
import type { Claim, Step } from "../../../../../lockstep/games/citadels/state.ts";

/**
 * Eighth-pass verifier artifacts. Two counterexamples that fail against the head
 * under review, plus positive probes that a regression of the seventh-pass fix
 * would break. These are counterexamples, not fixes.
 *
 * Both defects live in the two-character dimension the seventh pass opened: a
 * seat drafts two characters in a 2- or 3-player game, and the Witch plays a
 * second, resumed turn. The seventh pass keyed seven per-character clauses on the
 * acting character but left the Witch resume path and the Theater's own
 * two-character clause untouched.
 */

/** A legal cast with per-rank overrides, one character per rank 1-8 (plus rank 9). */
const castFor = (overrides: Readonly<Record<number, CharacterId>>): readonly CharacterId[] => {
  const cast: CharacterId[] = [];
  for (let rank = 1; rank <= 8; rank += 1) {
    cast.push(overrides[rank] ?? (charactersOfRank(rank as Rank)[0] as CharacterId));
  }
  if (overrides[9] !== undefined) cast.push(overrides[9]);
  return cast;
};

const seatOf = (name: string): SeatId => seatId(name);

const castOf = (): readonly CharacterId[] => [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

const sortedClaims = (claims: readonly (readonly [SeatId, CharacterId])[]): readonly Claim[] =>
  [...claims]
    .sort((a, b) => specOfCharacter(a[1]).rank - specOfCharacter(b[1]).rank)
    .map(([seat, character]) => ({ seat, character }));

const schoolOf = (state: CitadelsState, seat: SeatId) =>
  rawPlayer(state, seat).city.find((district) => district.id === "school-of-magic");

// ---------------------------------------------------------------------------
// D8-1: the Witch's resumed turn never declares her School of Magic.
//
// The D7-6 fix keyed districts/school-of-magic.ts incomeTypeOf on the acting
// character, but the card is still declared by declareSchoolOfMagic, which only
// applyCall runs when an ordinary character turn opens. The Witch's resume
// (characters/witch.ts witchResolve -> resumeStack) pushes a resolve step above
// the turn window and never calls declareSchoolOfMagic, so the bewitched
// character's income runs with the School of Magic undeclared: the card keeps its
// catalog type (unique) and the income misses it. rules.json (witch): "you use
// that character's abilities ... with YOUR hand, YOUR gold, and YOUR city."
// ---------------------------------------------------------------------------

/** Fold a Witch turn that bewitches `name` and answers every window safely. */
const witchResume = (name: CharacterId, entropy: string): CitadelsState => {
  const base = rawGenesis(SEATS3, castFor({ 1: "witch", 5: "bishop" }), entropy);
  const armed: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: sortedClaims([[ANN, "witch"], [BOB, "bishop"], [CARA, "warlord"]]),
    callRank: 1,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN
        ? {
            ...player,
            gold: 0,
            hand: ["tavern"] as DistrictId[],
            city: [{ id: "school-of-magic" as DistrictId, gold: 0 }],
          }
        : player,
    ),
  };
  let cur = armed;
  for (let i = 0; i < 300 && cur.phase !== "draft"; i += 1) {
    cur = advance(cur, (_seat, state) => {
      const purpose = openPurpose(state);
      if (purpose === "choose-character") return { t: "name-character", character: name };
      if (purpose === "witch-takeover" || purpose === "witch-resume") return { t: "pass" };
      if (purpose === "turn") return { t: "gold" };
      return null;
    });
  }
  return cur;
};

test("D8-1 the Witch resuming as a bewitched Bishop declares her School of Magic", () => {
  const end = witchResume("bishop", "v8-d8-1");
  expect(
    schoolOf(end, ANN)?.declaredType,
    "the School of Magic was never declared on the Witch's resumed turn (measured undefined)",
  ).toBe("religious");
  // The Witch gathers +2 on her held turn; the Bishop income (played by the Witch
  // with her own city) is 1 per religious district. The School of Magic counts as
  // religious, so the purse ends at 3. Undeclared, the card is unique and the
  // income misses it: the purse ends at 2 (measured).
  expect(rawGold(end, ANN), "the Bishop income missed the Witch's School of Magic").toBe(3);
});

// ---------------------------------------------------------------------------
// D8-2: a 2-3 player Theater ignores the owner's choice of which character to
// give. rules.json (theatre): "In 2-3 player games you choose which of your two
// characters to give and randomly take one of your opponent's." The resolver
// (districts/theater.ts theaterResolve) always gives the owner's lowest-rank
// claim and reads no give-choice from the action, so a seat holding two
// characters cannot hand over the higher-rank one.
// ---------------------------------------------------------------------------

const SWAP_WINDOW: Step = {
  kind: "window",
  window: { kind: "oneOf", purpose: "theatre-swap", seats: [ANN] },
};

/** ANN holds assassin (rank 1) and merchant (rank 6); BOB holds king and bishop. */
const twoEachState = (): CitadelsState => ({
  ...rawGenesis(SEATS3, ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"], "v8-d8-2"),
  phase: "turn",
  draft: null,
  claimed: sortedClaims([
    [ANN, "assassin"],
    [ANN, "merchant"],
    [BOB, "king"],
    [BOB, "bishop"],
    [CARA, "warlord"],
    [CARA, "architect"],
  ]),
  callRank: 1,
  active: ANN,
  steps: [SWAP_WINDOW, { kind: "call" }, { kind: "end-round" }],
});

const swap = (action: CitadelsAction): CitadelsState =>
  theaterResolve({
    state: twoEachState(),
    window: SWAP_WINDOW.kind === "window" ? SWAP_WINDOW.window : (undefined as never),
    frame: {
      index: 0 as never,
      seed: "0000000000000000" as never,
      inputs: [[ANN, { kind: "act", action }]] as never,
    },
    rng: rawRandom(),
  });

test("D8-2 a 2-3 player Theater lets its owner give its higher-rank character", () => {
  const gaveHigher = swap({ t: "keep", index: 1 });
  const annAfter = gaveHigher.claimed
    .filter((claim) => claim.seat === ANN)
    .map((claim) => claim.character);
  expect(
    annAfter,
    "the owner could not give its higher-rank claim: the Theater always gives the lowest",
  ).not.toContain("merchant");
  expect(annAfter, "the owner keeps its lowest-rank claim").toContain("assassin");
});

// ---------------------------------------------------------------------------
// Positive probes. These pass on the head under review; they pin the
// seventh-pass acting-character fix so a regression of it turns this file red in
// a second place.
// ---------------------------------------------------------------------------

test("P1 a second-character Bishop still declares and counts its School of Magic (D7-6 holds)", () => {
  const base = rawGenesis(SEATS3, castFor({ 5: "bishop" }), "v8-p1-soc");
  const second: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    claimed: sortedClaims([
      [ANN, "king"],
      [ANN, "bishop"],
      [BOB, "merchant"],
      [CARA, "warlord"],
    ]),
    callRank: 5,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    pending: null,
    builtThisTurn: 0,
    players: base.players.map((player) =>
      player.seat === ANN
        ? { ...player, gold: 0, hand: [] as DistrictId[], city: [{ id: "school-of-magic" as DistrictId, gold: 0 }] }
        : player,
    ),
  };
  let end = second;
  for (let i = 0; i < 120; i += 1) {
    if (end.phase !== "turn" || end.active !== ANN) break;
    end = advance(end, (_seat, state) => (openPurpose(state) === "turn" ? { t: "gold" } : null));
  }
  expect(
    schoolOf(end, ANN)?.declaredType,
    "the second-character Bishop declares the School of Magic religious (D7-6 holds)",
  ).toBe("religious");
  expect(rawGold(end, ANN), "the Bishop income counted the school").toBe(3);
});

test("P2 a 2-seat and a 7-seat game fold to terminal and conserve cards", () => {
  const two: readonly SeatId[] = [ANN, BOB];
  const seven: readonly SeatId[] = [ANN, BOB, CARA, seatOf("dan"), seatOf("eve"), seatOf("finn"), seatOf("gil")];
  const foldSeats = (seats: readonly SeatId[], entropy: string): CitadelsState => {
    let cur = rawGenesis(seats, castOf(), entropy);
    for (let i = 0; i < 80000 && !citadels.isTerminal(cur); i += 1) {
      cur = advance(cur, (seat, state) => autoAction(seat, citadels.project(state, seat)));
    }
    return cur;
  };
  const cards = (state: CitadelsState): number =>
    state.players.reduce(
      (n, p) => n + p.hand.length + p.city.length + p.city.reduce((m, d) => m + (d.cards?.length ?? 0), 0),
      0,
    ) +
    state.deck.length +
    state.discard.length +
    (state.pending?.cards.length ?? 0);
  const twoEnd = foldSeats(two, "v8-p2-two");
  expect(twoEnd.phase, "the 2-seat game reaches terminal").toBe("over");
  expect(cards(twoEnd), "the 2-seat deck is conserved").toBe(68);
  const sevenEnd = foldSeats(seven, "v8-p2-seven");
  expect(sevenEnd.phase, "the 7-seat game reaches terminal").toBe("over");
  expect(cards(sevenEnd), "the 7-seat deck is conserved").toBe(68);
});

test("P3 a 2-seat and a 7-seat game converge and redact", { timeout: 60000 }, () => {
  const two: readonly SeatId[] = [ANN, BOB];
  const seven: readonly SeatId[] = [ANN, BOB, CARA, seatOf("dan"), seatOf("eve"), seatOf("finn"), seatOf("gil")];
  for (const seats of [two, seven]) {
    const label = String(seats.length);
    const a = tableOf(seats, castOf(), "v8-p3-" + label);
    framesToEnd(a, autoAction, 40000);
    expect(at(a, ANN).terminal, "terminal at " + label).toBe(true);
    const b = tableOf(seats, castOf(), "v8-p3-" + label);
    replayFrames(b, sealedFrames(a));
    const sa = at(a, ANN).snapshot().state;
    const sb = at(b, ANN).snapshot().state;
    expect(stateCodec.encode(sb), "peers converge at " + label).toEqual(stateCodec.encode(sa));
    for (const seat of seats) {
      const view = citadels.project(sa, seat);
      expect(view.myHand, "own hand at " + label).toEqual([...rawPlayer(sa, seat).hand]);
      for (const p of view.players) {
        expect(Object.keys(p).sort(), "no hand on a player view").toEqual(["city", "gold", "handCount", "seat"]);
      }
    }
  }
});
