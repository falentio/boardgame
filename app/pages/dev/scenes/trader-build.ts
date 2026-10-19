import { specOfDistrict } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, castWith, openPurpose, viewOf, type Scene } from "./kit.ts";

const NAMED = "trader";

/** The Trader opens this window before its gather, so wait for a trade card the hand can offer. */
const scene: Scene = {
  purpose: "trader-build",
  cast: castWith(NAMED),
  decide: (seat, state) =>
    openPurpose(state) === "draft-pick" ? { t: "pick", character: NAMED } : auto(seat, state),
  until: (state) => viewOf(state).myHand.some((id) => specOfDistrict(id).type === "trade"),
};

export default scene;
