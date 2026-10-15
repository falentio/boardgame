import type { SeatId } from "../../index.ts";
import type { PowerId } from "./board.ts";
import { partyOf, type Party } from "./roles.ts";
import { activeSeats, roleOf, type SecretHitlerState } from "./state.ts";

/**
 * The seats a power may name, given the current state. One owner for the target
 * rules, read by both the reducer (to coerce an illegal target) and the view (to
 * build the menu). Investigate reads a party and may not repeat a target all game
 * [RB p5]; Special Election names any OTHER player [RB p5]; Execution names one
 * player [RB p5].
 */
export const legalPowerTargets = (state: SecretHitlerState, power: PowerId): readonly SeatId[] => {
  const active = activeSeats(state);
  switch (power) {
    case "policy-peek":
      return [];
    case "investigate-loyalty": {
      const seen = new Set(state.investigations.map((investigation) => investigation.target));
      return active.filter((seat) => !seen.has(seat));
    }
    case "special-election":
      return active.filter((seat) => seat !== state.president);
    case "execution":
      return active;
    default: {
      const exhausted: never = power;
      return exhausted;
    }
  }
};

/** The Party Membership card an investigation reads: Hitler's reads Fascist [RB p2, p5]. */
export const investigateParty = (state: SecretHitlerState, target: SeatId): Party =>
  partyOf(roleOf(state, target));
