import {
  gameId,
  type Frame,
  type FrameIndex,
  type GameDefinition,
  type Random,
  type Roster,
  type SeatId,
} from "../../index.ts";
import { actionCodec, type ScapeGoatAction } from "./actions.ts";
import { genesisState, type ScapeGoatSetup } from "./setup.ts";
import { isTerminal, seatsOwed, step } from "./reducer.ts";
import { stateCodec, type ScapeGoatState } from "./state.ts";
import { project, type ScapeGoatView } from "./view.ts";

export { ScapeGoatError } from "./error.ts";
export type { ScapeGoatAction } from "./actions.ts";
export type { ScapeGoatSetup } from "./setup.ts";
export { validateSetup } from "./setup.ts";
export {
  COLOURS,
  MAX_SEATS,
  MIN_SEATS,
  STASH_SLOTS,
  cardId,
  suspectOf,
  type CardId,
  type Colour,
  type Destination,
  type FrameRecord,
  type FrameReveal,
  type Location,
  type Outcome,
  type Phase,
  type PlayerCount,
  type PlayerState,
  type PrepTokensRemaining,
  type ScapeGoatState,
  type SpyRecord,
  type StashSlot,
} from "./state.ts";
export { EVIDENCE_CARDS, HAND_SIZE, coloursOf, deckFor, type CardFace } from "./cards.ts";
export { LOCATION_ACTIONS, LOCATION_LINE, faceOf, type LocationFace } from "./locations.ts";
export {
  activeSeats,
  antipodeOf,
  colourOfSeat,
  findPlayer,
  isTerminal,
  moveOwed,
  outcomeOf,
  resolveFrame,
  seatsOwed,
  seatsOwedNow,
  step,
} from "./reducer.ts";
export {
  allSuspects,
  legalActions,
  project,
  winnersOf,
  type OutcomeView,
  type PlayerView,
  type ScapeGoatView,
  type SpyView,
} from "./view.ts";

/**
 * Scape Goat: 3–6 seats, one hidden scapegoat, and a turn of move, act, and
 * evidence swap. The whole turn is one phase union, so `seatsOwed` and `step`
 * are exhaustive switches and a new phase kind is a compile error in both.
 *
 * The card mix is a module constant, not lobby config: two peers cannot disagree
 * about the deck by agreeing on a bad setup. Every shuffle and draw happens once
 * in `genesis`, so `step` ignores `rng` and determinism rests on structure.
 */
export const scapeGoat: GameDefinition<
  ScapeGoatState,
  ScapeGoatAction,
  ScapeGoatSetup,
  ScapeGoatView
> = {
  id: gameId("scape-goat"),
  version: 1,
  state: stateCodec,
  action: actionCodec,

  genesis(setup: ScapeGoatSetup, roster: Roster, rng: Random): ScapeGoatState {
    return genesisState(setup, roster, rng);
  },

  seatsOwed(state: ScapeGoatState, index: FrameIndex): readonly SeatId[] {
    return seatsOwed(state, index);
  },

  step(state: ScapeGoatState, frame: Frame<ScapeGoatAction>, rng: Random): ScapeGoatState {
    return step(state, frame, rng);
  },

  project(state: ScapeGoatState, seat: SeatId): ScapeGoatView {
    return project(state, seat);
  },

  isTerminal(state: ScapeGoatState): boolean {
    return isTerminal(state);
  },
};

