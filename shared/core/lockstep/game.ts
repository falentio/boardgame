import type { Codec } from "./codec.ts";
import type { Frame, Roster } from "./frame.ts";
import type { Random } from "./hash.ts";
import type { FrameIndex, GameId, SeatId } from "./ids.ts";

/**
 * The one thing a game supplies. The primitive never learns what a role, a
 * challenge, or a deck is; it only folds frames and asks the game who is owed
 * and what a frame does. `project` is the redaction boundary: the raw `State`
 * never leaves the session except through it.
 */
export interface GameDefinition<S, A, Setup, View> {
  /** Stable id, checked against an inbound snapshot so mismatched peers reject. */
  readonly id: GameId;
  /** Bumped whenever `step`/`seatsOwed` change meaning; checked like `id`. */
  readonly version: number;

  readonly state: Codec<S>;
  readonly action: Codec<A>;

  /** Deterministic from `(setup, roster, rng)`. The deck is shuffled here, once. */
  genesis(setup: Setup, roster: Roster, rng: Random): S;

  /**
   * Which seats owe an input in frame `index`. A turn returns one seat; a
   * challenge window returns every seat that may respond. The session never
   * advances a frame until each owed seat has reported (or the local timeout
   * fills `idle` for the local seat only).
   *
   * Contract: this must not return an empty set while `isTerminal(state)` is
   * false. An empty owed set is vacuously "complete", so the session would seal
   * empty frames forever, spinning the frame index with no progress; it treats
   * that as a hard `SessionError` instead. A game whose play can end early (for
   * example every seat resigning) must fold that into `isTerminal` and return a
   * terminal state, not an empty owed set.
   */
  seatsOwed(state: S, index: FrameIndex): readonly SeatId[];

  /** The pure fold. `rng` comes from `frame.seed`; no ambient entropy is allowed. */
  step(state: S, frame: Frame<A>, rng: Random): S;

  /** The read boundary. Returns `seat`'s view with hidden information removed. */
  project(state: S, seat: SeatId): View;

  /** Pure. Once true the session stops advancing and accepts no further input. */
  isTerminal(state: S): boolean;
}
