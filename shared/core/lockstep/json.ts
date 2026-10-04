/**
 * The domain serialization value. `Json` is the only shape that may cross a
 * process boundary; the primitive never invents a wire format. `canonicalize`
 * produces a byte-stable string so digests agree across peers regardless of
 * object-key insertion order.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | readonly Json[]
  | { readonly [key: string]: Json };

/**
 * A deterministic serialization: object keys are sorted, arrays keep order.
 * Two structurally equal `Json` values canonicalize to the same string, which
 * is what lets the seed chain be recomputed identically on every peer.
 */
export const canonicalize = (value: Json): string => {
  if (value === null) return "null";
  switch (typeof value) {
    case "string":
      return JSON.stringify(value);
    case "number":
      if (!Number.isFinite(value)) {
        throw new JsonError(`cannot canonicalize a non-finite number: ${String(value)}`);
      }
      return JSON.stringify(value);
    case "boolean":
      return value ? "true" : "false";
    case "object":
      return canonicalizeObject(value);
    default:
      throw new JsonError(`not a Json value: ${typeof value}`);
  }
};

const isJsonArray = (value: Json): value is readonly Json[] => Array.isArray(value);

const canonicalizeObject = (value: readonly Json[] | { readonly [key: string]: Json }): string => {
  if (isJsonArray(value)) {
    return `[${value.map(canonicalize).join(",")}]`;
  }
  const keys = Object.keys(value).sort();
  const members = keys.map((key) => `${JSON.stringify(key)}:${canonicalize(value[key]!)}`);
  return `{${members.join(",")}}`;
};

/**
 * The parse boundary for untrusted values (a `JSON.parse` result, say). Returns
 * a `Json` only if the value is genuinely Json; throws otherwise.
 *
 * Objects are rebuilt with `Object.create(null)`, so a wire key like `__proto__`
 * becomes an ordinary own property instead of mutating the result's prototype.
 * That keeps `canonicalize` injective over attacker-influenced input: `{}` and
 * `{ "__proto__": 1 }` stay distinct, and no inherited property can shadow a
 * field a codec reads.
 */
export const asJson = (value: unknown): Json => {
  if (value === null || typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") {
    if (!Number.isFinite(value)) throw new JsonError("a non-finite number is not Json");
    return value;
  }
  if (Array.isArray(value)) {
    const items: readonly unknown[] = value;
    return items.map(asJson);
  }
  if (typeof value === "object") {
    const result: { [key: string]: Json } = Object.create(null) as { [key: string]: Json };
    for (const [key, entry] of Object.entries(value as Record<string, unknown>)) {
      result[key] = asJson(entry);
    }
    return result;
  }
  throw new JsonError(`not a Json value: ${typeof value}`);
};

export class JsonError extends Error {
  override readonly name = "JsonError";
}
