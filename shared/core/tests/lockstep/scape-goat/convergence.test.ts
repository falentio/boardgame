import { expect, test } from "vitest";
import {
  act,
  buildFrame,
  createSession,
  deadline,
  decodeSnapshot,
  encodeSnapshot,
  expectObject,
  expectedSnapshotSeed,
  frameIndex,
  genesisSeed,
  idle,
  resumeSession,
  stateDigest,
  type Frame,
  type Random,
  type SeatInput,
} from "../../../index.ts";
import { fakeClock, nullPort } from "../harness.ts";
import {
  ANN,
  capThenCops,
  driveRaw,
  rawGenesis,
  scapeGoat,
  seatsOwedNow,
  type Checkpoint,
  type ScapeGoatAction,
  type ScapeGoatState,
  type ScapeGoatView,
} from "./driver.ts";

const FRAME_CAP = 400;
const SETUP = { spyReveal: "private" as const };
const ENTROPY = "converge-seed";

const deps = (seat: typeof ANN) => ({
  game: scapeGoat,
  port: nullPort<ScapeGoatAction>(),
  clock: fakeClock().clock,
  config: { seat, inputTimeoutMs: 1000 },
});

/** Build the frame the policy would seal from `checkpoint`, without advancing. */
const buildFromPolicy = (
  checkpoint: Checkpoint<ScapeGoatState>,
  frame: number,
): Frame<ScapeGoatAction> => {
  const decide = capThenCops(FRAME_CAP);
  const buffer = new Map<typeof ANN, SeatInput<ScapeGoatAction>>();
  for (const seat of seatsOwedNow(checkpoint.state)) {
    const action = decide(checkpoint.state, seat, frame);
    buffer.set(seat, action === null ? idle<ScapeGoatAction>() : act(action));
  }
  return buildFrame(checkpoint.roster, seatsOwedNow(checkpoint.state), checkpoint.frame, checkpoint.seed, buffer);
};

test("two independent sessions from the same seed fold the same frames to identical stateDigest at every frame", () => {
  const runOnce = () => {
    let checkpoint = rawGenesis(4, ENTROPY);
    const digests: string[] = [stateDigest(scapeGoat.state.encode(checkpoint.state))];
    for (let i = 0; i < 30; i += 1) {
      checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), i);
      digests.push(stateDigest(scapeGoat.state.encode(checkpoint.state)));
    }
    return digests;
  };
  const first = runOnce();
  const second = runOnce();
  expect(first).toEqual(second);
  for (let i = 0; i < first.length; i += 1) expect(first[i]).toBe(second[i]);
});

test("a state that diverges is caught: the next frame is rejected", () => {
  // A mutant that perturbs the hidden stash order after each step: two peers
  // folding the same frames reach different state with identical views, which is
  // exactly the silent divergence the seed chain must catch.
  const mutant = {
    ...scapeGoat,
    step(state: ScapeGoatState, frame: Frame<ScapeGoatAction>, rng: Random) {
      const next = scapeGoat.step(state, frame, rng);
      return { ...next, stash: [...next.stash].reverse() };
    },
  };

  let checkpoint = rawGenesis(4, ENTROPY);
  const roster = checkpoint.roster;
  const frame0 = buildFromPolicy(checkpoint, 0);
  const first = driveRaw(checkpoint, capThenCops(FRAME_CAP), 0);
  const frame1 = buildFromPolicy(first, 1);

  const converged = createSession<ScapeGoatState, ScapeGoatAction, typeof SETUP, ScapeGoatView>(
    deps(ANN),
    { seed: genesisSeed(ENTROPY), roster, setup: SETUP, startedAt: deadline(0) },
  );
  const divergent = createSession<ScapeGoatState, ScapeGoatAction, typeof SETUP, ScapeGoatView>(
    { ...deps(ANN), game: mutant },
    { seed: genesisSeed(ENTROPY), roster, setup: SETUP, startedAt: deadline(0) },
  );

  converged.receive({ kind: "frame", frame: frame0 });
  divergent.receive({ kind: "frame", frame: frame0 });
  expect(converged.frame).toBe(frameIndex(1));
  expect(divergent.frame).toBe(frameIndex(1));
  // The visible views agree; only the hidden state digest differs.
  expect(divergent.view()).toEqual(converged.view());

  // Frame 1 was built over the converged state, so the divergent peer rejects it.
  converged.receive({ kind: "frame", frame: frame1 });
  divergent.receive({ kind: "frame", frame: frame1 });
  expect(converged.frame).toBe(frameIndex(2));
  expect(divergent.frame).toBe(frameIndex(1));
});

test("a snapshot round trip preserves state and resumes to the same view", () => {
  let checkpoint = rawGenesis(4, "converge-snapshot");
  for (let i = 0; i < 8; i += 1) checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), i);

  const session = createSession<ScapeGoatState, ScapeGoatAction, typeof SETUP, ScapeGoatView>(
    deps(ANN),
    { seed: genesisSeed("converge-snapshot"), roster: checkpoint.roster, setup: SETUP, startedAt: deadline(0) },
  );
  const snapshot = session.snapshot();
  const json = encodeSnapshot(scapeGoat, snapshot);
  const decoded = decodeSnapshot(scapeGoat, json);
  expect(decoded.frame).toBe(snapshot.frame);
  expect(decoded.seed).toBe(snapshot.seed);
  expect(decoded.head).toEqual(snapshot.head);

  const resumed = resumeSession(deps(ANN), decoded);
  expect(resumed.view()).toEqual(session.view());
  expect(decoded.state).toEqual(snapshot.state);
  expect(stateDigest(decoded.state)).toBe(stateDigest(snapshot.state));
});

test("the game id and version reject a mismatched snapshot", () => {
  const session = createSession<ScapeGoatState, ScapeGoatAction, typeof SETUP, ScapeGoatView>(
    deps(ANN),
    { seed: genesisSeed("converge-id"), roster: rawGenesis(4, "converge-id").roster, setup: SETUP, startedAt: deadline(0) },
  );
  const json = expectObject(encodeSnapshot(scapeGoat, session.snapshot()), "snapshot");
  expect(() => decodeSnapshot(scapeGoat, { ...json, gameId: "not-scape-goat" })).toThrow();
  expect(() => decodeSnapshot(scapeGoat, { ...json, version: 999 })).toThrow();
});

test("a self-consistent snapshot over a divergent state is rejected by the seed chain", () => {
  let checkpoint = rawGenesis(4, "converge-tamper");
  const roster = checkpoint.roster;
  const session = createSession<ScapeGoatState, ScapeGoatAction, typeof SETUP, ScapeGoatView>(
    deps(ANN),
    { seed: genesisSeed("converge-tamper"), roster, setup: SETUP, startedAt: deadline(0) },
  );
  // Fold three frames so the snapshot carries a head and its seed is chained.
  for (let i = 0; i < 3; i += 1) {
    const frame = buildFromPolicy(checkpoint, i);
    session.receive({ kind: "frame", frame });
    checkpoint = driveRaw(checkpoint, capThenCops(FRAME_CAP), i);
  }
  const snapshot = session.snapshot();
  expect(snapshot.head).not.toBeNull();
  const json = expectObject(encodeSnapshot(scapeGoat, snapshot), "snapshot");
  // A tampered seed on a head-carrying snapshot fails the chain check.
  expect(() => decodeSnapshot(scapeGoat, { ...json, seed: genesisSeed("elsewhere") })).toThrow();

  // A self-consistent snapshot at the same frame over a divergent state: its own
  // seed chains from its own head, so decodeSnapshot accepts it, but a live
  // session that already holds the real head rejects it as a hard fork.
  const decoded = decodeSnapshot(scapeGoat, json);
  const state = scapeGoat.state.decode(decoded.state);
  const divergent = { ...state, stash: [...state.stash].reverse() };
  const divergentSeed = expectedSnapshotSeed(scapeGoat, decoded.head!, divergent);
  expect(divergentSeed).not.toBe(decoded.seed);
  expect(() =>
    session.receive({
      kind: "snapshot",
      snapshot: { ...decoded, state: scapeGoat.state.encode(divergent), seed: divergentSeed },
    }),
  ).toThrow();
});
