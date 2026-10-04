import {
  expectArray,
  expectInteger,
  expectObject,
  expectString,
  field,
  seatId,
  type Codec,
  type Json,
  type SeatId,
} from "../../index.ts";
import { G54Error } from "./error.ts";
import { asRoleId, type RoleId } from "./roles.ts";

/**
 * One seat's input for one window. The machine is total over this union: a
 * window admits a subset and coerces anything else to its safe default, so a
 * hostile or buggy report can never throw out of `step`.
 */
export type G54Action =
  | { readonly t: "claim"; readonly role: RoleId; readonly target: SeatId | null }
  | { readonly t: "income" }
  | { readonly t: "coup"; readonly target: SeatId }
  | { readonly t: "challenge" }
  | { readonly t: "pass" }
  | { readonly t: "block"; readonly role: RoleId }
  | { readonly t: "show" }
  | { readonly t: "concede" }
  | { readonly t: "reveal"; readonly index: number }
  | { readonly t: "keep"; readonly indices: readonly number[] }
  | { readonly t: "give"; readonly index: number }
  | { readonly t: "pay" }
  | { readonly t: "no" };

export const encodeAction = (action: G54Action): Json => {
  switch (action.t) {
    case "claim":
      return { t: "claim", role: action.role, target: action.target };
    case "coup":
      return { t: "coup", target: action.target };
    case "block":
      return { t: "block", role: action.role };
    case "reveal":
      return { t: "reveal", index: action.index };
    case "keep":
      return { t: "keep", indices: [...action.indices] };
    case "give":
      return { t: "give", index: action.index };
    case "income":
    case "challenge":
    case "pass":
    case "show":
    case "concede":
    case "pay":
    case "no":
      return { t: action.t };
  }
};

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeIndices = (json: Json, what: string): readonly number[] =>
  expectArray(json, what).map((entry) => expectInteger(entry, `${what} entry`));

export const decodeAction = (json: Json): G54Action => {
  const object = expectObject(json, "g54 action");
  const t = expectString(field(object, "t"), "action type");
  switch (t) {
    case "claim": {
      const targetJson = field(object, "target");
      return {
        t: "claim",
        role: asRoleId(expectString(field(object, "role"), "claim role")),
        target: targetJson === null ? null : decodeSeat(targetJson, "claim target"),
      };
    }
    case "coup":
      return { t: "coup", target: decodeSeat(field(object, "target"), "coup target") };
    case "block":
      return { t: "block", role: asRoleId(expectString(field(object, "role"), "block role")) };
    case "reveal":
      return { t: "reveal", index: expectInteger(field(object, "index"), "reveal index") };
    case "keep":
      return { t: "keep", indices: decodeIndices(field(object, "indices"), "keep indices") };
    case "give":
      return { t: "give", index: expectInteger(field(object, "index"), "give index") };
    case "income":
    case "challenge":
    case "pass":
    case "show":
    case "concede":
    case "pay":
    case "no":
      return { t };
    default:
      throw new G54Error(`unknown action: ${t}`);
  }
};

export const actionCodec: Codec<G54Action> = { encode: encodeAction, decode: decodeAction };
