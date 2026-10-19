import { specOfCharacter } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, castWith, openPurpose, viewOf, type Decide, type Scene } from "./kit.ts";

const NAMED = "witch";

/**
 * The Witch's naming window is owed by every seat, so the arm reads the acting
 * character rather than the seat. Naming the lowest rank past hers puts the
 * bewitched turn next, so the resume follows it at once. No narrowing is needed:
 * only the takeover of a bewitched character opens this window.
 */
const decide: Decide = (seat, state) => {
  const purpose = openPurpose(state);
  if (purpose === "draft-pick") return { t: "pick", character: NAMED };
  if (purpose === "choose-character" && state.pending?.character === "witch") {
    const named = viewOf(state).cast.find((id) => specOfCharacter(id).rank > 1);
    return named === undefined ? null : { t: "name-character", character: named };
  }
  return auto(seat, state);
};

const scene: Scene = {
  purpose: "witch-resume",
  cast: castWith(NAMED),
  decide,
};

export default scene;
