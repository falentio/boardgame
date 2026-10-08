import type { Frame, SeatReport } from "./frame.ts";
import type { Snapshot } from "./snapshot.ts";

/**
 * The only transport seam. The app adapts its socket, bus, or test harness to
 * this interface; no wire type appears here. A report is emitted as soon as the
 * local seat offers it, and a frame as soon as the owed set is complete, so the
 * caller coordinates nothing.
 */
export interface SessionPort<A> {
  /** Emit the local seat's input for the open frame. */
  sendReport(report: SeatReport<A>): void;
  /** Broadcast one sealed, agreed frame to every other peer. */
  send(frame: Frame<A>): void;
  /** Hand a snapshot to a joining or lagging peer. */
  sendSnapshot(snapshot: Snapshot<A>): void;
}

/**
 * The only time seam. The primitive reads no ambient clock; `now()` is called
 * only inside `tick` and `remainingMs`.
 */
export interface Clock {
  now(): number;
}
