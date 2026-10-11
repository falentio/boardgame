/** Raised for every Scape Goat rule violation: a bad setup, an unknown card, an illegal action. */
export class ScapeGoatError extends Error {
  override readonly name = "ScapeGoatError";
}
