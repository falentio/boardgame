import { expect, test } from "vitest";
import { at, fakeClock, recordingSession } from "../harness.ts";
import {
  ANN,
  SEATS3,
  SEATS6,
  STARTER,
  autoAction,
  driveFrame,
  playToEnd,
  tableOf,
  type G54View,
  type RoleId,
} from "./driver.ts";
import { g54 } from "../../../lockstep/games/g54/index.ts";
import { genesisSeed, type SeatId } from "../../../index.ts";

/** Income until a Coup is affordable; always legal, so any role set terminates. */
const incomeCoup = (seat: SeatId, view: G54View) => {
  if (view.window?.purpose !== "turn") return null;
  const target = view.players.find((p) => p.handCount > 0 && p.seat !== seat)?.seat;
  const coins = view.players.find((p) => p.seat === seat)?.coins ?? 0;
  if (coins >= 7 && target !== undefined) return { t: "coup" as const, target };
  return { t: "income" as const };
};

test("a full starter game reaches terminal for 3 seats", () => {
  const table = tableOf(STARTER, SEATS3, "full-3");
  playToEnd(table, autoAction);
  const view = at(table, ANN).view();
  expect(view.terminal).toBe(true);
  expect(view.winner).not.toBeNull();
});

test("a full starter game reaches terminal for 6 seats", () => {
  const table = tableOf(STARTER, SEATS6, "full-6");
  playToEnd(table, autoAction);
  const view = at(table, ANN).view();
  expect(view.terminal).toBe(true);
  expect(view.winner).not.toBeNull();
});

test("the window machine drives three other legal role sets to terminal", () => {
  const sets: readonly (readonly RoleId[])[] = [
    ["capitalist", "writer", "crime-boss", "customs-officer", "missionary"],
    ["farmer", "producer", "general", "foreign-consular", "lawyer"],
    ["speculator", "newscaster", "mercenary", "priest", "protestor"],
  ];
  for (const roles of sets) {
    const table = tableOf(roles, SEATS3, `other-${roles.join("-")}`);
    playToEnd(table, incomeCoup, 20_000);
    const view = at(table, ANN).view();
    expect(view.terminal).toBe(true);
    expect(view.winner).not.toBeNull();
  }
});

test("two independent peers folding the same frames reach identical views", () => {
  // Peer A plays a full game on the bus; peer B is a lone session that receives
  // exactly the frames A sealed, in order. Both must reach identical views.
  const a = tableOf(STARTER, SEATS6, "two-peers");
  playToEnd(a, autoAction);

  const b = recordingSession(g54, {
    seats: SEATS6,
    setup: { roles: STARTER },
    seed: genesisSeed("two-peers"),
    clock: fakeClock().clock,
    seat: ANN,
  });
  const frames = [...a.sealed.entries()].sort((x, y) => x[0] - y[0]).map(([, frame]) => frame);
  for (const frame of frames) b.session.receive({ kind: "frame", frame });

  expect(b.session.terminal).toBe(true);
  expect(b.session.view()).toEqual(at(a, ANN).view());
});

test("a peer that folds the same frames but mutates hidden state diverges at the next frame", () => {
  // A game identical to g54 except its `step` perturbs only hidden state (the
  // Court order). Two peers folding the same frames reach different state with
  // identical views, so the seed chain must reject the second frame.
  const mutant: typeof g54 = {
    ...g54,
    step(state, frame, rng) {
      const next = g54.step(state, frame, rng);
      return { ...next, court: [...next.court].reverse() };
    },
  };

  const a = tableOf(STARTER, SEATS3, "hidden-divergence");
  // Frame 0 seals the turn claim; frame 1 seals the challenge window (all pass).
  driveFrame(a, autoAction);
  driveFrame(a, autoAction);
  const frame0 = a.sealed.get(0);
  const frame1 = a.sealed.get(1);
  expect(frame0).toBeDefined();
  expect(frame1).toBeDefined();

  const converged = recordingSession(g54, {
    seats: SEATS3,
    setup: { roles: STARTER },
    seed: genesisSeed("hidden-divergence"),
    clock: fakeClock().clock,
    seat: ANN,
  });
  const divergent = recordingSession(mutant, {
    seats: SEATS3,
    setup: { roles: STARTER },
    seed: genesisSeed("hidden-divergence"),
    clock: fakeClock().clock,
    seat: ANN,
  });

  if (frame0 !== undefined) {
    converged.session.receive({ kind: "frame", frame: frame0 });
    divergent.session.receive({ kind: "frame", frame: frame0 });
  }
  expect(converged.session.frame).toBe(1);
  expect(divergent.session.frame).toBe(1);
  // The visible views agree; only hidden state differs.
  expect(divergent.session.view().courtCount).toBe(converged.session.view().courtCount);

  if (frame1 !== undefined) {
    converged.session.receive({ kind: "frame", frame: frame1 });
    divergent.session.receive({ kind: "frame", frame: frame1 });
  }
  expect(converged.session.frame).toBe(2);
  expect(divergent.session.frame).toBe(1);
});
