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
import { asCharacterId, type CharacterId } from "./characters.ts";
import { type DistrictType } from "./districts.ts";
import { asDistrictType } from "./state.ts";
import { CitadelsError } from "./error.ts";

/**
 * One seat's input for one window. The machine is total over this union: a
 * window admits a subset and coerces anything else to its safe default, so a
 * hostile or buggy report can never throw out of `step`. A character that needs
 * a shape this union lacks reports it to the coordinator, which adds it here and
 * in the codec rather than letting a worker edit this shared file.
 */
export type CitadelsAction =
  | { readonly t: "pick"; readonly character: CharacterId }
  | { readonly t: "gold" }
  | { readonly t: "draw" }
  | { readonly t: "keep"; readonly index: number }
  | { readonly t: "build"; readonly card: number; readonly pay?: readonly number[] }
  | { readonly t: "pass" }
  | { readonly t: "target"; readonly seat: SeatId }
  | { readonly t: "name-character"; readonly character: CharacterId }
  | { readonly t: "name-type"; readonly type: DistrictType }
  | { readonly t: "choose"; readonly value: string }
  | { readonly t: "pay"; readonly amount: number };

const encodeSeat = (seat: SeatId): Json => seat;

export const encodeAction = (action: CitadelsAction): Json => {
  switch (action.t) {
    case "pick":
      return { t: "pick", character: action.character };
    case "keep":
      return { t: "keep", index: action.index };
    case "build":
      return action.pay === undefined
        ? { t: "build", card: action.card }
        : { t: "build", card: action.card, pay: [...action.pay] };
    case "target":
      return { t: "target", seat: encodeSeat(action.seat) };
    case "name-character":
      return { t: "name-character", character: action.character };
    case "name-type":
      return { t: "name-type", type: action.type };
    case "choose":
      return { t: "choose", value: action.value };
    case "pay":
      return { t: "pay", amount: action.amount };
    case "gold":
    case "draw":
    case "pass":
      return { t: action.t };
  }
};

const decodeSeat = (json: Json, what: string): SeatId => seatId(expectString(json, what));

const decodeNumbers = (json: Json, what: string): readonly number[] =>
  expectArray(json, what).map((entry) => expectInteger(entry, `${what} entry`));

export const decodeAction = (json: Json): CitadelsAction => {
  const object = expectObject(json, "citadels action");
  const t = expectString(field(object, "t"), "action type");
  switch (t) {
    case "pick":
      return { t: "pick", character: asCharacterId(expectString(field(object, "character"), "pick character")) };
    case "keep":
      return { t: "keep", index: expectInteger(field(object, "index"), "keep index") };
    case "build": {
      const payJson = object["pay"];
      return payJson === undefined
        ? { t: "build", card: expectInteger(field(object, "card"), "build card") }
        : {
            t: "build",
            card: expectInteger(field(object, "card"), "build card"),
            pay: decodeNumbers(payJson, "build pay"),
          };
    }
    case "target":
      return { t: "target", seat: decodeSeat(field(object, "seat"), "target seat") };
    case "name-character":
      return {
        t: "name-character",
        character: asCharacterId(expectString(field(object, "character"), "name-character")),
      };
    case "name-type":
      return { t: "name-type", type: asDistrictType(expectString(field(object, "type"), "name-type")) };
    case "choose":
      return { t: "choose", value: expectString(field(object, "value"), "choose value") };
    case "pay":
      return { t: "pay", amount: expectInteger(field(object, "amount"), "pay amount") };
    case "gold":
    case "draw":
    case "pass":
      return { t };
    default:
      throw new CitadelsError(`unknown action: ${t}`);
  }
};

export const actionCodec: Codec<CitadelsAction> = { encode: encodeAction, decode: decodeAction };
