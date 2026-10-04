import { expect, test } from "vitest";
import {
  act,
  frameIndex,
  genesisSeed,
  seatId,
  type Frame,
  type GameDefinition,
} from "../../index.ts";
import {
  coinflip,
  type CoinflipAction,
  type CoinflipSetup,
  type CoinflipState,
  type CoinflipView,
} from "../../lockstep/games/coinflip.ts";
import { fakeClock, makeTable, at, recordingSession } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const SEED = genesisSeed("lockstep-convergence-tests");
const SETUP: CoinflipSetup = { rounds: 3 };

const playHeads = (): CoinflipAction => ({ t: "call", side: "heads" });

/**
 * A game identical to coinflip except that its `step` perturbs a *hidden* field
 * (each player's secret) that no visible behavior depends on. Two peers folding
 * the same frames therefore reach different state with identical views — exactly
 * the silent divergence the seed chain must now catch.
 */
const mutant: GameDefinition<CoinflipState, CoinflipAction, CoinflipSetup, CoinflipView> = {
  ...coinflip,
  step(state, frame, rng) {
    const next = coinflip.step(state, frame, rng);
    return {
      ...next,
      players: next.players.map((p) => ({ ...p, secret: p.secret + 1 })),
    };
  },
};

test("two peers that fold the same frame but reach different state diverge at the next frame", () => {
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: fakeClock().clock,
  });

  // Seal frame 0 (the call) and frame 1 (the stake) on the converged table.
  at(table, ANN).report(act<CoinflipAction>(playHeads()));
  const frame0 = table.sealed.get(0)!;
  for (const seat of at(table, ANN).owed())
    at(table, seat).report(act<CoinflipAction>({ t: "stake" }));
  const frame1 = table.sealed.get(1)!;

  const converged = recordingSession(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: fakeClock().clock,
    seat: ANN,
  });
  const divergent = recordingSession(mutant, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: fakeClock().clock,
    seat: ANN,
  });

  // Both accept frame 0: it carries the genesis seed, which needs no head.
  converged.session.receive({ kind: "frame", frame: frame0 });
  divergent.session.receive({ kind: "frame", frame: frame0 });
  expect(converged.session.frame).toBe(frameIndex(1));
  expect(divergent.session.frame).toBe(frameIndex(1));

  // Same inputs, different state: the visible divergence is only the hidden
  // secret, which the state digest still commits to.
  expect(divergent.session.view().mySecret).not.toBe(converged.session.view().mySecret);

  // Frame 1 was built by the converged peer over the converged state. The
  // divergent peer's expected seed differs, so it rejects the frame instead of
  // silently forking.
  divergent.session.receive({ kind: "frame", frame: frame1 });
  converged.session.receive({ kind: "frame", frame: frame1 });
  expect(divergent.session.frame).toBe(frameIndex(1));
  expect(converged.session.frame).toBe(frameIndex(2));
});

test("a frame built over a tampered state does not chain for a converged peer", () => {
  // The mirror image: a converged peer must reject a frame whose seed was
  // derived from a state it never reached.
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: fakeClock().clock,
  });
  at(table, ANN).report(act<CoinflipAction>(playHeads()));
  const frame0 = table.sealed.get(0)!;
  for (const seat of at(table, ANN).owed())
    at(table, seat).report(act<CoinflipAction>({ t: "stake" }));
  const frame1 = table.sealed.get(1)!;

  const target = recordingSession(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: fakeClock().clock,
    seat: ANN,
  });
  target.session.receive({ kind: "frame", frame: frame0 });

  // A frame whose seed was computed over a different state's digest.
  const tampered: Frame<CoinflipAction> = { ...frame1, seed: genesisSeed("state-from-elsewhere") };
  expect(() => target.session.receive({ kind: "frame", frame: tampered })).not.toThrow();
  expect(target.session.frame).toBe(frameIndex(1));
});
