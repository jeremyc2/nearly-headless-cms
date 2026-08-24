import { createHash } from "node:crypto";

export type JsonPrimitive = null | boolean | number | string;
export type JsonValue =
  | JsonPrimitive
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };
export interface JsonObject {
  readonly [key: string]: JsonValue;
}

export const isJsonValue = (value: unknown): value is JsonValue => {
  if (value === null || typeof value === "string" || typeof value === "boolean") {
    return true;
  }
  if (typeof value === "number") {
    return Number.isFinite(value);
  }
  if (Array.isArray(value)) {
    return value.every(isJsonValue);
  }
  if (typeof value !== "object") {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    return false;
  }
  return Reflect.ownKeys(value).every(
    (key) => typeof key === "string" && isJsonValue(Reflect.get(value, key)),
  );
};

export const isJsonObject = (value: unknown): value is JsonObject =>
  isJsonValue(value) && value !== null && !Array.isArray(value) && typeof value === "object";

const sortedEntries = <Value>(
    record: Readonly<Record<string, Value>>,
  ): readonly (readonly [string, Value])[] =>
    Object.entries(record).sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey)),
  isJsonArray = (value: JsonValue): value is readonly JsonValue[] => Array.isArray(value);

const canonicalize = (value: JsonValue): JsonValue => {
  if (isJsonArray(value)) {
    return value.map(canonicalize);
  }
  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      sortedEntries(value).map(([key, child]) => [key, canonicalize(child)]),
    );
  }
  return value;
};

export const canonicalJson = (value: unknown): string => {
  if (!isJsonValue(value)) {
    throw new TypeError("Value is not JSON-compatible");
  }
  return JSON.stringify(canonicalize(value));
};

export const fingerprint = (value: unknown): string =>
  createHash("sha256").update(canonicalJson(value)).digest("hex");

export const cloneJson = <Value extends JsonValue>(value: Value): Value => structuredClone(value);
