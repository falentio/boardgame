/** Raised for every Secret Hitler rule violation: a bad setup, an illegal action, a corrupt snapshot. */
export class SecretHitlerError extends Error {
  override readonly name = "SecretHitlerError";
}
