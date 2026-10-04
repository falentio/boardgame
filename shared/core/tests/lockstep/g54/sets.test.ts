import { expect, test } from "vitest";
import { at, fakeClock, recordingSession } from "../harness.ts";
import {
  ANN,
  SEATS3,
  SEATS6,
  STARTER,
  advance,
  driveFrame,
  rawGenesis,
  tableOf,
  totalCards,
  totalCoins,
  type G54View,
  type RoleId,
} from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { genesisSeed, type SeatId } from "../../../index.ts";
import { COIN_SUPPLY } from "../../../lockstep/games/g54/setup.ts";

/** The four recommended tutorial sets from `09-variants-and-play-notes.md`. */
const STARTER_SET: readonly RoleId[] = STARTER;
const INCOME_SET: readonly RoleId[] = [
  "capitalist",
  "writer",
  "crime-boss",
  "customs-officer",
  "missionary",
];
const NEGOTIATION_SET: readonly RoleId[] = [
  "farmer",
  "producer",
  "general",
  "foreign-consular",
  "lawyer",
];
const CHAOS_SET: readonly RoleId[] = [
  "speculator",
  "newscaster",
  "mercenary",
  "priest",
  "protestor",
];

const RECOMMENDED: readonly (readonly [string, readonly RoleId[]])[] = [
  ["starter", STARTER_SET],
  ["income", INCOME_SET],
  ["negotiation", NEGOTIATION_SET],
  ["chaos", CHAOS_SET],
];

const coinsOf = (view: G54View, seat: SeatId): number =>
  view.players.find((p) => p.seat === seat)?.coins ?? 0;

const rivals = (view: G54View, seat: SeatId): readonly SeatId[] =>
  view.players.filter((p) => p.handCount > 0 && p.seat !== seat).map((p) => p.seat);

/**
 * A deterministic, always-legal policy that pushes a game to terminal. It Coups
 * when rich, attacks with any affordable Force role, and answers the extra
 * windows (funding, tax, second action, reactive claims) so the machine is
 * exercised, not merely walked.
 */
const policy = (seat: SeatId, view: G54View) => {
  const window = view.window;
  if (window === null) return null;
  const coins = coinsOf(view, seat);
  const others = rivals(view, seat);
  const target = others[0];
  switch (window.purpose) {
    case "turn":
    case "spy-second": {
      if (target === undefined) return null;
      if (coins >= 7) return { t: "coup" as const, target };
      const force = view.roles.filter((r) =>
        ["guerrilla", "judge", "mercenary", "crime-boss", "general", "protestor"].includes(r),
      )[0];
      if (force !== undefined && coins >= 3) return { t: "claim" as const, role: force, target };
      return { t: "income" as const };
    }
    case "protestor-fund":
      return coins >= 3 ? { t: "pay" as const } : null;
    case "crime-pay":
      return coins >= 2 ? { t: "pay" as const } : { t: "no" as const };
    case "capitalist":
      return { t: "claim" as const, role: "capitalist" as const, target: null };
    case "writer-draw":
      return coins >= 1 ? { t: "pay" as const } : null;
    case "customs-mark":
      return { t: "claim" as const, role: view.roles[0] as RoleId, target: null };
    case "producer-give":
      return { t: "give" as const, index: 0 };
    case "reactive-intellectual":
      return { t: "claim" as const, role: "intellectual" as const, target: null };
    case "reactive-missionary":
      return { t: "claim" as const, role: "missionary" as const, target: null };
    case "lawyer":
      return { t: "claim" as const, role: "lawyer" as const, target: null };
    default:
      return null;
  }
};

/** The same policy over a raw state, for the deck-conservation fold. */
const rawPolicy = (seat: SeatId, state: ReturnType<typeof rawGenesis>) =>
  policy(seat, g54.project(state, seat));

test("the four recommended sets each reach terminal for 3 and 6 seats", () => {
  for (const [name, roles] of RECOMMENDED) {
    for (const seats of [SEATS3, SEATS6]) {
      const table = tableOf(roles, seats, `recommended-${name}-${String(seats.length)}`);
      let guard = 0;
      while (!at(table, ANN).terminal && guard < 20_000) {
        driveFrame(table, policy);
        guard += 1;
      }
      const view = at(table, ANN).view();
      expect(view.terminal, `${name} ${String(seats.length)} seats`).toBe(true);
      expect(view.winner, `${name} ${String(seats.length)} seats`).not.toBeNull();
    }
  }
});

test("a full starter game conserves the deck and the coins every frame", () => {
  const start = rawGenesis(STARTER_SET, SEATS6, "conserve-all");
  let state = start;
  let steps = 0;
  while (!g54.isTerminal(state) && steps < 20_000) {
    state = advance(state, rawPolicy);
    steps += 1;
    expect(totalCards(state)).toBe(15);
    expect(totalCoins(state)).toBe(COIN_SUPPLY);
  }
  expect(g54.isTerminal(state)).toBe(true);
  expect(totalCards(state)).toBe(15);
  expect(totalCoins(state)).toBe(COIN_SUPPLY);
});

test("a full game of every recommended set conserves the deck and the coins", () => {
  for (const [name, roles] of RECOMMENDED) {
    let state = rawGenesis(roles, SEATS6, `conserve-${name}`);
    let steps = 0;
    while (!g54.isTerminal(state) && steps < 20_000) {
      state = advance(state, rawPolicy);
      steps += 1;
      expect(totalCards(state), name).toBe(15);
      expect(totalCoins(state), name).toBe(COIN_SUPPLY);
    }
    expect(g54.isTerminal(state), name).toBe(true);
  }
});

test("two independent peers folding a full chaos game reach identical views", () => {
  const a = tableOf(CHAOS_SET, SEATS6, "two-peers-chaos");
  let guard = 0;
  while (!at(a, ANN).terminal && guard < 20_000) {
    driveFrame(a, policy);
    guard += 1;
  }

  const b = recordingSession(g54, {
    seats: SEATS6,
    setup: { roles: CHAOS_SET },
    seed: genesisSeed("two-peers-chaos"),
    clock: fakeClock().clock,
    seat: ANN,
  });
  const frames = [...a.sealed.entries()].sort((x, y) => x[0] - y[0]).map(([, frame]) => frame);
  for (const frame of frames) b.session.receive({ kind: "frame", frame });

  expect(b.session.terminal).toBe(true);
  expect(b.session.view()).toEqual(at(a, ANN).view());
});
