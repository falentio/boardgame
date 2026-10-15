import {
  deadline,
  genesisSeed,
  makeRoster,
  seatId,
  type GenesisInput,
  type Roster,
  type SeatId,
} from "../core/lockstep/index.ts";
import type { RoomCode, UserId } from "../rooms/ids.ts";

export interface RoomSeatLike {
  readonly id: string;
  readonly occupant: UserId | null;
}

export const rosterFor = (seats: readonly RoomSeatLike[]): Roster =>
  makeRoster(seats.filter((seat) => seat.occupant !== null).map((seat) => seatId(seat.id)));

export const seatOf = (seats: readonly RoomSeatLike[], viewer: UserId): SeatId | null => {
  const seat = seats.find((candidate) => candidate.occupant === viewer);
  return seat === undefined ? null : seatId(seat.id);
};

export const occupantOf = (seats: readonly RoomSeatLike[], seat: SeatId): UserId | null => {
  const found = seats.find((candidate) => candidate.id === seat);
  return found === undefined ? null : found.occupant;
};

export interface RoomLike<Setup> {
  readonly code: RoomCode;
  readonly setup: Setup;
  readonly seats: readonly RoomSeatLike[];
  readonly startedAt: number | null;
}

export const genesisFor = <Setup>(room: RoomLike<Setup>): GenesisInput<Setup> => ({
  seed: genesisSeed(room.code),
  roster: rosterFor(room.seats),
  setup: room.setup,
  // A started room always has startedAt; 0 means no epoch, which the frame-0
  // guard turns into no deadline.
  startedAt: deadline(room.startedAt ?? 0),
});
