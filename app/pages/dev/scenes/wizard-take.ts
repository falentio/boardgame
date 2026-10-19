import { auto, castWith, openPurpose, type Decide, type Scene } from "./kit.ts";
import type { SeatId } from "#shared/core/lockstep/index.ts";
import type { CitadelsState } from "#shared/core/lockstep/games/citadels/index.ts";

/** Stage two offers one control per card in the named hand, so name the fullest one. */
const fullestHand = (state: CitadelsState, seat: SeatId): SeatId | null =>
  state.players
    .filter((player) => player.seat !== seat)
    .sort((a, b) => b.hand.length - a.hand.length)[0]?.seat ?? null;

const decide: Decide = (seat, state) => {
  if (openPurpose(state) === "wizard-take" && state.pending?.target === null) {
    const target = fullestHand(state, seat);
    if (target !== null) return { t: "target", seat: target };
  }
  return auto(seat, state);
};

/** Stage one names the rival, stage two deals that rival's hand. */
const until = (state: CitadelsState): boolean => state.pending?.target != null;

const scene: Scene = { purpose: "wizard-take", cast: castWith("wizard"), decide, until };

export default scene;
