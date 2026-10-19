import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { citadels } from "#shared/core/lockstep/games/citadels/index.ts";

const MAGICIAN = "magician";

/** `auto` drafts whatever the pool offers first, so the Magician needs naming there. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  const window = view.window;
  if (window === null) return null;
  if (window.purpose === "draft-pick" && view.cast.includes(MAGICIAN)) {
    return { t: "pick", character: MAGICIAN };
  }
  if (window.purpose === "magician-swap") {
    const rival = view.players.find((player) => player.seat !== seat);
    return rival === undefined ? { t: "pass" } : { t: "target", seat: rival.seat };
  }
  return auto(seat, state);
};

const scene: Scene = { purpose: "magician-swap", cast: castWith(MAGICIAN), decide };

export default scene;
