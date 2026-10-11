import { type Destination, type PrepTokensRemaining } from "./state.ts";

/** A location face. Prepare's second face is Frame/Steal; Cops ends the game. */
export type LocationFace = Destination | "frame-steal" | "cops";

/**
 * What a location face offers the actor. `pick` names what the action needs from
 * the actor beyond moving there, so the menu builder and the reducer read the
 * same table instead of branching separately.
 */
export interface LocationActionSpec {
  readonly face: LocationFace;
  readonly offers: "take-prep-token" | "spy" | "trade" | "stash" | "frame-steal" | "cops";
  readonly pick: "none" | "seat" | "slot";
  readonly summary: string;
}

/** The four non-Cops locations in line order; genesis deals one face-up card to each. */
export const LOCATION_LINE: readonly Destination[] = ["prepare", "spy", "trade", "stash"];

export const LOCATION_ACTIONS: Readonly<Record<LocationFace, LocationActionSpec>> = {
  prepare: {
    face: "prepare",
    offers: "take-prep-token",
    pick: "none",
    summary: "Take one preparation token from the card; the second take flips it.",
  },
  "frame-steal": {
    face: "frame-steal",
    offers: "frame-steal",
    pick: "none",
    summary: "Frame with a held token, or steal one from a holder.",
  },
  spy: {
    face: "spy",
    offers: "spy",
    pick: "seat",
    summary: "Pick a player; they show you their hand.",
  },
  trade: {
    face: "trade",
    offers: "trade",
    pick: "seat",
    summary: "Pick a player; each of you gives one card, simultaneously.",
  },
  stash: {
    face: "stash",
    offers: "stash",
    pick: "slot",
    summary: "Take one facedown card, then place one from your hand.",
  },
  cops: {
    face: "cops",
    offers: "cops",
    pick: "none",
    summary: "The game ends immediately; the scapegoat wins.",
  },
};

/** Prepare's live face: it flips once both tokens have been taken. */
export const faceOf = (location: Destination, prepareTokens: PrepTokensRemaining): LocationFace =>
  location === "prepare" && prepareTokens === 0 ? "frame-steal" : location;
