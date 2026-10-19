import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";

const SEER = "seer";

/** `auto` drafts whatever the pool offers first, so the Seer needs naming there. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes(SEER)) {
    return { t: "pick", character: SEER };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "seer-receive", cast: castWith(SEER), decide };

export default scene;
