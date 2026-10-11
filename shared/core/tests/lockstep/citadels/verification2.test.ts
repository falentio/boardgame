import { expect, test } from "vitest";
import { citadels } from "../../../lockstep/games/citadels/index.ts";
import { applyCall } from "../../../lockstep/games/citadels/helpers.ts";
import type { CharacterId } from "../../../lockstep/games/citadels/characters.ts";
import {
  ANN,
  BASE_CAST_IDS,
  BOB,
  SEATS3,
  advance,
  autoAction,
  rawGenesis,
  rawGold,
  rawHand,
  type CitadelsAction,
  type CitadelsState,
} from "./driver.ts";

/**
 * Second-pass verifier counterexamples. Every test below fails against the head
 * under review and names one defect that survived the first fix wave (D1..D14).
 * See orchestrate/citadels/verification-2.md for the finding each one encodes.
 * These are not fixes.
 */

const withCity = (
  state: CitadelsState,
  seat: string,
  city: readonly { readonly id: string; readonly gold: number; readonly declaredType?: string }[],
): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, city } : p)),
});

const withHand = (state: CitadelsState, seat: string, hand: readonly string[]): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, hand } : p)),
});

const withGold = (state: CitadelsState, seat: string, gold: number): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, gold } : p)),
});

const openWindow = (state: CitadelsState): string | null => {
  const top = state.steps[0];
  return top !== undefined && top.kind === "window" ? top.window.purpose : null;
};

const RANK1: readonly CharacterId[] = [
  "assassin",
  "thief",
  "magician",
  "king",
  "bishop",
  "merchant",
  "architect",
  "warlord",
];

/** A turn-phase state whose rank cursor is armed at `callRank`. */
const turnPhase = (
  cast: readonly CharacterId[],
  character: CharacterId,
  callRank: number,
): CitadelsState => ({
  ...rawGenesis(SEATS3, cast),
  phase: "turn",
  draft: null,
  claimed: [{ seat: ANN, character }],
  callRank,
  active: ANN,
  steps: [{ kind: "call" }, { kind: "end-round" }],
});

/** Call the character and drain its resolve step, landing on the first effect window. */
const callAndDrain = (
  cast: readonly CharacterId[],
  character: CharacterId,
  rank: number,
): CitadelsState => advance(applyCall(turnPhase(cast, character, rank)), () => null);

// ---------------------------------------------------------------------------
// V2-1 (blocking): the D1 fix runs each character's effect, but every effect
// that opens an "any" window with an empty `seats` list has that window silently
// dropped by `drain` in windows.ts. `drain` asks `owedFor` (which filters the
// explicit seats list, empty here) instead of `windowOwed` (which expands "any"
// to the live seats), so it pops the naming window before anyone can answer it.
// The naming sub-machine stays dead through a real folded game: no kill, no rob,
// no bewitch, no warrant, no peek. The first pass's D1 counterexample missed this
// because the Magician and Warlord open named-seat windows that do surface.
// ---------------------------------------------------------------------------

test("a folded game that names characters records at least one kill, rob, or bewitch", () => {
  let state = rawGenesis(SEATS3, BASE_CAST_IDS, "v2-naming-fold");
  const namingPolicy = (seat: string, s: CitadelsState): CitadelsAction | null => {
    const view = citadels.project(s, seat);
    const w = view.window;
    if (w === null) return null;
    if (w.purpose === "choose-character") {
      const target = view.cast.find((id) => id !== "assassin");
      return target === undefined ? null : { t: "name-character", character: target };
    }
    // A policy that only takes gold never completes a city, so the fold never
    // reaches terminal: it must build.
    return autoAction(seat, view);
  };
  let frames = 0;
  let everNamed = false;
  while (!citadels.isTerminal(state) && frames < 40_000) {
    if (state.skipped.length > 0 || (state.robbed ?? null) !== null || (state.bewitched ?? null) !== null) {
      everNamed = true;
    }
    state = advance(state, (seat, s) => namingPolicy(seat, s));
    frames += 1;
  }
  expect(citadels.isTerminal(state)).toBe(true);
  expect(everNamed, "a naming character must record a kill, rob, or bewitch").toBe(true);
});

test("the Assassin's choose-character window surfaces through the engine", () => {
  const landed = callAndDrain(RANK1, "assassin", 1);
  expect(openWindow(landed)).toBe("choose-character");
  const named = advance(landed, (seat) =>
    seat === ANN ? { t: "name-character", character: "merchant" } : null,
  );
  expect(named.skipped).toContain("merchant");
});

test("the Witch's choose-character window surfaces through the engine", () => {
  const cast: readonly CharacterId[] = ["witch", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];
  const landed = callAndDrain(cast, "witch", 1);
  expect(openWindow(landed)).toBe("choose-character");
  const named = advance(landed, (seat) =>
    seat === ANN ? { t: "name-character", character: "merchant" } : null,
  );
  expect(named.bewitched).toBe("merchant");
});

test("the Magistrate's choose-character window surfaces through the engine", () => {
  const cast: readonly CharacterId[] = ["magistrate", "thief", "magician", "king", "bishop", "merchant", "architect", "warlord"];
  const landed = callAndDrain(cast, "magistrate", 1);
  expect(openWindow(landed)).toBe("choose-character");
  const named = advance(landed, (seat) =>
    seat === ANN ? { t: "name-character", character: "merchant" } : null,
  );
  expect(named.warrants?.length ?? 0).toBeGreaterThan(0);
});

test("the Thief's choose-character window surfaces through the engine", () => {
  const landed = callAndDrain(RANK1, "thief", 2);
  expect(openWindow(landed)).toBe("choose-character");
  const named = advance(landed, (seat) =>
    seat === ANN ? { t: "name-character", character: "merchant" } : null,
  );
  expect(named.robbed).toBe("merchant");
});

test("the Spy's choose-seat window surfaces through the engine", () => {
  const cast: readonly CharacterId[] = ["assassin", "spy", "magician", "king", "bishop", "merchant", "architect", "warlord"];
  const landed = callAndDrain(cast, "spy", 2);
  expect(openWindow(landed)).toBe("choose-seat");
});

// V2-2: the Blackmailer's first pass is guarded by `pending === null`, but
// applyCall arms pending with the character and a null note, so the effect reads
// its own arming as its final pass and assigns no threat markers.
test("the Blackmailer assigns threat markers through the engine", () => {
  const cast: readonly CharacterId[] = ["assassin", "blackmailer", "magician", "king", "bishop", "merchant", "architect", "warlord"];
  const landed = callAndDrain(cast, "blackmailer", 2);
  let s = landed;
  for (let i = 0; i < 6 && openWindow(s) === "blackmailer-resolve"; i += 1) {
    s = advance(s, (seat) => (seat === ANN ? { t: "name-character", character: "merchant" } : null));
  }
  expect(s.threats?.length ?? 0).toBeGreaterThan(0);
});

// ---------------------------------------------------------------------------
// V2-3: the turn continuation already carries one end-turn step and resolveTurn
// prepends a second, so every onEndTurn district hook fires twice per turn. The
// Laboratory and Smithy have no idempotence guard, so each runs its paid effect
// twice. (Pre-existing; the first pass missed it.)
// ---------------------------------------------------------------------------

test("an end-of-turn district fires once per turn, not twice", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v2-endturn");
  const state: CitadelsState = {
    ...withGold(withHand(withCity(base, ANN, [{ id: "laboratory", gold: 0 }]), ANN, ["tavern", "market", "docks"]), ANN, 0),
    phase: "turn",
    draft: null,
    claimed: [{ seat: ANN, character: "merchant" }],
    callRank: 6,
    active: ANN,
    steps: [{ kind: "call" }, { kind: "end-round" }],
  };
  let s = state;
  for (let i = 0; i < 8 && !citadels.isTerminal(s) && openWindow(s) !== "draft-pick"; i += 1) {
    const top = s.steps[0];
    const isTurn = top !== undefined && top.kind === "window" && top.window.purpose === "turn";
    s = advance(s, (seat) => (seat === ANN && isTurn ? { t: "gold" } : null));
  }
  // Merchant income (0 trade + 1) + gold gather (2) = 3 gold. One Laboratory
  // firing discards one card and adds two gold: gold 5, hand 2. A second firing
  // leaves gold 7 and hand 1.
  expect(rawGold(s, ANN)).toBe(5);
  expect(rawHand(s, ANN).length).toBe(2);
});

// ---------------------------------------------------------------------------
// V2-4: the Thieves' Den now builds with a mixed payment, but the gold share is
// never debited (tryBuild's card branch charges no gold whenever payCards > 0),
// so the builder keeps gold it should have spent. The district file itself names
// this gap in a comment.
// ---------------------------------------------------------------------------

test("a mixed Thieves' Den payment spends its gold share", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v2-den");
  const state: CitadelsState = withGold(
    withHand(
      {
        ...base,
        phase: "turn",
        draft: null,
        active: ANN,
        steps: [
          { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
          { kind: "end-round" },
        ],
      },
      ANN,
      ["thieves-den", "tavern", "market"],
    ),
    ANN,
    2,
  );
  const after = advance(state, (seat) => (seat === ANN ? { t: "build", card: 0 } : null));
  expect(after.players.find((p) => p.seat === ANN)?.city.map((d) => d.id)).toEqual(["thieves-den"]);
  expect(rawGold(after, ANN)).toBe(0);
});

// ---------------------------------------------------------------------------
// V2-5: the D9 fix updated eight income counters but missed the Trader and the
// Emperor, which still read the catalog type instead of the declared type.
// ---------------------------------------------------------------------------

test("the Trader counts a School of Magic declared trade", () => {
  const cast: readonly CharacterId[] = ["assassin", "thief", "magician", "king", "bishop", "trader", "architect", "warlord"];
  const state = withCity(turnPhase(cast, "trader", 6), ANN, [
    { id: "school-of-magic", gold: 0, declaredType: "trade" },
  ]);
  const after = advance(state, () => null);
  expect(rawGold(after, ANN)).toBe(rawGold(state, ANN) + 1);
});

test("the Emperor counts a School of Magic declared noble", () => {
  const cast: readonly CharacterId[] = ["assassin", "thief", "magician", "emperor", "bishop", "merchant", "architect", "warlord"];
  const state = withCity({ ...turnPhase(cast, "emperor", 4), crown: BOB }, ANN, [
    { id: "school-of-magic", gold: 0, declaredType: "noble" },
  ]);
  const after = advance(state, () => null);
  expect(rawGold(after, ANN)).toBe(rawGold(state, ANN) + 1);
});

// ---------------------------------------------------------------------------
// V2-6: the Diplomat's Great Wall toll is computed by greatWallExchangeToll but
// never consulted, so an exchange out of a Great Wall city underpays by one.
// ---------------------------------------------------------------------------

test("the Diplomat pays one extra gold to exchange a district out of a Great Wall city", () => {
  const cast: readonly CharacterId[] = ["assassin", "thief", "magician", "king", "bishop", "merchant", "architect", "diplomat"];
  const state: CitadelsState = withGold(
    withCity(
      withCity(
        {
          ...rawGenesis(SEATS3, cast, "v2-diplomat"),
          phase: "turn",
          draft: null,
          active: ANN,
          claimed: [{ seat: ANN, character: "diplomat" }],
          callRank: 8,
          steps: [{ kind: "call" }, { kind: "end-round" }],
        },
        ANN,
        [{ id: "tavern", gold: 0 }],
      ),
      BOB,
      [
        { id: "great-wall", gold: 0 },
        { id: "palace", gold: 0 },
      ],
    ),
    ANN,
    20,
  );
  let s = advance(state, () => null);
  s = advance(s, (seat) => (seat === ANN ? { t: "target", seat: BOB } : null));
  s = advance(s, (seat) => (seat === ANN ? { t: "keep", index: 1 } : null));
  s = advance(s, (seat) => (seat === ANN ? { t: "keep", index: 0 } : null));
  // Palace (5) for Tavern (1): base difference 4, Great Wall toll 1 => 5 paid.
  expect(s.players.find((p) => p.seat === ANN)?.city.map((d) => d.id)).toEqual(["palace"]);
  expect(rawGold(s, ANN)).toBe(15);
});

// ---------------------------------------------------------------------------
// V2-7: the Alchemist's refund reads `pending.gold`, but the build path never
// credits it (only the gather writes it), so the ability is dead through the
// engine.
// ---------------------------------------------------------------------------

test("the Alchemist takes back the gold it spent building this turn", () => {
  const cast: readonly CharacterId[] = ["assassin", "thief", "magician", "king", "bishop", "alchemist", "architect", "warlord"];
  const base = rawGenesis(SEATS3, cast, "v2-alchemist");
  const state: CitadelsState = withGold(
    withHand(
      {
        ...base,
        phase: "turn",
        draft: null,
        active: ANN,
        claimed: [{ seat: ANN, character: "alchemist" }],
        callRank: 6,
        steps: [{ kind: "call" }, { kind: "end-round" }],
      },
      ANN,
      ["castle", "tavern", "market", "docks", "harbor"],
    ),
    ANN,
    10,
  );
  let s = advance(state, () => null);
  const before = rawGold(s, ANN);
  for (let i = 0; i < 8 && !citadels.isTerminal(s) && openWindow(s) !== "draft-pick"; i += 1) {
    const top = s.steps[0];
    const isTurn = top !== undefined && top.kind === "window" && top.window.purpose === "turn";
    const me = s.players.find((p) => p.seat === ANN);
    const canBuild = (me?.city.length ?? 0) === 0;
    s = advance(s, (seat) => (seat === ANN && isTurn && canBuild ? { t: "build", card: 0 } : null));
  }
  // The turn gathers, then builds a Castle (cost 4): 10 + 2 (gather) - 4 (build)
  // = 8, and the Alchemist takes the 4 gold back, so it ends at before + 2 — the
  // gather alone. Without the refund it would end at 8 (before - 2).
  expect(s.players.find((p) => p.seat === ANN)?.city.map((d) => d.id)).toContain("castle");
  expect(rawGold(s, ANN)).toBe(before + 2);
});

// ---------------------------------------------------------------------------
// V2-8: the Armory's destroy ability is registered under the `onDestroy` hook,
// but runDistrictHooks is never called with `onDestroy`, so the Armory never
// opens its window in a real game. The district-windows test only hand-places the
// window, which is why it stays green.
// ---------------------------------------------------------------------------

test("a seat that built the Armory is offered its destroy window on its turn", () => {
  const uniques = [
    "armory", "keep", "laboratory", "smithy", "library", "school-of-magic",
    "dragon-gate", "observatory", "great-wall", "factory", "park", "museum",
    "capitol", "monument",
  ] as const;
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v2-armory", uniques);
  const state: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    active: ANN,
    claimed: [{ seat: ANN, character: "merchant" }],
    callRank: 6,
    steps: [{ kind: "call" }, { kind: "end-round" }],
    players: base.players.map((p) =>
      p.seat === ANN
        ? { ...p, city: [{ id: "armory", gold: 0 }] }
        : p.seat === BOB
          ? { ...p, city: [{ id: "tavern", gold: 0 }] }
          : p,
    ),
  };
  let s = state;
  const purposes: string[] = [];
  for (let i = 0; i < 8 && !citadels.isTerminal(s); i += 1) {
    purposes.push(openWindow(s) ?? "none");
    s = advance(s, (seat) => (seat === ANN ? { t: "gold" } : null));
  }
  expect(purposes).toContain("armory-destroy");
});

// ---------------------------------------------------------------------------
// V2-9: the Museum's placement offer coerces any non-idle report, including a
// `pass`, into placing the hand's first card. A player who declines still loses a
// card.
// ---------------------------------------------------------------------------

test("a pass on the Museum's placement offer places no card", () => {
  const uniques = [
    "museum", "keep", "laboratory", "smithy", "library", "school-of-magic",
    "dragon-gate", "observatory", "great-wall", "factory", "park", "armory",
    "capitol", "monument",
  ] as const;
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "v2-museum-pass", uniques);
  const state: CitadelsState = {
    ...base,
    phase: "turn",
    draft: null,
    active: ANN,
    claimed: [{ seat: ANN, character: "merchant" }],
    callRank: 6,
    steps: [
      { kind: "window", window: { kind: "keep", purpose: "keep", seats: [ANN] } },
      { kind: "end-turn" },
      { kind: "call" },
      { kind: "end-round" },
    ],
    players: base.players.map((p) =>
      p.seat === ANN ? { ...p, city: [{ id: "museum", gold: 0 }], hand: ["tavern", "market"] } : p,
    ),
  };
  const after = advance(state, (seat) => (seat === ANN ? { t: "pass" } : null));
  const museum = after.players.find((p) => p.seat === ANN)?.city.find((d) => d.id === "museum");
  expect(museum?.cards ?? []).toHaveLength(0);
  expect(rawHand(after, ANN)).toEqual(["tavern", "market"]);
});
