import { type Destination, type PrepTokensRemaining } from "./state.ts";

/**
 * A location's action face. Prepare's second face is Frame/Steal. Cops has no face
 * here: a move to Cops ends the game inside `stepMove`, so an action phase never
 * opens there.
 */
export type LocationFace = Destination | "frame-steal";

/** The four non-Cops locations in line order; genesis deals one face-up card to each. */
export const LOCATION_LINE: readonly Destination[] = ["prepare", "spy", "trade", "stash"];

/** Prepare's live face: it flips once both tokens have been taken. */
export const faceOf = (location: Destination, prepareTokens: PrepTokensRemaining): LocationFace =>
  location === "prepare" && prepareTokens === 0 ? "frame-steal" : location;
