import { expect, test } from "vitest";
import { citadels, scoreGame, type CitadelsState } from "../../../../../lockstep/games/citadels/index.ts";
import { warlord } from "../../../../../lockstep/games/citadels/characters/warlord.ts";
import { king } from "../../../../../lockstep/games/citadels/characters/king.ts";
import { specOfDistrict } from "../../../../../lockstep/games/citadels/districts.ts";
import { WINDOW_PURPOSES } from "../../../../../lockstep/games/citadels/state.ts";
import {
  ANN,
  BOB,
  BASE_CAST_IDS,
  SEATS3,
  advance,
  autoAction,
  rawFrame,
  rawGenesis,
  rawGold,
  rawPlayer,
  rawRandom,
  withGold,
  withHand,
} from "../../driver.ts";

/**
 * Independent verifier counterexamples. Every test below failed against the head
 * under review, and each names one defect in the citadels game definition. The
 * defects are fixed at head, so these tests pin the fixed behaviour. See
 * orchestrate/citadels/verification.md for the finding each one
 * encodes.
 */

const placed = (id: string, gold = 0) => ({ id, gold });

const withCity = (
  state: CitadelsState,
  seat: string,
  city: readonly { readonly id: string; readonly gold: number }[],
): CitadelsState => ({
  ...state,
  players: state.players.map((p) => (p.seat === seat ? { ...p, city } : p)),
});

/** ANN's turn window is open, the round closes beneath it. */
const turnState = (state: CitadelsState): CitadelsState => ({
  ...state,
  phase: "turn",
  draft: null,
  active: ANN,
  steps: [
    { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
    { kind: "end-round" },
  ],
});

const openWarlord = (state: CitadelsState): CitadelsState =>
  warlord({ state, seat: ANN, rest: [], rng: rawRandom() });

const stepAnn = (state: CitadelsState, action: unknown): CitadelsState =>
  advance(state, (seat) => (seat === ANN ? (action as never) : null));

// D1: the engine never invokes a character ability.
test("a full game exercises at least one character ability through the engine", () => {
  let state = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d1");
  const crownHolders = new Set<string>([state.crown]);
  const characterPurposes = new Set(
    WINDOW_PURPOSES.filter((p) => p !== "turn" && p !== "keep" && p !== "draft-pick"),
  );
  const openedCharacterWindows = new Set<string>();
  let frames = 0;
  while (!citadels.isTerminal(state) && frames < 20_000) {
    const top = state.steps[0];
    if (top !== undefined && top.kind === "window" && characterPurposes.has(top.window.purpose)) {
      openedCharacterWindows.add(top.window.purpose);
    }
    state = advance(state, (seat, s) => autoAction(seat, citadels.project(s, seat)));
    crownHolders.add(state.crown);
    frames += 1;
  }
  expect(citadels.isTerminal(state)).toBe(true);
  // The King (rank 4) is in the base cast and must take the crown on its turn;
  // if no character ability ever runs, the crown never leaves its opening holder.
  expect([...crownHolders]).not.toEqual([ANN]);
  expect(openedCharacterWindows.size).toBeGreaterThan(0);
});

// D2: the Artist's beautify marker is not added to the cost sum.
test("a beautified district scores one more than its catalog cost", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d2");
  const score = scoreGame(withCity(base, ANN, [placed("manor", 1)])).find((row) => row.seat === ANN);
  expect(specOfDistrict("manor").cost).toBe(3);
  expect(score?.districts).toBe(4);
});

// D3: the Secret Vault's held-card bonus is unreachable in a real game.
test("a Secret Vault still in hand at end of game scores three", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d3");
  const score = scoreGame(withHand(base, ANN, ["secret-vault", "tavern"])).find(
    (row) => row.seat === ANN,
  );
  expect(score?.unique).toBe(3);
});

// D4: the Great Wall toll is never charged by the Warlord.
test("the Warlord pays one extra gold to destroy a district behind a Great Wall", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d4");
  const state = withGold(
    withCity(
      { ...base, phase: "turn", draft: null, claimed: [{ seat: ANN, character: "warlord" }] },
      BOB,
      [placed("great-wall"), placed("palace")],
    ),
    ANN,
    20,
  );
  const next = stepAnn(stepAnn(openWarlord(state), { t: "target", seat: BOB }), {
    t: "keep",
    index: 1,
  });
  // Palace costs 5; the Warlord pays one less (4), the Great Wall adds one back (5).
  expect(rawGold(next, ANN)).toBe(15);
  expect(rawPlayer(next, BOB).city.map((d) => d.id)).toEqual(["great-wall"]);
});

// D5: the Keep is not protected from the Warlord.
test("the Warlord cannot destroy the Keep", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d5");
  const state = withGold(
    withCity(
      { ...base, phase: "turn", draft: null, claimed: [{ seat: ANN, character: "warlord" }] },
      BOB,
      [placed("keep"), placed("palace")],
    ),
    ANN,
    20,
  );
  const next = stepAnn(stepAnn(openWarlord(state), { t: "target", seat: BOB }), {
    t: "keep",
    index: 0,
  });
  expect(rawPlayer(next, BOB).city.map((d) => d.id)).toEqual(["keep", "palace"]);
  expect(rawGold(next, ANN)).toBe(20);
});

// D6: the Bishop's shield is computed but never enforced against rank 8.
test("the rank-8 Warlord cannot destroy a district in the Bishop's city", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d6");
  const state = withGold(
    withCity(
      {
        ...base,
        phase: "turn",
        draft: null,
        claimed: [
          { seat: ANN, character: "warlord" },
          { seat: BOB, character: "bishop" },
        ],
      },
      BOB,
      [placed("palace")],
    ),
    ANN,
    20,
  );
  const next = stepAnn(stepAnn(openWarlord(state), { t: "target", seat: BOB }), {
    t: "keep",
    index: 0,
  });
  expect(rawPlayer(next, BOB).city.map((d) => d.id)).toEqual(["palace"]);
});

// D7: a duplicate district is buildable without a Quarry.
test("a district already in your city cannot be built again without a Quarry", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d7");
  const state = withGold(
    withHand(withCity(turnState(base), ANN, [placed("tavern")]), ANN, ["tavern", "market"]),
    ANN,
    10,
  );
  const next = stepAnn(state, { t: "build", card: 0 });
  expect(rawPlayer(next, ANN).city.map((d) => d.id)).toEqual(["tavern"]);
});

// D8: the completion bonus is assigned by roster order, not by who finished first.
test("the first city to reach eight districts takes the four-point bonus", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d8");
  const eight = Array.from({ length: 8 }, () => placed("watchtower"));
  const seven = Array.from({ length: 7 }, () => placed("watchtower"));
  // BOB (roster index 1) already reached eight on an earlier rank; ANN (index 0)
  // reaches eight on the later rank of the same round.
  const state: CitadelsState = {
    ...withHand(withCity(withCity(base, ANN, seven), BOB, eight), ANN, ["tavern", "market"]),
    phase: "turn",
    draft: null,
    active: ANN,
    steps: [
      { kind: "window", window: { kind: "turn", purpose: "turn", seats: [ANN] } },
      { kind: "end-turn" },
      { kind: "end-round" },
    ],
  };
  let next = state;
  for (let i = 0; i < 40 && !citadels.isTerminal(next); i += 1) {
    next = advance(next, (seat, s) => {
      const top = s.steps[0];
      const isAnnTurn =
        top !== undefined && top.kind === "window" && top.window.purpose === "turn" && seat === ANN;
      if (isAnnTurn && rawPlayer(s, ANN).city.length < 8) return { t: "build", card: 0 };
      return { t: "gold" };
    });
  }
  expect(citadels.isTerminal(next)).toBe(true);
  expect(next.completed[0]).toBe(BOB);
  expect(scoreGame(next).find((row) => row.seat === BOB)?.completion).toBe(4);
});

// D9: a declared type on the School of Magic never reaches income.
test("a School of Magic declared noble counts as a noble for the King's income", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d9");
  const state: CitadelsState = {
    ...withCity(base, ANN, [{ id: "school-of-magic", gold: 0, declaredType: "noble" }]),
    claimed: [{ seat: ANN, character: "king" }],
  };
  const next = king({ state, seat: ANN, rest: [], rng: rawRandom() });
  expect(rawGold(next, ANN)).toBe(rawGold(state, ANN) + 1);
});

// D10: the Museum's "place a card under it" clause has no engine seam.
test("a card can be placed under the Museum during its owner's turn", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d10");
  const museumIn = (state: CitadelsState): readonly string[] | undefined =>
    rawPlayer(state, ANN).city.find((district) => district.id === "museum")?.cards;
  const drive = (offer: CitadelsAction): CitadelsState => {
    const state = withHand(withCity(turnState(base), ANN, [placed("museum")]), ANN, [
      "tavern",
      "market",
    ]);
    let next = state;
    for (let i = 0; i < 6; i += 1) {
      const top = next.steps[0];
      const isTurn = top !== undefined && top.kind === "window" && top.window.purpose === "turn";
      // The offer rides the gather's keep window; only a keep names a card to tuck.
      next = stepAnn(next, isTurn ? { t: "gold" } : offer);
    }
    return next;
  };
  expect((museumIn(drive({ t: "keep", index: 0 })) ?? []).length).toBeGreaterThan(0);
  // The rule is "you may place", so the offer is a decline: the hand stays whole.
  expect((museumIn(drive({ t: "pass" })) ?? []).length).toBe(0);
  expect(rawPlayer(drive({ t: "pass" }), ANN).hand).toEqual(["tavern", "market"]);
});

// D11: the Thieves' Den's mixed gold-and-cards payment is refused.
test("D11 the Thieves' Den's mixed payment splits through a driven turn", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d11");
  const state = withGold(
    withHand(withCity(turnState(base), ANN, []), ANN, ["thieves-den", "tavern", "market"]),
    ANN,
    2,
  );
  const next = stepAnn(state, { t: "build", card: 0 });
  expect(rawPlayer(next, ANN).city.map((d) => d.id)).toEqual(["thieves-den"]);
});

// D12: declaring the Haunted Quarter unique does not stop the Ivory Tower.
test("an Ivory Tower beside a Haunted Quarter declared unique scores nothing", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d12");
  const score = scoreGame(
    withCity(base, ANN, [
      placed("ivory-tower"),
      { id: "haunted-quarter", gold: 0, declaredType: "unique" },
    ]),
  ).find((row) => row.seat === ANN);
  expect(score?.unique).toBe(0);
});

// D13: step throws on a bare-step stack while seatsOwed still names the seats.
test("step coerces a non-terminal state whose stack has no window", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d13");
  const bare: CitadelsState = { ...base, phase: "turn", draft: null, steps: [{ kind: "call" }] };
  expect(citadels.seatsOwed(bare, 0).length).toBeGreaterThan(0);
  expect(() => citadels.step(bare, rawFrame(0, []), rawRandom())).not.toThrow();
});

// D14: the gather's unkept card is revealed through the public discard pile.
test("a hidden deck card is not revealed to other seats through the discard pile", () => {
  const base = rawGenesis(SEATS3, BASE_CAST_IDS, "verifier-d14");
  const state = withHand(withCity(turnState(base), ANN, []), ANN, []);
  const afterDraw = stepAnn(state, { t: "draw" });
  const drawn = afterDraw.pending?.cards ?? [];
  expect(drawn.length).toBe(2);
  const afterKeep = stepAnn(afterDraw, { t: "keep", index: 0 });
  const hiddenDeckCards = new Set(afterKeep.deck);
  const bobSees = citadels.project(afterKeep, BOB).discard;
  // The unkept card came from the hidden deck and must not be identifiable to BOB.
  expect(bobSees.some((id) => !hiddenDeckCards.has(id))).toBe(false);
});
