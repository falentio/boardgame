import { expect, test } from "vitest";
import { act, frameIndex, genesisSeed, resumeSession, seatId } from "../../index.ts";
import { coinflip, type CoinflipAction } from "../../lockstep/games/coinflip.ts";
import { at, fakeClock, makeTable, nullPort } from "./harness.ts";

const SEATS = [seatId("ann"), seatId("bob"), seatId("cara")] as const;
const ANN = SEATS[0];
const CARA = SEATS[2];
const SEED = genesisSeed("turn-timeout-repro");
const SETUP = { rounds: 3 };

// The repro reloads during the host's first turn window, which is frame 0. A
// rebuild must keep the same frame-0 deadline, not hand back the full budget.
test("REPRO: a refresh does not extend the turn clock", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 30_000,
  });
  clock.advance(20_000);
  expect(at(table, ANN).remainingMs()).toBe(10_000);

  const resumed = resumeSession(
    {
      game: coinflip,
      port: nullPort<CoinflipAction>(),
      clock: clock.clock,
      config: { seat: ANN, inputTimeoutMs: 30_000 },
    },
    at(table, ANN).snapshot(),
  );
  expect(resumed.remainingMs()).toBe(10_000);
});

// A frame seals only when every owed seat has reported. Today each peer only
// times out its own seat, so a silent or absent turn-holder hangs the frame for
// everyone present.
test("REPRO: a present peer carries a silent owed seat so the frame seals", () => {
  const clock = fakeClock();
  const table = makeTable(coinflip, {
    seats: SEATS,
    setup: SETUP,
    seed: SEED,
    clock: clock.clock,
    timeoutMs: 1_000,
  });
  at(table, ANN).report(act<CoinflipAction>({ t: "call", side: "heads" }));
  expect(at(table, ANN).frame).toBe(frameIndex(1));
  // BOB goes silent; ANN and CARA are present and have no move to make.
  clock.advance(5_000);
  at(table, ANN).tick();
  expect(at(table, ANN).frame).toBe(frameIndex(2));
  expect(at(table, CARA).frame).toBe(frameIndex(2));
});
