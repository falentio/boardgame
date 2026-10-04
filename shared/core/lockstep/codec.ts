import type { Json } from "./json.ts";

/**
 * A pure, total, lossless-by-contract mapping between a domain value and `Json`.
 * Games supply these so the primitive can persist and transport state and
 * actions without knowing their shape. `decode(encode(x))` must equal `x` for a
 * fold to survive a snapshot round trip.
 */
export interface Codec<T> {
  encode(value: T): Json;
  decode(json: Json): T;
}

export const expectObject = (value: Json, what: string): { readonly [key: string]: Json } => {
  if (isJsonObject(value)) return value;
  throw new CodecError(`${what}: expected an object`);
};

const isJsonObject = (value: Json): value is { readonly [key: string]: Json } =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const expectArray = (value: Json, what: string): readonly Json[] => {
  if (Array.isArray(value)) return value;
  throw new CodecError(`${what}: expected an array`);
};

export const expectString = (value: Json, what: string): string => {
  if (typeof value !== "string") throw new CodecError(`${what}: expected a string`);
  return value;
};

export const expectNumber = (value: Json, what: string): number => {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new CodecError(`${what}: expected a finite number`);
  }
  return value;
};

/** Like `expectNumber`, but also requires an integer. Use where integrality is an invariant. */
export const expectInteger = (value: Json, what: string): number => {
  const number = expectNumber(value, what);
  if (!Number.isInteger(number)) throw new CodecError(`${what}: expected an integer`);
  return number;
};

/**
 * Read an own field. `Object.hasOwn` (not `key in object`) so a wire payload
 * cannot satisfy a field by inheriting it from `Object.prototype` — the parse
 * boundary (`asJson`) already strips `__proto__`, and this closes the read side.
 */
export const field = (object: { readonly [key: string]: Json }, key: string): Json => {
  if (!Object.hasOwn(object, key)) throw new CodecError(`missing field: ${key}`);
  return object[key]!;
};

export class CodecError extends Error {
  override readonly name = "CodecError";
}
