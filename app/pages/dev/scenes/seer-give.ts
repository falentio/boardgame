import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";

const SEER = "seer";

/** The give window lands once every rival's take resolves; only the draft needs steering. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes(SEER)) {
    return { t: "pick", character: SEER };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "seer-give", cast: castWith(SEER), decide };

export default scene;
