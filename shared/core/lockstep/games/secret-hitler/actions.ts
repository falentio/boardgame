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
import { SecretHitlerError } from "./error.ts";

/**
 * One seat's input for one phase. Every phase admits a subset and coerces anything
 * else to a safe default, so a hostile or buggy report can never throw out of
 * \`step\`.
 */
export type SecretHitlerAction =
  | { readonly t: "nominate"; readonly chancellor: SeatId }
  | { readonly t: "vote"; readonly ja: boolean }
  | { readonly t: "discard"; readonly index: number }
  | { readonly t: "enact"; readonly index: number }
  | { readonly t: "propose-veto" }
  | { readonly t: "accept-veto" }
  | { readonly t: "reject-veto" }
  | { readonly t: "ack" }
  | { readonly t: "investigate"; readonly target: SeatId }
  | { readonly t: "special-election"; readonly target: SeatId }
  | { readonly t: "execute"; readonly target: SeatId };

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeBoolean = (json: Json, what: string): boolean => {
  if (typeof json === "boolean") return json;
  throw new SecretHitlerError(`${what}: expected a boolean`);
};

const encode = (action: SecretHitlerAction): Json => {
  switch (action.t) {
    case "nominate":
      return { t: "nominate", chancellor: action.chancellor };
    case "vote":
      return { t: "vote", ja: action.ja };
    case "discard":
      return { t: "discard", index: action.index };
    case "enact":
      return { t: "enact", index: action.index };
    case "investigate":
      return { t: "investigate", target: action.target };
    case "special-election":
      return { t: "special-election", target: action.target };
    case "execute":
      return { t: "execute", target: action.target };
    case "propose-veto":
    case "accept-veto":
    case "reject-veto":
    case "ack":
      return { t: action.t };
  }
};

const decode = (json: Json): SecretHitlerAction => {
  const object = expectObject(json, "secret-hitler action");
  const t = expectString(field(object, "t"), "action type");
  switch (t) {
    case "nominate":
      return { t: "nominate", chancellor: decodeSeat(field(object, "chancellor"), "nominee") };
    case "vote":
      return { t: "vote", ja: decodeBoolean(field(object, "ja"), "vote") };
    case "discard":
      return { t: "discard", index: expectInteger(field(object, "index"), "discard index") };
    case "enact":
      return { t: "enact", index: expectInteger(field(object, "index"), "enact index") };
    case "investigate":
      return { t: "investigate", target: decodeSeat(field(object, "target"), "investigation target") };
    case "special-election":
      return {
        t: "special-election",
        target: decodeSeat(field(object, "target"), "special-election target"),
      };
    case "execute":
      return { t: "execute", target: decodeSeat(field(object, "target"), "execution target") };
    case "propose-veto":
    case "accept-veto":
    case "reject-veto":
    case "ack":
      return { t };
    default:
      throw new SecretHitlerError(`unknown action: ${t}`);
  }
};

export const actionCodec: Codec<SecretHitlerAction> = { encode, decode };
