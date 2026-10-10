import {
  gameId,
  type Frame,
  type FrameIndex,
  type GameDefinition,
  type Random,
  type Roster,
  type SeatId,
} from "../../index.ts";
import { actionCodec, type CitadelsAction } from "./actions.ts";
import { type CharacterId } from "./characters.ts";
import { type DistrictId, type DistrictType } from "./districts.ts";
import { CitadelsError } from "./error.ts";
import { hasSeat } from "./helpers.ts";
import { winnerOf } from "./scoring.ts";
import { genesisState, type CitadelsSetup } from "./setup.ts";
import { stateCodec, type CitadelsState, type Phase, type WindowPurpose } from "./state.ts";
import { isTerminal, openWindow, seatsOwedFor, seatsOwedNow, stepState } from "./windows.ts";

export { CitadelsError } from "./error.ts";
export type { CitadelsAction } from "./actions.ts";
export type { CitadelsSetup } from "./setup.ts";
export type { CitadelsState, CitadelsPlayer, PlacedDistrict, Phase } from "./state.ts";
export type { CharacterId, CharacterSpec, Rank } from "./characters.ts";
export type { DistrictId, DistrictSpec, DistrictType } from "./districts.ts";
export { CHARACTER_CATALOG, BASE_CAST, charactersOfRank, specOfCharacter } from "./characters.ts";
export { DISTRICT_CATALOG, BASIC_DISTRICTS, UNIQUE_DISTRICTS, specOfDistrict } from "./districts.ts";
export { scoreGame, winnerOf, type Score } from "./scoring.ts";
export { STARTING_GOLD, STARTING_HAND, CITY_TARGET, validateCast } from "./setup.ts";

/** A player as it appears in a redacted view: counts and the public city, never the hand. */
export interface PlayerView {
  readonly seat: SeatId;
  readonly gold: number;
  readonly handCount: number;
  readonly city: readonly { readonly id: DistrictId; readonly gold: number }[];
}

export interface WindowView {
  readonly kind: "turn" | "any" | "oneOf" | "targets";
  readonly purpose: WindowPurpose;
}

/** The character action in flight as a view sees it: the named picks stay hidden. */
export interface PendingView {
  readonly actor: SeatId;
  readonly character: CharacterId | null;
  readonly target: SeatId | null;
  readonly cards: number;
}

/**
 * What one seat may see. Hidden information — the district deck and every other
 * seat's hand — never crosses this boundary. Public information is the cast, the
 * cities, gold, the crown, the round, the open window, and the faceup discards.
 */
export interface CitadelsView {
  readonly seat: SeatId;
  readonly cast: readonly CharacterId[];
  readonly players: readonly PlayerView[];
  /** Only the viewer's own hand. */
  readonly myHand: readonly DistrictId[];
  readonly crown: SeatId;
  readonly round: number;
  readonly phase: Phase;
  readonly callRank: number;
  readonly active: SeatId;
  /** The faceup discard pile; the hidden facedown discards are never present. */
  readonly discard: readonly DistrictId[];
  /** How many cards remain in the hidden deck; its size is public, its order is not. */
  readonly deckCount: number;
  readonly faceup: readonly CharacterId[];
  readonly owedSeats: readonly SeatId[];
  readonly window: WindowView | null;
  readonly pending: PendingView | null;
  /** The viewer's own pick this draft, or null once the draft has closed. */
  readonly myPick: CharacterId | null;
  readonly winner: SeatId | null;
  readonly terminal: boolean;
}

export const citadels: GameDefinition<CitadelsState, CitadelsAction, CitadelsSetup, CitadelsView> = {
  id: gameId("citadels"),
  version: 1,
  state: stateCodec,
  action: actionCodec,

  genesis(setup: CitadelsSetup, roster: Roster, rng: Random): CitadelsState {
    return genesisState(setup, roster, rng);
  },

  seatsOwed(state: CitadelsState, index: FrameIndex): readonly SeatId[] {
    return seatsOwedFor(state, index);
  },

  step(state: CitadelsState, frame: Frame<CitadelsAction>, rng: Random): CitadelsState {
    return stepState(state, frame, rng);
  },

  project(state: CitadelsState, seat: SeatId): CitadelsView {
    if (!hasSeat(state, seat)) throw new CitadelsError(`seat ${seat} is not a player`);
    const mine = state.players.find((p) => p.seat === seat);
    const window = openWindow(state);
    const pick = state.draft?.picks.find((entry) => entry.seat === seat)?.character ?? null;
    return {
      seat,
      cast: [...state.cast],
      players: state.players.map((player): PlayerView => ({
        seat: player.seat,
        gold: player.gold,
        handCount: player.hand.length,
        city: player.city.map((district) => ({ id: district.id, gold: district.gold })),
      })),
      myHand: mine === undefined ? [] : [...mine.hand],
      crown: state.crown,
      round: state.round,
      phase: state.phase,
      callRank: state.callRank,
      active: state.active,
      discard: [...state.discard],
      deckCount: state.deck.length,
      faceup: state.draft === null ? [] : [...state.draft.faceup],
      owedSeats: [...seatsOwedNow(state)],
      window: window === null ? null : { kind: window.kind, purpose: window.purpose },
      pending:
        state.pending === null
          ? null
          : {
              actor: state.pending.actor,
              character: state.pending.character,
              target: state.pending.target,
              cards: state.pending.cards.length,
            },
      myPick: pick,
      winner: winnerOf(state),
      terminal: isTerminal(state),
    };
  },

  isTerminal(state: CitadelsState): boolean {
    return isTerminal(state);
  },
};

