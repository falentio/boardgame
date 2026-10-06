import {
  expectArray,
  expectInteger,
  expectObject,
  expectString,
  field,
  type Codec,
} from "./codec.ts";
import { frameIndex, seed, seatId, type FrameIndex, type SeatId, type Seed } from "./ids.ts";
import type { Json } from "./json.ts";

/**
 * One seat's report for one frame. Exactly one exists per owed seat per frame.
 * `idle` is a *positive* report — "I looked and chose to do nothing". Silence is
 * never `idle`: silence leaves the frame open. `resign` is an agreed control
 * input that drops the seat from every subsequent owed set.
 */
export type SeatInput<Action> =
  | { readonly kind: "act"; readonly action: Action }
  | { readonly kind: "idle" }
  | { readonly kind: "resign" };

export const act = <Action>(action: Action): SeatInput<Action> => ({ kind: "act", action });
export const idle = <Action>(): SeatInput<Action> => ({ kind: "idle" });
export const resign = <Action>(): SeatInput<Action> => ({ kind: "resign" });

/**
 * The unit of agreement. `inputs` is *total* — one entry per owed seat, ordered
 * by `Roster.order` — so the sealed frame is a pure function of the report set,
 * never of arrival order. `seed` is the seed the frame is stepped with.
 */
export interface Frame<Action> {
  readonly index: FrameIndex;
  readonly seed: Seed;
  readonly inputs: readonly (readonly [SeatId, SeatInput<Action>])[];
}

/** One seat's report for one frame, as it crosses between peers. */
export interface SeatReport<Action> {
  readonly frame: FrameIndex;
  readonly seat: SeatId;
  readonly input: SeatInput<Action>;
}

export type SeatStatus = "active" | "resigned";

/**
 * Who is expected to report each frame. `order` is the canonical seat order and
 * the tie-break for every in-frame resolution. Only `resign` shrinks the owed
 * set; elimination does not, because an eliminated seat keeps reporting `idle`.
 */
export interface Roster {
  readonly order: readonly SeatId[];
  readonly status: ReadonlyMap<SeatId, SeatStatus>;
}

export const makeRoster = (order: readonly SeatId[]): Roster => {
  if (order.length === 0) throw new FrameError("roster must have at least one seat");
  if (new Set(order).size !== order.length) throw new FrameError("roster seats must be unique");
  return {
    order,
    status: new Map(order.map((s): [SeatId, SeatStatus] => [s, "active"])),
  };
};

export const activeSeats = (roster: Roster): readonly SeatId[] =>
  roster.order.filter((s) => roster.status.get(s) === "active");

/** Fold a `resign`. `order` is unchanged so historical frames stay decodable. */
export const withResigned = (roster: Roster, seat: SeatId): Roster => {
  const status = new Map(roster.status);
  status.set(seat, "resigned");
  return { order: roster.order, status };
};

/** Rank of a seat in canonical order; the key for every deterministic sort. */
export const rosterPosition = (roster: Roster, seat: SeatId): number => {
  const position = roster.order.indexOf(seat);
  if (position < 0) throw new FrameError(`seat ${seat} is not in the roster`);
  return position;
};

/** Sort a set of seats into canonical order, dropping nothing. */
export const orderSeats = (roster: Roster, seats: readonly SeatId[]): readonly SeatId[] =>
  [...seats].sort((a, b) => rosterPosition(roster, a) - rosterPosition(roster, b));

/** True when every owed seat has reported. A predicate over a set, so order-blind. */
export const isComplete = <Action>(
  owed: readonly SeatId[],
  buffer: ReadonlyMap<SeatId, SeatInput<Action>>,
): boolean => owed.every((seat) => buffer.has(seat));

/**
 * Seal the frame. Only called once every owed seat has reported; `buffer` holds
 * exactly the owed seats at that point, so ordering by `roster.order` both
 * canonicalizes the inputs and excludes any stale entry.
 */
export const buildFrame = <Action>(
  roster: Roster,
  owed: readonly SeatId[],
  index: FrameIndex,
  seedValue: Seed,
  buffer: ReadonlyMap<SeatId, SeatInput<Action>>,
): Frame<Action> => {
  const inputs = orderSeats(roster, owed).map((seat): readonly [SeatId, SeatInput<Action>] => {
    const input = buffer.get(seat);
    if (input === undefined) {
      throw new FrameError(`frame ${String(index)} is missing a report for ${seat}`);
    }
    return [seat, input];
  });
  return { index, seed: seedValue, inputs };
};

/** Encode one seat input for a digest or a snapshot. */
export const encodeSeatInput = <Action>(input: SeatInput<Action>, codec: Codec<Action>): Json => {
  switch (input.kind) {
    case "act":
      return { k: "act", a: codec.encode(input.action) };
    case "idle":
      return { k: "idle" };
    case "resign":
      return { k: "resign" };
  }
};

export const decodeSeatInput = <Action>(json: Json, codec: Codec<Action>): SeatInput<Action> => {
  const object = expectObject(json, "seat input");
  const kind = expectString(field(object, "k"), "seat input kind");
  switch (kind) {
    case "act":
      return { kind: "act", action: codec.decode(field(object, "a")) };
    case "idle":
      return { kind: "idle" };
    case "resign":
      return { kind: "resign" };
    default:
      throw new FrameError(`unknown seat input kind: ${kind}`);
  }
};

/**
 * The payload hashed into the next seed. It covers only the agreed inputs, in
 * seat order, so every peer that holds the frame computes the same value.
 */
export const framePayload = <Action>(frame: Frame<Action>, codec: Codec<Action>): Json =>
  frame.inputs.map(([seat, input]): Json => ({ seat, input: encodeSeatInput(input, codec) }));

export const encodeFrame = <Action>(frame: Frame<Action>, codec: Codec<Action>): Json => ({
  index: frame.index,
  seed: frame.seed,
  inputs: framePayload(frame, codec),
});

export const decodeFrame = <Action>(json: Json, codec: Codec<Action>): Frame<Action> => {
  const object = expectObject(json, "frame");
  const inputs = expectArray(field(object, "inputs"), "frame inputs").map(
    (entry): readonly [SeatId, SeatInput<Action>] => {
      const pair = expectObject(entry, "frame input");
      return [
        seatId(expectString(field(pair, "seat"), "frame input seat")),
        decodeSeatInput(field(pair, "input"), codec),
      ];
    },
  );
  return {
    index: frameIndex(expectInteger(field(object, "index"), "frame index")),
    seed: seed(expectString(field(object, "seed"), "frame seed")),
    inputs,
  };
};

export class FrameError extends Error {
  override readonly name = "FrameError";
}
