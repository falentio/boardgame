import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, castWith, type Decide, type Scene } from "./kit.ts";

/**
 * The Spy opens choose-seat first and choose-type second, so this scene answers the
 * seat window with a rival and the fold stops on the type window behind it.
 */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes("spy")) {
    return { t: "pick", character: "spy" };
  }
  const rival = view.players.find((player) => player.seat !== seat);
  if (view.window?.purpose === "choose-seat" && rival !== undefined) {
    return { t: "target", seat: rival.seat };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "choose-type", cast: castWith("spy"), decide };

export default scene;
