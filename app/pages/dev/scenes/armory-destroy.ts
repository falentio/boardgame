import { auto, type Decide, type Scene } from "./kit.ts";
import {
  BASE_CAST,
  CITY_TARGET,
  citadels,
  specOfDistrict,
} from "#shared/core/lockstep/games/citadels/index.ts";

const ARMORY = "armory";

/** Carry the Armory: build it once it is affordable, and bank gold for it until then. */
const playTurn: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose !== "turn") return auto(seat, state);
  const me = view.players.find((player) => player.seat === seat);
  if (me === undefined || me.city.length >= CITY_TARGET) return auto(seat, state);
  const held = view.myHand.indexOf(ARMORY);
  if (held < 0) return auto(seat, state);
  return specOfDistrict(ARMORY).cost <= me.gold ? { t: "build", card: held } : { t: "gold" };
};

/** The window's first stage: name a rival whose city holds a district to destroy. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose !== "armory-destroy") return playTurn(seat, state);
  const rival = view.players.find(
    (player) => player.seat !== seat && player.city.length > 0 && player.city.length < CITY_TARGET,
  );
  return rival === undefined ? null : { t: "target", seat: rival.seat };
};

/** The fold holds on the pick, so the recording shows the rival's district falling. */
const scene: Scene = {
  purpose: "armory-destroy",
  cast: BASE_CAST,
  decide,
  until: (state) => state.pending?.target !== null,
};

export default scene;
