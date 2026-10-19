import { BASE_CAST, citadels } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, type Decide, type Scene } from "./kit.ts";

/** Draw on every turn, so the hand fills and the turn's gather opens a keep. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  return view.window?.purpose === "turn" ? { t: "draw" } : auto(seat, state);
};

const scene: Scene = { purpose: "keep", cast: BASE_CAST, decide };

export default scene;
