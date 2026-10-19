import { auto, type Decide, type Scene } from "./kit.ts";
import {
  BASE_CAST,
  CITY_TARGET,
  citadels,
  specOfDistrict,
} from "#shared/core/lockstep/games/citadels/index.ts";

const THEATER = "theater";

/** Carry the Theater: build it once it is affordable, and bank gold for it until then. */
const playTurn: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose !== "turn") return auto(seat, state);
  const me = view.players.find((player) => player.seat === seat);
  if (me === undefined || me.city.length >= CITY_TARGET) return auto(seat, state);
  const held = view.myHand.indexOf(THEATER);
  if (held < 0) return auto(seat, state);
  return specOfDistrict(THEATER).cost <= me.gold ? { t: "build", card: held } : { t: "gold" };
};

/** The window's one stage: name the rival seat to swap a character with. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose !== "theatre-swap") return playTurn(seat, state);
  const rival = view.players.find((player) => player.seat !== seat);
  return rival === undefined ? null : { t: "target", seat: rival.seat };
};

/**
 * Blocked at the deck, not at the cast. The Theater is a catalog district but
 * not one of `DEFAULT_UNIQUES`, and a scene names a cast, never a unique set, so
 * no fold from `genesis` can deal it into a hand and no city can ever carry it.
 * This scene's fold throws the engine's own "reached no theatre-swap window";
 * the district reaches a game through `CitadelsSetup.uniques`, which the scene
 * contract does not expose.
 */
const scene: Scene = { purpose: "theatre-swap", cast: BASE_CAST, decide };

export default scene;
