/** Raised for every G54 rule violation: bad setup, unknown role, illegal action. */
export class G54Error extends Error {
  override readonly name = "G54Error";
}
