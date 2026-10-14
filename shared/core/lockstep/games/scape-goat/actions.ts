import {
  expectInteger,
  expectObject,
  expectString,
  field,
  seatId,
  type Codec,
  type Json,
  type SeatId,
} from "../../index.ts";
import { ScapeGoatError } from "./error.ts";
import { decodeLocation, type Location, type StashSlot } from "./state.ts";

/**
 * One seat's input for one phase. Every phase admits a subset and coerces
 * anything else to its safe default, so a hostile or buggy report can never
 * throw out of `step`. `go-to-cops` is the six-player pre-empt a non-active seat
 * may use during the active seat's move.
 */
export type ScapeGoatAction =
  | { readonly t: "move"; readonly to: Location }
  | { readonly t: "take-prep-token" }
  | { readonly t: "spy"; readonly target: SeatId }
  | { readonly t: "trade"; readonly target: SeatId }
  | { readonly t: "stash"; readonly slot: StashSlot }
  | { readonly t: "frame" }
  | { readonly t: "steal"; readonly target: SeatId }
  | { readonly t: "put"; readonly index: number }
  | { readonly t: "give"; readonly index: number }
  | { readonly t: "reveal"; readonly index: number }
  | { readonly t: "swap"; readonly index: number }
  | { readonly t: "go-to-cops" };

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeSlot = (json: Json, what: string): StashSlot => {
  const value = expectInteger(json, what);
  if (value === 0 || value === 1 || value === 2) return value;
  throw new ScapeGoatError(`${what}: stash slot must be 0, 1, or 2, got ${String(value)}`);
};

const encode = (action: ScapeGoatAction): Json => {
  switch (action.t) {
    case "move":
      return { t: "move", to: action.to };
    case "spy":
      return { t: "spy", target: action.target };
    case "trade":
      return { t: "trade", target: action.target };
    case "stash":
      return { t: "stash", slot: action.slot };
    case "steal":
      return { t: "steal", target: action.target };
    case "put":
      return { t: "put", index: action.index };
    case "give":
      return { t: "give", index: action.index };
    case "reveal":
      return { t: "reveal", index: action.index };
    case "swap":
      return { t: "swap", index: action.index };
    case "take-prep-token":
    case "frame":
    case "go-to-cops":
      return { t: action.t };
  }
};

const decode = (json: Json): ScapeGoatAction => {
  const object = expectObject(json, "scape-goat action");
  const t = expectString(field(object, "t"), "action type");
  switch (t) {
    case "move":
      return { t: "move", to: decodeLocation(field(object, "to"), "move destination") };
    case "spy":
      return { t: "spy", target: decodeSeat(field(object, "target"), "spy target") };
    case "trade":
      return { t: "trade", target: decodeSeat(field(object, "target"), "trade target") };
    case "stash":
      return { t: "stash", slot: decodeSlot(field(object, "slot"), "stash slot") };
    case "steal":
      return { t: "steal", target: decodeSeat(field(object, "target"), "steal target") };
    case "put":
      return { t: "put", index: expectInteger(field(object, "index"), "put index") };
    case "give":
      return { t: "give", index: expectInteger(field(object, "index"), "give index") };
    case "reveal":
      return { t: "reveal", index: expectInteger(field(object, "index"), "reveal index") };
    case "swap":
      return { t: "swap", index: expectInteger(field(object, "index"), "swap index") };
    case "take-prep-token":
    case "frame":
    case "go-to-cops":
      return { t };
    default:
      throw new ScapeGoatError(`unknown action: ${t}`);
  }
};

export const actionCodec: Codec<ScapeGoatAction> = { encode, decode };
