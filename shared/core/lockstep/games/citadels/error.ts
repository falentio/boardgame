/** Raised for every citadels rule violation: bad setup, unknown id, illegal action. */
export class CitadelsError extends Error {
  override readonly name = "CitadelsError";
}
