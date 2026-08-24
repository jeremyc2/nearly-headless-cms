export type JsonPrimitive = null | boolean | number | string;
export interface JsonObject extends Readonly<Record<string, JsonValue>> {
  readonly [Symbol.toStringTag]?: never;
}
export type JsonValue = JsonPrimitive | readonly JsonValue[] | JsonObject;

const arrayJsonValuePredicate = (value: JsonValue): value is readonly JsonValue[] =>
    Array.isArray(value),
  canonicalizeJsonValue = (value: JsonValue): JsonValue => {
    if (arrayJsonValuePredicate(value)) {
      return value.map((child) => canonicalizeJsonValue(child));
    }
    if (value !== null && typeof value === "object") {
      const sortedEntries = Object.entries(value).toSorted(([leftKey], [rightKey]) =>
        leftKey.localeCompare(rightKey),
      );
      return Object.fromEntries(
        sortedEntries.map(([key, child]) => [key, canonicalizeJsonValue(child)]),
      );
    }
    return value;
  },
  cloneJsonValue = <Value extends JsonValue>(value: Value): Value => structuredClone(value),
  jsonObjectLikePredicate = (
    value: object | null,
    nestedPredicate: (nestedValue: unknown) => nestedValue is JsonValue,
  ): boolean => {
    if (value === null) {
      return true;
    }
    if (Array.isArray(value)) {
      return value.every((child: unknown) => nestedPredicate(child));
    }
    const prototype = Reflect.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return false;
    }
    return Reflect.ownKeys(value).every(
      (key) => typeof key === "string" && nestedPredicate(Reflect.get(value, key)),
    );
  },
  jsonValuePredicate = (value: unknown): value is JsonValue => {
    switch (typeof value) {
      case "boolean":
      case "string": {
        return true;
      }
      case "number": {
        return Number.isFinite(value);
      }
      case "object": {
        return jsonObjectLikePredicate(value, jsonValuePredicate);
      }
      case "bigint":
      case "function":
      case "symbol":
      case "undefined": {
        return false;
      }
      default: {
        return false;
      }
    }
  },
  serializeCanonicalJson = (value: unknown): string => {
    if (!jsonValuePredicate(value)) {
      throw new TypeError("Value is not JSON-compatible");
    }
    return JSON.stringify(canonicalizeJsonValue(value));
  },
  serializedJsonFingerprint = (value: unknown): string => {
    const hasher = new Bun.CryptoHasher("sha256");
    hasher.update(serializeCanonicalJson(value));
    return hasher.digest("hex");
  },
  validatedJsonObjectPredicate = (value: unknown): value is JsonObject =>
    jsonValuePredicate(value) &&
    value !== null &&
    !Array.isArray(value) &&
    typeof value === "object";

/** Produces canonical JSON with recursively sorted object keys. */
export {
  serializeCanonicalJson as canonicalJson,
  cloneJsonValue as cloneJson,
  serializedJsonFingerprint as fingerprint,
  validatedJsonObjectPredicate as isJsonObject,
  jsonValuePredicate as isJsonValue,
};
