import type { CharacterId } from "#shared/core/lockstep/games/citadels/index.ts";
import { auto, castWith, openPurpose, viewOf, type Scene } from "./kit.ts";

const NAMED = "scholar";

const cast: readonly CharacterId[] = [NAMED, ...castWith(NAMED).filter((id) => id !== NAMED)];

/**
 * The genesis deal slices its discards off fixed indices of the cast array as
 * given, and a rank-ordered cast puts the Scholar on one of those discards in
 * every later round's draft, so the genesis deal is the only one that can seat
 * it. Leading with it is what keeps the Scholar off that discard pile.
 */
const scene: Scene = {
  purpose: "scholar-keep",
  cast,
  decide: (seat, state) =>
    openPurpose(state) === "draft-pick" ? { t: "pick", character: NAMED } : auto(seat, state),
  until: (state) => viewOf(state).myDraw.length > 1,
};

export default scene;
