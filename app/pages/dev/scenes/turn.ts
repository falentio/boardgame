import { BASE_CAST, type CitadelsState } from "#shared/core/lockstep/games/citadels/index.ts";
import { viewOf, type Scene } from "./kit.ts";

/** A played board, not the opening turn: a city that has taken a third district. */
const until = (state: CitadelsState): boolean =>
  viewOf(state).players.some((player) => player.city.length >= 3);

const scene: Scene = { purpose: "turn", cast: BASE_CAST, until };

export default scene;
