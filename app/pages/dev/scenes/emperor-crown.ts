import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";

const EMPEROR = "emperor";

/** The handoff is this purpose's first stage; the gold-or-card reward reopens it. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "draft-pick" && view.cast.includes(EMPEROR)) {
    return { t: "pick", character: EMPEROR };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "emperor-crown", cast: castWith(EMPEROR), decide };

export default scene;
