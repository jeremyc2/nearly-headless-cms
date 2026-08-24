import {
  type JsonObject,
  type JsonValue,
  canonicalJson,
  fingerprint,
  isJsonObject,
  isJsonValue,
} from "./internal/json.ts";
import type { Query, QueryLimits } from "./entry-query-types.ts";
import { InvalidInput } from "./cms-error.ts";
import type { ResolvedField } from "./content-definition.ts";

const BASE64_QUARTET_LENGTH = 4,
  NEGATIVE_ONE = -1,
  ONE = 1,
  ZERO = 0,
  aCompareStrings = (left: string, right: string): number => {
    if (left < right) {
      return NEGATIVE_ONE;
    }
    if (left > right) {
      return ONE;
    }
    return ZERO;
  },
  bCompareScalar = (left: JsonValue, right: JsonValue): number => {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    if (typeof left === "string" && typeof right === "string") {
      return aCompareStrings(left, right);
    }
    if (typeof left === "boolean" && typeof right === "boolean") {
      return Number(left) - Number(right);
    }
    return canonicalJson(left).localeCompare(canonicalJson(right));
  },
  cDecodeCursor = (cursor: string): CursorPayload => {
    try {
      const aNormalizedCursor = cursor.replaceAll("-", "+").replaceAll("_", "/"),
        bPaddedCursor = aNormalizedCursor.padEnd(
          Math.ceil(aNormalizedCursor.length / BASE64_QUARTET_LENGTH) * BASE64_QUARTET_LENGTH,
          "=",
        ),
        cDecoded: unknown = JSON.parse(atob(bPaddedCursor));
      if (!fIsCursorPayload(cDecoded)) {
        throw new Error("invalid cursor payload");
      }
      return cDecoded;
    } catch {
      throw InvalidInput.make({ message: "Invalid opaque Query cursor" });
    }
  },
  dEncodeCursor = (cursor: CursorPayload): string =>
    btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, ""),
  dResolveNextFields = (field: ResolvedField): readonly ResolvedField[] => {
    if (field.kind.kind === "list") {
      return [];
    }
    return field.nestedFields ?? [];
  },
  eFindField = (fields: readonly ResolvedField[], path: string): ResolvedField | undefined => {
    let currentFields = fields,
      field: ResolvedField | undefined = undefined;
    for (const segment of path.split(".")) {
      field = currentFields.find((candidate) => candidate.key === segment);
      if (field === undefined) {
        return undefined;
      }
      currentFields = dResolveNextFields(field);
    }
    return field;
  },
  fIsCursorPayload = (value: unknown): value is CursorPayload => {
    if (!isJsonObject(value)) {
      return false;
    }
    const { generation, offset, queryFingerprint } = value;
    return (
      typeof generation === "number" &&
      Number.isSafeInteger(generation) &&
      typeof queryFingerprint === "string" &&
      typeof offset === "number" &&
      Number.isSafeInteger(offset)
    );
  },
  gQueryFingerprintFor = (query: Query): string => fingerprint(hQueryWithoutCursor(query)),
  hQueryWithoutCursor = (query: Query): JsonValue => {
    const value: Record<string, unknown> = {
      contentTypeId: query.contentTypeId,
      expansion: query.expansion ?? [],
      pageSize: query.pageSize,
      projection: query.projection ?? [],
      sort: query.sort ?? [],
    };
    if (query.where !== undefined) {
      value["where"] = query.where;
    }
    if (!isJsonValue(value)) {
      throw InvalidInput.make({ message: "Query is not JSON-compatible" });
    }
    return value;
  },
  iValueAtPath = (values: JsonObject, path: string): JsonValue | undefined => {
    let current: JsonValue | undefined = values;
    for (const segment of path.split(".")) {
      if (current === null || Array.isArray(current) || typeof current !== "object") {
        return undefined;
      }
      const next: unknown = Reflect.get(current, segment);
      if (!isJsonValue(next)) {
        return undefined;
      }
      current = next;
    }
    return current;
  },
  jDefaultLimits: QueryLimits = {
    maximumExpansionPaths: 20,
    maximumPageSize: 100,
    maximumProjectionPaths: 100,
    maximumScanEntries: 10_000,
  };

interface CursorPayload {
  readonly generation: number;
  readonly queryFingerprint: string;
  readonly offset: number;
}

export default {
  NEGATIVE_ONE,
  ONE,
  ZERO,
  compareScalar: bCompareScalar,
  decodeCursor: cDecodeCursor,
  defaultLimits: jDefaultLimits,
  encodeCursor: dEncodeCursor,
  findField: eFindField,
  queryFingerprintFor: gQueryFingerprintFor,
  valueAtPath: iValueAtPath,
};

export type { CursorPayload };
