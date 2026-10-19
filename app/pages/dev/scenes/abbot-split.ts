import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { citadels, specOfDistrict, type CitadelsState } from "#shared/core/lockstep/games/citadels/index.ts";
import type { SeatId } from "#shared/core/lockstep/index.ts";

const ABBOT = "abbot";

/** `auto` drafts whatever the pool offers first, so the Abbot needs naming there. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes(ABBOT)) {
    return { t: "pick", character: ABBOT };
  }
  return auto(seat, state);
};

/** A split over zero districts offers one row; wait for a city that can split. */
const until = (state: CitadelsState): boolean => {
  const top = state.steps[0];
  if (top === undefined || top.kind !== "window") return false;
  const owner: SeatId | undefined = top.window.seats[0];
  const city = state.players.find((player) => player.seat === owner)?.city ?? [];
  return city.some((district) => specOfDistrict(district.id).type === "religious");
};

const scene: Scene = { purpose: "abbot-split", cast: castWith(ABBOT), decide, until };

export default scene;
