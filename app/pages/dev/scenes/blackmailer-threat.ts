import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { canThreat } from "#shared/core/lockstep/games/citadels/characters/blackmailer.ts";
import { specOfCharacter, type CharacterId } from "#shared/core/lockstep/games/citadels/characters.ts";
import type { CitadelsState } from "#shared/core/lockstep/games/citadels/state.ts";
import type { SeatId } from "#shared/core/lockstep/index.ts";

/** The Blackmailer is rank 2, so every claim above it is still owed a call this round. */
const OWN_RANK = specOfCharacter("blackmailer").rank;

/** The strongest unspent marker: the highest-rank rival claim the cursor still owes. */
const nextMarker = (state: CitadelsState, own: SeatId): CharacterId | null => {
  const claims = state.claimed
    .filter((claim) => claim.seat !== own && specOfCharacter(claim.character).rank > OWN_RANK && canThreat(state, claim.character, state.threats ?? []))
    .sort((a, b) => specOfCharacter(b.character).rank - specOfCharacter(a.character).rank);
  return claims[0]?.character ?? null;
};

/** A played table, so the recording opens on cities rather than a bare board. */
const builtUp = (state: CitadelsState): boolean =>
  state.players.some((player) => player.city.length >= 3);

/** The Blackmailer marks two rivals; the threatened one's turn opens blackmailer-threat. */
const decide: Decide = (seat, state) => {
  const pending = state.pending;
  if (pending === null || pending.character !== "blackmailer" || pending.actor !== seat) {
    return auto(seat, state);
  }
  const named = nextMarker(state, seat);
  return named === null ? null : { t: "name-character", character: named };
};

const scene: Scene = {
  purpose: "blackmailer-threat",
  cast: castWith("blackmailer"),
  decide,
  until: builtUp,
};

export default scene;
