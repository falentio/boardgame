import { auto, castWith, type Decide, type Scene } from "./kit.ts";
import { canBewitch } from "#shared/core/lockstep/games/citadels/characters/witch.ts";
import { specOfCharacter, type CharacterId } from "#shared/core/lockstep/games/citadels/characters.ts";
import type { CitadelsState } from "#shared/core/lockstep/games/citadels/state.ts";
import type { SeatId } from "#shared/core/lockstep/index.ts";

/** The Witch is rank 1: she bewitches before any other rank takes its turn. */
const OWN_RANK = specOfCharacter("witch").rank;

/** The highest-rank character another seat claimed that the Witch may bewitch. */
const bewitchable = (state: CitadelsState, own: SeatId): CharacterId | null => {
  const claims = state.claimed
    .filter((claim) => claim.seat !== own && specOfCharacter(claim.character).rank > OWN_RANK && canBewitch(state, claim.character))
    .sort((a, b) => specOfCharacter(b.character).rank - specOfCharacter(a.character).rank);
  return claims[0]?.character ?? null;
};

/** A played table, so the recording opens on cities rather than a bare board. */
const builtUp = (state: CitadelsState): boolean =>
  state.players.some((player) => player.city.length >= 3);

/** The Witch bewitches a rival's character; the cursor opens witch-takeover when it is called. */
const decide: Decide = (seat, state) => {
  const pending = state.pending;
  if (pending === null || pending.character !== "witch" || pending.actor !== seat) {
    return auto(seat, state);
  }
  const named = bewitchable(state, seat);
  return named === null ? null : { t: "name-character", character: named };
};

const scene: Scene = {
  purpose: "witch-takeover",
  cast: castWith("witch"),
  decide,
  until: builtUp,
};

export default scene;
