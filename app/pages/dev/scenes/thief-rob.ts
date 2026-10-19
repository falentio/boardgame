import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { canRob } from "#shared/core/lockstep/games/citadels/characters/thief.ts";
import { specOfCharacter, type CharacterId } from "#shared/core/lockstep/games/citadels/characters.ts";
import type { CitadelsState } from "#shared/core/lockstep/games/citadels/state.ts";
import type { SeatId } from "#shared/core/lockstep/index.ts";

/** The Thief is rank 2, so every claim above it is still owed a call this round. */
const OWN_RANK = specOfCharacter("thief").rank;

/** The highest-rank character another seat claimed that the Thief may still rob. */
const robbable = (state: CitadelsState, own: SeatId): CharacterId | null => {
  const claims = state.claimed
    .filter((claim) => claim.seat !== own && specOfCharacter(claim.character).rank > OWN_RANK && canRob(state, claim.character))
    .sort((a, b) => specOfCharacter(b.character).rank - specOfCharacter(a.character).rank);
  return claims[0]?.character ?? null;
};

/** A played table, so the recording opens on cities rather than a bare board. */
const builtUp = (state: CitadelsState): boolean =>
  state.players.some((player) => player.city.length >= 3);

/** The Thief names a character it can rob; the cursor opens thief-rob when that rank is called. */
const decide: Decide = (seat, state) => {
  const pending = state.pending;
  if (pending === null || pending.character !== "thief" || pending.actor !== seat) {
    return auto(seat, state);
  }
  const named = robbable(state, seat);
  return named === null ? null : { t: "name-character", character: named };
};

const scene: Scene = {
  purpose: "thief-rob",
  cast: castWith("thief"),
  decide,
  until: builtUp,
};

export default scene;
