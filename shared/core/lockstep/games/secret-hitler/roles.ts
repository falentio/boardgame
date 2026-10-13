import type { Random, SeatId } from "../../index.ts";
import { SecretHitlerError } from "./error.ts";

/** A party: what an investigation reads, and half of a role. */
export type Party = "liberal" | "fascist";

/** A secret role. Hitler's party is fascist, so there is no fourth party. */
export type Role = "liberal" | "fascist" | "hitler";

export type PlayerCount = 5 | 6 | 7 | 8 | 9 | 10;
export const MIN_SEATS = 5;
export const MAX_SEATS = 10;

/** Fascists including Hitler, per the rulebook's setup table [RB p2]. Liberals are the rest. */
export const FASCIST_TEAM: Readonly<Record<PlayerCount, number>> = {
  5: 2,
  6: 2,
  7: 3,
  8: 3,
  9: 4,
  10: 4,
};

/** The party an investigation reads: Hitler's Party Membership card reads Fascist [RB p2, p5]. */
export const partyOf = (role: Role): Party => (role === "liberal" ? "liberal" : "fascist");

export const isFascistTeam = (role: Role): boolean => role !== "liberal";

export const playerCountOf = (seats: number): PlayerCount => {
  if (seats < MIN_SEATS || seats > MAX_SEATS) {
    throw new SecretHitlerError(`secret-hitler needs 5 to 10 seats, got ${String(seats)}`);
  }
  return seats as PlayerCount;
};

/** The role multiset: exactly one Hitler, then ordinary Fascists, then Liberals [RB p2]. */
export const rolesFor = (count: PlayerCount): readonly Role[] => {
  const team = FASCIST_TEAM[count];
  return [
    "hitler",
    ...Array<Role>(team - 1).fill("fascist"),
    ...Array<Role>(count - team).fill("liberal"),
  ];
};

export interface SeatRole {
  readonly seat: SeatId;
  readonly role: Role;
}

/** One shuffle assigns the whole multiset to seats in canonical order. */
export const dealRoles = (
  order: readonly SeatId[],
  count: PlayerCount,
  rng: Random,
): readonly SeatRole[] => {
  const roles = rng.shuffle(rolesFor(count));
  return order.map((seat, index) => ({ seat, role: roles[index] ?? "liberal" }));
};

/**
 * The seats whose roles `viewer` learns at setup [RB p2, p3]. An ordinary Fascist
 * sees every other Fascist and Hitler at every count. Hitler sees the Fascists only
 * in a 5-6 game and nobody at 7-10. A Liberal sees nobody.
 */
export const knownAllies = (roles: readonly SeatRole[], viewer: SeatId): readonly SeatId[] => {
  const me = roles.find((entry) => entry.seat === viewer);
  if (me === undefined || me.role === "liberal") return [];
  const others = roles.filter((entry) => entry.seat !== viewer && isFascistTeam(entry.role));
  if (me.role === "fascist") return others.map((entry) => entry.seat);
  if (roles.length > 6) return [];
  return others.filter((entry) => entry.role === "fascist").map((entry) => entry.seat);
};
