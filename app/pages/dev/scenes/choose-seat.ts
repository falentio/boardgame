import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, castWith, type Decide, type Scene } from "./kit.ts";

/** Draft the Spy, the only character that opens the seat pick, then hand it to auto. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes("spy")) {
    return { t: "pick", character: "spy" };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "choose-seat", cast: castWith("spy"), decide };

export default scene;
