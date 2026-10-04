import { expect, test } from "vitest";
import { act, idle, resign, type SeatId } from "../../../index.ts";
import { at } from "../harness.ts";
import {
  ANN,
  BOB,
  CARA,
  SEATS3,
  STARTER,
  advance,
  challengeBlockAction,
  craftSet,
  openPurpose,
  rawCoins,
  rawFrame,
  rawGenesis,
  rawHand,
  rawRevealed,
  rawStep,
  seatsOwedAt,
  tableOf,
  totalCards,
  totalCoins,
  withCoins,
  withHands,
  withTax,
  type G54Action,
  type G54State,
  type RoleId,
} from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { COIN_SUPPLY } from "../../../lockstep/games/g54/setup.ts";

const pass = (): null => null;

const turnWindow = (seat: SeatId): G54State["steps"][number] => ({
  kind: "window",
  window: { kind: "turn", purpose: "turn", seats: [seat], cause: null },
});

const cardsInTable = (table: ReturnType<typeof tableOf>): number => {
  const view = at(table, ANN).view();
  const hands = SEATS3.reduce((n, seat) => n + at(table, seat).view().myHand.length, 0);
  const revealed = view.players.reduce((n, p) => n + p.revealed.length, 0);
  return hands + revealed + view.courtCount;
};

const GUERRILLA_SET: readonly RoleId[] = [
  "banker",
  "director",
  "guerrilla",
  "politician",
  "peacekeeper",
];

// Defect 1: an empty-owed window must be voided, never retargeted onto the active seat.

test("an execution reveal whose target died to a challenge does not flip the attacker", () => {
  let state = withCoins(
    craftSet(
      GUERRILLA_SET,
      [
        [ANN, ["guerrilla", "banker"]],
        [BOB, ["banker"]],
      ],
      "dead-target",
    ),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, (seat) => (seat === BOB ? { t: "challenge" } : null));
  state = advance(state, (seat, s) => (seat === s.active ? { t: "show" } : null));
  // Bob loses his only life to the failed challenge and is eliminated. The attack
  // still resolves, but its block and execution windows both name the dead Bob.
  while (openPurpose(state) !== "turn" && !g54.isTerminal(state)) {
    state = advance(state, pass);
  }
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(rawHand(state, ANN)).toHaveLength(2);
  expect(rawRevealed(state, ANN)).toHaveLength(0);
  expect(openPurpose(state)).toBe("turn");
});

test("stacked Disappear tokens on a one-card target do not flip an unrelated seat", () => {
  let state = withHands([[BOB, ["banker"]]], "stacked-disappear");
  state = {
    ...state,
    active: BOB,
    steps: [turnWindow(BOB)],
    disappear: [
      { target: BOB, turns: 1 },
      { target: BOB, turns: 1 },
    ],
  };
  // Bob's turn ends; both tokens fire at once, opening two reveal windows for him.
  state = advance(state, (seat, s) => (seat === s.active ? { t: "income" } : null));
  expect(openPurpose(state)).toBe("reveal");
  state = advance(state, pass);
  // The first reveal eliminates Bob; the second must be voided, not retargeted.
  expect(rawHand(state, BOB)).toHaveLength(0);
  expect(rawHand(state, CARA)).toHaveLength(2);
  expect(openPurpose(state)).toBe("turn");
});

test("a resigning reveal target is voided, not redirected to the attacker", () => {
  const start = withHands([[BOB, ["banker", "banker"]]], "resign-reveal");
  const state = {
    ...start,
    steps: [
      {
        kind: "window" as const,
        window: { kind: "oneOf" as const, purpose: "reveal" as const, seats: [BOB], cause: null },
      },
    ],
  };
  const after = rawStep(state, rawFrame(0, [[BOB, { kind: "resign" }]]));
  expect(rawHand(after, ANN)).toHaveLength(2);
  expect(rawRevealed(after, ANN)).toHaveLength(0);
  expect(rawRevealed(after, BOB)).toHaveLength(0);
});

test("a window voided off the end of the stack ends the turn with a fresh window", () => {
  const start = rawGenesis(STARTER, SEATS3, "void-empties-stack");
  const state = {
    ...start,
    resigned: [BOB],
    steps: [
      {
        kind: "window" as const,
        window: { kind: "oneOf" as const, purpose: "reveal" as const, seats: [BOB], cause: null },
      },
    ],
  };
  const after = rawStep(state, rawFrame(0, []));
  expect(openPurpose(after)).toBe("turn");
  expect(seatsOwedAt(after).length).toBeGreaterThan(0);
});

// Defect 2: an active-seat resign must not lose in-flight Court cards or strand the stack.

test("an active-seat resign returns in-flight Court cards and rebuilds the turn", () => {
  const start = rawGenesis(STARTER, SEATS3, "resign-active-draw");
  const pool = start.court.slice(0, 2);
  const state = {
    ...start,
    active: ANN,
    court: start.court.slice(2),
    draw: { seat: ANN, pool, keepSize: 2, target: null },
    steps: [turnWindow(ANN)],
  };
  const before = totalCards(state);
  const after = rawStep(state, rawFrame(0, [[ANN, { kind: "resign" }]]));
  expect(g54.isTerminal(after)).toBe(false);
  expect(after.draw).toBeNull();
  expect(totalCards(after)).toBe(before);
  expect(openPurpose(after)).toBe("turn");
  expect(seatsOwedAt(after).length).toBeGreaterThan(0);
});

test("a non-active seat resigning during an open window leaves the game healthy", () => {
  const table = tableOf(STARTER, SEATS3, "resign-window-nonactive");
  at(table, ANN).report(act<G54Action>({ t: "claim", role: "banker", target: null }));
  at(table, ANN).report(act<G54Action>({ t: "pass" }));
  at(table, BOB).report(resign<G54Action>());
  at(table, CARA).report(act<G54Action>({ t: "pass" }));
  expect(at(table, ANN).terminal).toBe(false);
  expect(at(table, ANN).owed().length).toBeGreaterThan(0);
  expect(cardsInTable(table)).toBe(15);
});

test("the active seat resigning mid-turn does not throw and the game continues", () => {
  const table = tableOf(STARTER, SEATS3, "resign-window-active");
  at(table, ANN).report(act<G54Action>({ t: "claim", role: "banker", target: null }));
  at(table, ANN).report(resign<G54Action>());
  at(table, BOB).report(act<G54Action>({ t: "pass" }));
  at(table, CARA).report(act<G54Action>({ t: "pass" }));
  expect(at(table, ANN).terminal).toBe(false);
  expect(at(table, ANN).owed().length).toBeGreaterThan(0);
  expect(cardsInTable(table)).toBe(15);
  // The turn moved on: a fresh turn window is owed by a live seat.
  expect(at(table, ANN).view().active).not.toBe(ANN);
});

// Defect 4: a secondary Capitalist collection is taxed like any other claim.

test("a secondary Capitalist collection pays the Tax mark", () => {
  const roles: readonly RoleId[] = [
    "capitalist",
    "director",
    "guerrilla",
    "customs-officer",
    "politician",
  ];
  let state = craftSet(roles, [[ANN, ["capitalist", "banker"]]], "cap-secondary-tax");
  state = withTax(state, "capitalist", CARA);
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "capitalist", target: null } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("capitalist");
  // Ann's main claim already paid the tax to Cara.
  expect(rawCoins(state, CARA)).toBe(3);
  state = advance(state, (seat) =>
    seat === BOB ? { t: "claim", role: "capitalist", target: null } : null,
  );
  // Bob's secondary claim is taxed too, before its own challenge window.
  expect(rawCoins(state, BOB)).toBe(1);
  expect(rawCoins(state, CARA)).toBe(4);
});

// Defect 5: a failed Lawyer claim passes the estate to the next clockwise claimant.

test("a failed Lawyer claim passes the coins to the next clockwise claimant", () => {
  const roles: readonly RoleId[] = ["banker", "director", "guerrilla", "lawyer", "politician"];
  let state = withCoins(
    craftSet(
      roles,
      [
        [ANN, ["banker", "banker"]],
        [BOB, ["banker"]],
        [CARA, ["lawyer", "banker"]],
      ],
      "lawyer-multi",
    ),
    ANN,
    8,
  );
  state = withCoins(state, BOB, 6);
  state = advance(state, (seat, s) => (seat === s.active ? { t: "coup", target: BOB } : null));
  state = advance(state, (seat) => (seat === BOB ? { t: "reveal", index: 0 } : null));
  expect(openPurpose(state)).toBe("lawyer");
  // Both survivors claim; Cara is clockwise-first from the eliminated Bob.
  state = advance(state, (seat) =>
    seat === ANN || seat === CARA ? { t: "claim", role: "lawyer", target: null } : null,
  );
  expect(openPurpose(state)).toBe("challenge-claim");
  // Ann challenges Cara's claim and Cara concedes: the estate passes to Ann.
  state = advance(state, (seat) => (seat === ANN ? { t: "challenge" } : null));
  state = advance(state, (seat) => (seat === CARA ? { t: "concede" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(openPurpose(state)).toBe("challenge-claim");
  // No challenge on Ann's claim: it resolves and takes the estate.
  state = advance(state, pass);
  state = advance(state, pass);
  expect(rawCoins(state, ANN)).toBe(7);
  expect(rawCoins(state, BOB)).toBe(0);
});

// Defect 6: Crime Boss cannot complete the kill without 5 coins after the refusal.

test("Crime Boss does not kill when the claimant cannot cover 5 coins on refusal", () => {
  const start = withCoins(
    craftSet(["banker", "director", "crime-boss", "peacekeeper", "politician"], [], "cb-broke"),
    ANN,
    4,
  );
  const state = {
    ...start,
    pending: {
      kind: "role" as const,
      claimant: ANN,
      role: "crime-boss" as const,
      target: BOB,
      cost: 0,
      costTo: "treasury" as const,
      blockRole: null,
      blocker: null,
      challenger: null,
      blockChallenger: null,
      funded: false,
    },
    steps: [
      {
        kind: "window" as const,
        window: {
          kind: "oneOf" as const,
          purpose: "crime-pay" as const,
          seats: [BOB],
          cause: null,
        },
      },
    ],
  };
  const after = advance(state, (seat) => (seat === BOB ? { t: "no" } : null));
  expect(rawCoins(after, ANN)).toBe(4);
  expect(rawHand(after, BOB)).toHaveLength(2);
});

// Test gaps: multi-challenger tie-break, and the proof-block success path.

test("two challengers in one frame resolve clockwise from the active seat", () => {
  let state = withHands([[ANN, ["banker", "banker"]]], "multi-challenge");
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "banker", target: null } : null,
  );
  state = advance(state, (seat) => (seat === BOB || seat === CARA ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-claim");
  expect(state.pending?.challenger).toBe(BOB);
});

test("a truthful block stands and the challenger loses a life", () => {
  let state = withCoins(
    craftSet(GUERRILLA_SET, [[BOB, ["guerrilla", "banker"]]], "proof-block-ok"),
    ANN,
    4,
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  state = advance(state, pass);
  expect(openPurpose(state)).toBe("block");
  state = advance(state, (seat) => (seat === BOB ? { t: "block", role: "guerrilla" } : null));
  expect(openPurpose(state)).toBe("challenge-block");
  state = advance(state, (seat) => (seat === CARA ? { t: "challenge" } : null));
  expect(openPurpose(state)).toBe("proof-block");
  state = advance(state, (seat) => (seat === BOB ? { t: "show" } : null));
  state = advance(state, pass);
  expect(rawHand(state, CARA)).toHaveLength(1);
  expect(rawHand(state, BOB)).toHaveLength(2);
});

// The full-game challenge-and-block policy must still reach terminal.

test("a challenge-and-block policy drives the recommended sets to terminal", () => {
  const sets: readonly (readonly RoleId[])[] = [
    STARTER,
    ["capitalist", "writer", "crime-boss", "customs-officer", "missionary"],
    ["farmer", "producer", "general", "foreign-consular", "lawyer"],
    ["speculator", "newscaster", "mercenary", "priest", "protestor"],
  ];
  for (const roles of sets) {
    const table = tableOf(roles, SEATS3, `challenge-block-${roles.join("-")}`);
    let guard = 0;
    while (!at(table, ANN).terminal && guard < 40_000) {
      const opener = at(table, ANN);
      const frame = opener.frame;
      for (const seat of opener.owed()) {
        const session = at(table, seat);
        if (session.frame !== frame) continue;
        const action = challengeBlockAction(seat, session.view());
        session.report(action === null ? idle<G54Action>() : act<G54Action>(action));
      }
      guard += 1;
    }
    expect(at(table, ANN).view().terminal, roles.join("-")).toBe(true);
    expect(at(table, ANN).view().winner, roles.join("-")).not.toBeNull();
  }
});

test("a challenge-and-block game conserves the deck and the coins every frame", () => {
  const sets: readonly (readonly RoleId[])[] = [
    STARTER,
    ["capitalist", "writer", "crime-boss", "customs-officer", "missionary"],
    ["farmer", "producer", "general", "foreign-consular", "lawyer"],
    ["speculator", "newscaster", "mercenary", "priest", "protestor"],
  ];
  for (const roles of sets) {
    let state = rawGenesis(roles, SEATS3, `challenge-block-${roles.join("-")}`);
    let steps = 0;
    while (!g54.isTerminal(state) && steps < 40_000) {
      state = advance(state, (seat, s) => challengeBlockAction(seat, g54.project(s, seat)));
      steps += 1;
      expect(totalCards(state), roles.join("-")).toBe(15);
      expect(totalCoins(state), roles.join("-")).toBe(COIN_SUPPLY);
    }
    expect(g54.isTerminal(state), roles.join("-")).toBe(true);
  }
});
