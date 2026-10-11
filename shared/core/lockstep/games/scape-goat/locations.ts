import { type Destination, type PrepTokensRemaining } from "./state.ts";

/** A location face. Prepare's second face is Frame/Steal; Cops ends the game. */
export type LocationFace = Destination | "frame-steal" | "cops";

/** The four non-Cops locations in line order; genesis deals one face-up card to each. */
export const LOCATION_LINE: readonly Destination[] = ["prepare", "spy", "trade", "stash"];

/** Prepare's live face: it flips once both tokens have been taken. */
export const faceOf = (location: Destination, prepareTokens: PrepTokensRemaining): LocationFace =>
  location === "prepare" && prepareTokens === 0 ? "frame-steal" : location;
