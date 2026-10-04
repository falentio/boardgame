import { frameIndex, nextFrameIndex, type GameId, type FrameIndex, type Seed } from "./ids.ts";
import { framePayload, withResigned, type Frame, type Roster } from "./frame.ts";
import type { GameDefinition } from "./game.ts";
import { chainSeed, makeRandom, stateDigest } from "./hash.ts";

/**
 * The agreed log: the ordered frames every peer folds. Append-only and gap-free
 * by construction — frame N+1 may only be appended when the log ends at frame N
 * — which is what makes replay a plain left fold. `base` is the index of
 * `frames[0]`, so a frame's index is `base + position` with no extra bookkeeping.
 */
export interface FrameLog<A> {
  readonly gameId: GameId;
  readonly base: FrameIndex;
  readonly frames: readonly Frame<A>[];
}

export const emptyLog = <A>(gameId: GameId, base: FrameIndex = frameIndex(0)): FrameLog<A> => ({
  gameId,
  base,
  frames: [],
});

export const appendFrame = <A>(log: FrameLog<A>, frame: Frame<A>): FrameLog<A> => {
  const expected = frameIndex(log.base + log.frames.length);
  if (frame.index !== expected) {
    throw new LogError(`log gap: expected frame ${String(expected)}, got ${String(frame.index)}`);
  }
  return { gameId: log.gameId, base: log.base, frames: [...log.frames, frame] };
};

export const head = <A>(log: FrameLog<A>): Frame<A> | null => log.frames.at(-1) ?? null;

/**
 * Everything the fold carries: game state, roster, the next frame index, and the
 * seed that frame is stepped with. A snapshot is exactly this value with the
 * state encoded, which is why resume and replay share one representation.
 */
export interface Checkpoint<S> {
  readonly state: S;
  readonly roster: Roster;
  readonly frame: FrameIndex;
  readonly seed: Seed;
}

/**
 * Fold one agreed frame onto a checkpoint. Pure. Applies the game's `step`, folds
 * `resign` control inputs into the roster, and derives the next seed from the
 * frame's agreed inputs *and the state it produced*, so the chain is
 * reproducible by every peer and any state divergence breaks the next link.
 */
export const advanceFrame = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  checkpoint: Checkpoint<S>,
  frame: Frame<A>,
): Checkpoint<S> => {
  if (frame.index !== checkpoint.frame) {
    throw new LogError(
      `out-of-order frame: expected ${String(checkpoint.frame)}, got ${String(frame.index)}`,
    );
  }
  const state = game.step(checkpoint.state, frame, makeRandom(frame.seed));
  let roster = checkpoint.roster;
  for (const [seat, input] of frame.inputs) {
    if (input.kind === "resign") roster = withResigned(roster, seat);
  }
  return {
    state,
    roster,
    frame: nextFrameIndex(frame.index),
    seed: chainSeed(
      frame.seed,
      frame.index,
      framePayload(frame, game.action),
      stateDigest(game.state.encode(state)),
    ),
  };
};

/** Fold a log onto a checkpoint. Pure; this is the whole load story at one base. */
export const foldFrom = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  start: Checkpoint<S>,
  log: FrameLog<A>,
): Checkpoint<S> => {
  let checkpoint = start;
  for (const frame of log.frames) checkpoint = advanceFrame(game, checkpoint, frame);
  return checkpoint;
};

export const genesisCheckpoint = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  genesis: { readonly seed: Seed; readonly roster: Roster; readonly setup: Setup },
): Checkpoint<S> => ({
  state: game.genesis(genesis.setup, genesis.roster, makeRandom(genesis.seed)),
  roster: genesis.roster,
  frame: frameIndex(0),
  seed: genesis.seed,
});

/** Fold a whole log from genesis. The no-snapshot load path. */
export const replayFromGenesis = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  genesis: { readonly seed: Seed; readonly roster: Roster; readonly setup: Setup },
  log: FrameLog<A>,
): Checkpoint<S> => foldFrom(game, genesisCheckpoint(game, genesis), log);

export class LogError extends Error {
  override readonly name = "LogError";
}
