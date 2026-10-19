import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";

const MAGICIAN = "magician";

/** `auto` names no rival at the swap, and declining it is what opens the discard. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes(MAGICIAN)) {
    return { t: "pick", character: MAGICIAN };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "magician-discard", cast: castWith(MAGICIAN), decide };

export default scene;
