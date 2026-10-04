import { expect, test } from "vitest";
import {
  ANN,
  BOB,
  CARA,
  advance,
  craftSet,
  openPurpose,
  rawCoins,
  rawFrame,
  rawGenesis,
  rawStep,
  SEATS3,
  seatsOwedAt,
  withCoins,
} from "./driver.ts";
import type { G54Action, RoleId } from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";

const pass = (): null => null;

const HOSTILE: readonly (G54Action | null)[] = [
  null,
  { t: "pass" },
  { t: "challenge" },
  { t: "show" },
  { t: "concede" },
  { t: "reveal", index: 999 },
  { t: "reveal", index: -1 },
  { t: "keep", indices: [9, 9] },
  { t: "keep", indices: [] },
  { t: "give", index: 42 },
  { t: "block", role: "banker" },
  { t: "pay" },
  { t: "no" },
  { t: "claim", role: "guerrilla", target: CARA },
  { t: "coup", target: ANN },
  { t: "income" },
];

test("step is total: every hostile report advances without throwing", () => {
  const roles: readonly RoleId[] = ["banker", "director", "guerrilla", "priest", "protestor"];
  let state = rawGenesis(roles, SEATS3, "totality");
  let cursor = 0;
  for (let i = 0; i < 2000 && !g54.isTerminal(state); i += 1) {
    const owed = seatsOwedAt(state);
    expect(owed.length).toBeGreaterThan(0);
    const inputs = owed.map((seat) => {
      const action = HOSTILE[cursor % HOSTILE.length] ?? null;
      cursor += 1;
      return [seat, action] as const;
    });
    state = advance(state, () => null);
    state = rawStep(
      state,
      rawFrame(
        0,
        inputs.map(([s, a]) => [
          s,
          a === null ? ({ kind: "idle" } as const) : ({ kind: "act", action: a } as const),
        ]),
      ),
    );
  }
  // The game either terminated or is still healthy with a non-empty owed set.
  expect(g54.isTerminal(state) || seatsOwedAt(state).length > 0).toBe(true);
});

test("an unaffordable or illegal claim falls back to Income, never stalling", () => {
  let state = withCoins(
    craftSet(["banker", "director", "guerrilla", "priest", "protestor"], [], "fallback"),
    ANN,
    0,
  );
  // Ann cannot afford Guerrilla (4 coins), so the claim is coerced to Income.
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "guerrilla", target: BOB } : null,
  );
  expect(rawCoins(state, ANN)).toBe(1);
  expect(openPurpose(state)).toBe("turn");
});

test("a claim on a role not in the set falls back to Income", () => {
  let state = craftSet(
    ["banker", "director", "guerrilla", "priest", "protestor"],
    [],
    "not-in-set",
  );
  state = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "speculator", target: null } : null,
  );
  expect(rawCoins(state, ANN)).toBe(3);
});

test("a reactive role cannot be claimed as a turn action", () => {
  const state = craftSet(
    ["banker", "director", "guerrilla", "intellectual", "politician"],
    [],
    "reactive-turn",
  );
  const after = advance(state, (seat, s) =>
    seat === s.active ? { t: "claim", role: "intellectual", target: null } : null,
  );
  // Coerced to Income: Ann gains 1 coin and the turn passes.
  expect(rawCoins(after, ANN)).toBe(3);
  expect(after.active).toBe(BOB);
});

test("seatsOwed is never empty on a non-terminal state across a whole game", () => {
  const roles: readonly RoleId[] = [
    "capitalist",
    "writer",
    "crime-boss",
    "customs-officer",
    "missionary",
  ];
  let state = rawGenesis(roles, SEATS3, "never-empty");
  let steps = 0;
  while (!g54.isTerminal(state) && steps < 5000) {
    expect(seatsOwedAt(state).length).toBeGreaterThan(0);
    state = advance(state, pass);
    steps += 1;
  }
  expect(g54.isTerminal(state)).toBe(true);
});
