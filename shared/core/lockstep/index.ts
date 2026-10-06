/**
 * Public surface of the lockstep primitive.
 *
 * The exports are grouped by who reaches for them:
 *
 * - **game author** — the `GameDefinition` contract and the frame/roster
 *   vocabulary a game's `genesis`/`step`/`seatsOwed`/`project` uses: `Codec`,
 *   `Frame`, `Roster`, `SeatInput`, `SeatReport`, `SeatStatus`, the `act`/`idle`/
 *   `resign` constructors, `makeRoster`, `activeSeats`, `orderSeats`,
 *   `rosterPosition`, and the `expect*`/`field` codec helpers.
 * - **app author** — the session engine and the two seams to implement:
 *   `createSession`, `resumeSession`, `Session`, `SessionDeps`, `SessionConfig`,
 *   `GenesisInput`, `Inbound`, `SessionPort`, `Clock`, the `Snapshot` codec, and
 *   the id smart constructors.
 * - **advanced / tooling** — pure primitives for tests, replay, and tooling that
 *   a game or app rarely needs: `advanceFrame`, `foldFrom`, `replayFromGenesis`,
 *   `genesisCheckpoint`, `buildFrame`, `isComplete`, `encodeFrame`/`decodeFrame`,
 *   `encodeSeatInput`/`decodeSeatInput`, `framePayload`, `encodeRoster`/`decodeRoster`,
 *   `emptyLog`, `appendFrame`,
 *   `head`, `genesisSeed`, `chainSeed`, `stateDigest`, `canonicalize`, `asJson`,
 *   `makeRandom`, and the `*Error` types.
 *
 * No transport or wire type appears anywhere on the surface.
 */

// --- game author -----------------------------------------------------------

export type { Json } from "./json.ts";
export { canonicalize, asJson, JsonError } from "./json.ts";

export type { Codec } from "./codec.ts";
export {
  CodecError,
  expectObject,
  expectArray,
  expectString,
  expectNumber,
  expectInteger,
  field,
} from "./codec.ts";

export type { Frame, Roster, SeatInput, SeatReport, SeatStatus } from "./frame.ts";
export {
  act,
  idle,
  resign,
  makeRoster,
  activeSeats,
  orderSeats,
  rosterPosition,
  FrameError,
} from "./frame.ts";

export type { GameDefinition } from "./game.ts";
export type { Random } from "./hash.ts";

export type { GameId, SeatId, FrameIndex, Seed } from "./ids.ts";
export { gameId, seatId, frameIndex, nextFrameIndex, seed, IdError } from "./ids.ts";

// --- app author ------------------------------------------------------------

export type { Session, SessionDeps, SessionConfig, GenesisInput, Inbound } from "./session.ts";
export { createSession, resumeSession, SessionError, MAX_PENDING_AHEAD } from "./session.ts";

export type { SessionPort, Clock } from "./port.ts";

export type { Snapshot } from "./snapshot.ts";
export { encodeSnapshot, decodeSnapshot, expectedSnapshotSeed, SnapshotError } from "./snapshot.ts";

// --- advanced / tooling ----------------------------------------------------

export { genesisSeed, chainSeed, stateDigest, makeRandom } from "./hash.ts";

export {
  isComplete,
  buildFrame,
  encodeFrame,
  decodeFrame,
  encodeSeatInput,
  decodeSeatInput,
  framePayload,
  withResigned,
} from "./frame.ts";

export type { FrameLog, Checkpoint } from "./log.ts";
export {
  emptyLog,
  appendFrame,
  head,
  advanceFrame,
  foldFrom,
  genesisCheckpoint,
  replayFromGenesis,
  LogError,
} from "./log.ts";

export { encodeRoster, decodeRoster } from "./snapshot.ts";
