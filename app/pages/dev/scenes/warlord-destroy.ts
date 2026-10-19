import type { SeatId } from "#shared/rooms/ids.ts";
import type { CitadelsState, Pending } from "#shared/core/lockstep/games/citadels/state.ts";
import { windowChoicesFor } from "@/composables/window-choices.ts";
import { auto, castWith, NAMES, openPurpose, viewOf, type Decide, type Scene } from "./kit.ts";

const NAMED = "warlord";

const nameOf = (seat: SeatId): string => NAMES.get(seat) ?? seat;

/**
 * The offer runs in two stages: name the owner whose district falls, then pick
 * the district at one less than its price. The control list the surface draws is
 * the honest test of whether stage two has a district to offer, so it is what
 * the target choice and the recording both read.
 */
const districtsOffered = (state: CitadelsState, pending: Pending, target: SeatId): number =>
  windowChoicesFor(viewOf({ ...state, pending: { ...pending, target } }), nameOf).filter(
    (choice) => choice.kind === "district",
  ).length;

const decide: Decide = (seat, state) => {
  const purpose = openPurpose(state);
  if (purpose === "draft-pick") return { t: "pick", character: NAMED };
  const pending = state.pending;
  if (purpose === "warlord-destroy" && pending !== null && pending.target === null) {
    const target = state.players
      .map((player) => player.seat)
      .find((candidate) => districtsOffered(state, pending, candidate) > 0);
    return target === undefined ? null : { t: "target", seat: target };
  }
  return auto(seat, state);
};

const scene: Scene = {
  purpose: "warlord-destroy",
  cast: castWith(NAMED),
  decide,
  until: (state) => {
    const pending = state.pending;
    return (
      pending !== null &&
      pending.target !== null &&
      windowChoicesFor(viewOf(state), nameOf).some((choice) => choice.kind === "district")
    );
  },
};

export default scene;
