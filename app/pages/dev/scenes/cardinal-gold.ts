import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { seatHolding } from "#shared/core/lockstep/games/citadels/helpers.ts";
import {
  citadels,
  specOfDistrict,
  type CitadelsState,
} from "#shared/core/lockstep/games/citadels/index.ts";

/** Build a card the purse cannot cover, so the shortfall offer opens above the retry. */
const decide: Decide = (seat, state) => {
  const view = citadels.project(state, seat);
  if (view.window?.purpose === "turn" && seatHolding(state, "cardinal") === seat) {
    const purse = view.players.find((player) => player.seat === seat)?.gold ?? 0;
    const over = view.myHand.findIndex((id) => specOfDistrict(id).cost > purse);
    if (over >= 0) return { t: "build", card: over };
  }
  return auto(seat, state);
};

/** The build pass carries the gap it must cover; the income pass carries a zero. */
const until = (state: CitadelsState): boolean => (state.pending?.amount ?? 0) > 0;

const scene: Scene = { purpose: "cardinal-gold", cast: castWith("cardinal"), decide, until };

export default scene;
