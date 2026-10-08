import {
  expectArray,
  expectInteger,
  expectNumber,
  expectObject,
  expectString,
  field,
} from "./codec.ts";
import {
  decodeFrame,
  encodeFrame,
  framePayload,
  makeRoster,
  type Frame,
  type Roster,
  type SeatStatus,
} from "./frame.ts";
import { chainSeed, stateDigest } from "./hash.ts";
import {
  deadline as toDeadline,
  frameIndex,
  gameId as toGameId,
  seed as toSeed,
  seatId,
  type Deadline,
  type GameId,
  type FrameIndex,
  type Seed,
  type SeatId,
} from "./ids.ts";
import type { Json } from "./json.ts";
import type { GameDefinition } from "./game.ts";

/**
 * A self-contained checkpoint. A snapshot carries everything the fold needs —
 * roster, frame index, seed, and encoded state — so a joiner adopts it in O(1)
 * with no replay. `head` is the last agreed frame, kept so a rejoiner can verify
 * continuity. `state` is encoded, never raw: the raw state stays inside a session.
 */
export interface Snapshot<A> {
  readonly gameId: GameId;
  readonly version: number;
  readonly frame: FrameIndex;
  /** Seed for frame `frame`, the next frame to be built. */
  readonly seed: Seed;
  readonly roster: Roster;
  readonly state: Json;
  readonly head: Frame<A> | null;
  /** The instant the open frame times out, or null for no deadline. Never hashed. */
  readonly deadline: Deadline | null;
}

/**
 * Encode a roster. Every seat in `order` carries exactly one status entry, so
 * `decodeRoster(encodeRoster(r))` is the identity on any roster built by
 * `makeRoster`/`withResigned` (which always status every seat).
 */
export const encodeRoster = (roster: Roster): Json => ({
  order: roster.order,
  status: roster.order.map((seat): Json => {
    const status = roster.status.get(seat);
    if (status === undefined) {
      throw new SnapshotError(`roster is missing a status for seat ${seat}`);
    }
    return [seat, status];
  }),
});

/**
 * Decode a roster and re-impose every `makeRoster` invariant on untrusted input:
 * a non-empty, duplicate-free `order`; no `status` entry for a seat outside
 * `order`; and a `status` that covers every seat in `order` exactly once. This
 * closes the path where a wire roster fabricates seats the game never agreed to.
 */
export const decodeRoster = (json: Json): Roster => {
  const object = expectObject(json, "roster");
  const order = expectArray(field(object, "order"), "roster order").map((entry) =>
    seatId(expectString(entry, "roster seat")),
  );
  // Reuse `makeRoster` for the order invariants (non-empty, unique) rather than
  // duplicating them; rewrap its error so callers see one error type from this
  // module. Its all-active status is discarded below.
  try {
    makeRoster(order);
  } catch (error) {
    throw new SnapshotError(error instanceof Error ? error.message : "invalid roster order");
  }
  const inOrder = new Set(order);
  const status = new Map<SeatId, SeatStatus>();
  for (const entry of expectArray(field(object, "status"), "roster status")) {
    const pair = expectArray(entry, "roster status entry");
    if (pair.length !== 2) {
      throw new SnapshotError("roster status entry must be a [seat, status] pair");
    }
    const seat = seatId(expectString(pair[0]!, "roster status seat"));
    if (!inOrder.has(seat)) {
      throw new SnapshotError(`roster status names seat ${seat}, which is not in the order`);
    }
    if (status.has(seat)) {
      throw new SnapshotError(`roster status names seat ${seat} more than once`);
    }
    const rawStatus = expectString(pair[1]!, "roster status value");
    if (rawStatus !== "active" && rawStatus !== "resigned") {
      throw new SnapshotError(`unknown roster status: ${rawStatus}`);
    }
    status.set(seat, rawStatus);
  }
  for (const seat of order) {
    if (!status.has(seat)) {
      throw new SnapshotError(`roster status does not cover seat ${seat}`);
    }
  }
  return { order, status };
};

/**
 * Serialize a session snapshot to a JSON-safe domain value. The app encodes this
 * to its transport; the primitive never sees a wire type. Validation lives at
 * `decodeSnapshot` only, so the running engine trusts its own types.
 */
export const encodeSnapshot = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  snapshot: Snapshot<A>,
): Json => ({
  gameId: snapshot.gameId,
  version: snapshot.version,
  frame: snapshot.frame,
  seed: snapshot.seed,
  roster: encodeRoster(snapshot.roster),
  state: snapshot.state,
  head: snapshot.head === null ? null : encodeFrame(snapshot.head, game.action),
  deadline: snapshot.deadline,
});

/**
 * The seed that a snapshot whose head is `head` and whose decoded state is
 * `state` must carry: the chain link from the head, committed to the state the
 * head produced. Shared by `decodeSnapshot` and the session so the two agree on
 * what "chains" means.
 */
export const expectedSnapshotSeed = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  head: Frame<A>,
  state: S,
): Seed =>
  chainSeed(
    head.seed,
    head.index,
    framePayload(head, game.action),
    stateDigest(game.state.encode(state)),
  );

/**
 * Parse a snapshot from untrusted Json. Rejects a mismatched game id or version,
 * a malformed roster, a head whose index disagrees with `frame`, state that fails
 * the game's codec, and a `seed` that does not chain from `head` over the state
 * the snapshot carries. `state` is passed through untouched: the codec is the
 * single validator for it.
 *
 * The seed check is the state-convergence check: a peer that folded the same
 * frames but reached different state cannot produce a snapshot whose seed chains
 * from `head`, so a divergent snapshot is rejected at this boundary rather than
 * adopted.
 */
export const decodeSnapshot = <S, A, Setup, View>(
  game: GameDefinition<S, A, Setup, View>,
  json: Json,
): Snapshot<A> => {
  const object = expectObject(json, "snapshot");
  const snapshotGameId = toGameId(expectString(field(object, "gameId"), "snapshot gameId"));
  if (snapshotGameId !== game.id) {
    throw new SnapshotError(`snapshot is for game ${snapshotGameId}, not ${game.id}`);
  }
  const version = expectInteger(field(object, "version"), "snapshot version");
  if (version !== game.version) {
    throw new SnapshotError(
      `snapshot is version ${String(version)}, expected ${String(game.version)}`,
    );
  }
  const frame = frameIndex(expectInteger(field(object, "frame"), "snapshot frame"));
  const seed = toSeed(expectString(field(object, "seed"), "snapshot seed"));
  const roster = decodeRoster(field(object, "roster"));
  const headJson = field(object, "head");
  const head = headJson === null ? null : decodeFrame(headJson, game.action);
  const rawDeadline = field(object, "deadline");
  const deadlineValue =
    rawDeadline === null ? null : toDeadline(expectNumber(rawDeadline, "snapshot deadline"));
  // Validate the encoded state eagerly so a corrupt snapshot fails at the
  // boundary rather than inside a later fold, and so the digest below is taken
  // over the codec's canonical form (not an attacker-shaped wire value).
  const stateJson = field(object, "state");
  const state = game.state.decode(stateJson);
  if (head === null) {
    // Genesis: no head to chain from, so the seed is the agreed lobby seed and
    // the frame must be 0.
    if (frame !== 0) {
      throw new SnapshotError(
        `snapshot has no head but frame ${String(frame)}; a headless snapshot must be frame 0`,
      );
    }
  } else {
    if (head.index + 1 !== frame) {
      throw new SnapshotError(
        `snapshot head index ${String(head.index)} does not precede frame ${String(frame)}`,
      );
    }
    if (seed !== expectedSnapshotSeed(game, head, state)) {
      throw new SnapshotError(`snapshot seed does not chain from its head over the carried state`);
    }
  }
  return {
    gameId: snapshotGameId,
    version,
    frame,
    seed,
    roster,
    state: stateJson,
    head,
    deadline: deadlineValue,
  };
};

export class SnapshotError extends Error {
  override readonly name = "SnapshotError";
}
