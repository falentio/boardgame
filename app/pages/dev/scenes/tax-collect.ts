import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, castWith, openPurpose, type Scene } from "./kit.ts";

const NAMED = "tax-collector";

const cast: readonly CharacterId[] = [NAMED, ...castWith(NAMED).filter((id) => id !== NAMED)];

/**
 * Same genesis rule as the Scholar's scene: the deal discards fixed indices of
 * the cast array as given, and the rank-ordered cast discards the ninth of it in
 * every later round, so the genesis deal is the only one that can seat the Tax
 * Collector. The token has been charged by every build before rank 9 is called.
 */
const scene: Scene = {
  purpose: "tax-collect",
  cast,
  decide: (seat, state) =>
    openPurpose(state) === "draft-pick" ? { t: "pick", character: NAMED } : auto(seat, state),
  until: (state) => (state.taxPot ?? 0) > 0,
};

export default scene;
