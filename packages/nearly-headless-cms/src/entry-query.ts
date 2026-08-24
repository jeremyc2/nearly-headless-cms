import { Conflict, InvalidInput, UnsupportedQueryCapability } from "./cms-error.ts";
import {
  type CompiledSnapshot,
  type ResolvedField,
  capabilitiesFor,
} from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import {
  type JsonObject,
  type JsonValue,
  canonicalJson,
  cloneJson,
  fingerprint,
  isJsonObject,
  isJsonValue,
} from "./internal/json.ts";

/** Portable scalar predicate operations with exact cross-adapter semantics. */
export type PredicateOperator =
  | "equals"
  | "notEquals"
  | "in"
  | "notIn"
  | "lessThan"
  | "lessThanOrEqual"
  | "greaterThan"
  | "greaterThanOrEqual"
  | "startsWith"
  | "contains"
  | "isNull";

/** A predicate over one resolvable Field path. */
export interface FieldPredicate {
  readonly path: string;
  readonly operator: PredicateOperator;
  readonly value?: JsonValue;
}

/** A predicate requiring every child predicate to match. */
export interface AllPredicate {
  readonly all: readonly Predicate[];
}

/** A predicate requiring at least one child predicate to match. */
export interface AnyPredicate {
  readonly any: readonly Predicate[];
}

/** A predicate negating one child predicate. */
export interface NotPredicate {
  readonly not: Predicate;
}

/** The recursive portable Entry Query predicate algebra. */
export type Predicate = FieldPredicate | AllPredicate | AnyPredicate | NotPredicate;

/** One deterministic Field-path sort followed implicitly by Entry ID. */
export interface Sort {
  readonly path: string;
  readonly direction: "ascending" | "descending";
}

/** A bounded Query over exactly one Content Type. */
export interface Query {
  readonly contentTypeId: string;
  readonly where?: Predicate;
  readonly sort?: readonly Sort[];
  readonly projection?: readonly string[];
  readonly expansion?: readonly string[];
  readonly pageSize: number;
  readonly cursor?: string;
}

/** One internally consistent cursor page of Entry representations. */
export interface QueryPage {
  readonly items: readonly Representation[];
  readonly nextCursor?: string;
}

/** Hard complexity and page-size bounds applied before Query evaluation. */
export interface QueryLimits {
  readonly maximumPageSize: number;
  readonly maximumProjectionPaths: number;
  readonly maximumExpansionPaths: number;
  readonly maximumScanEntries: number;
}

/** Compiled Definition and Adapter capability inputs for portable evaluation. */
export interface EvaluationOptions {
  readonly generation: number;
  readonly limits?: Partial<QueryLimits>;
}

/** Complete inputs for one deterministic Query evaluation. */
export interface EvaluationInput {
  readonly entries: readonly Representation[];
  readonly options: EvaluationOptions;
  readonly query: Query;
  readonly snapshot: CompiledSnapshot;
}

const defaultLimits: QueryLimits = {
  maximumExpansionPaths: 20,
  maximumPageSize: 100,
  maximumProjectionPaths: 100,
  maximumScanEntries: 10_000,
};

const BASE64_QUARTET_LENGTH = 4;
const NEGATIVE_ONE = -1;
const ZERO = 0;
const ONE = 1;

interface CursorPayload {
  readonly generation: number;
  readonly queryFingerprint: string;
  readonly offset: number;
}

const encodeCursor = (cursor: CursorPayload): string =>
    btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, ""),
  decodeCursor = (cursor: string): CursorPayload => {
    try {
      const base64 = cursor.replaceAll("-", "+").replaceAll("_", "/"),
        padded = base64.padEnd(
          Math.ceil(base64.length / BASE64_QUARTET_LENGTH) * BASE64_QUARTET_LENGTH,
          "=",
        ),
        decoded = JSON.parse(atob(padded)) as unknown;
      if (decoded === null || typeof decoded !== "object") {
        throw new Error("not an object");
      }
      const generation = Reflect.get(decoded, "generation"),
        offset = Reflect.get(decoded, "offset"),
        queryFingerprint = Reflect.get(decoded, "queryFingerprint");
      if (
        typeof generation !== "number" ||
        !Number.isSafeInteger(generation) ||
        typeof queryFingerprint !== "string" ||
        typeof offset !== "number" ||
        !Number.isSafeInteger(offset)
      ) {
        throw new TypeError("invalid fields");
      }
      return { generation, offset, queryFingerprint };
    } catch {
      throw InvalidInput.make({ message: "Invalid opaque Query cursor" });
    }
  },
  isFieldPredicate = (predicate: Predicate): predicate is FieldPredicate => "path" in predicate,
  isAllPredicate = (predicate: Predicate): predicate is AllPredicate => "all" in predicate,
  isAnyPredicate = (predicate: Predicate): predicate is AnyPredicate => "any" in predicate,
  valueAtPath = (values: JsonObject, path: string): JsonValue | undefined => {
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
  compareScalar = (left: JsonValue, right: JsonValue): number => {
    if (typeof left === "number" && typeof right === "number") {
      return left - right;
    }
    if (typeof left === "string" && typeof right === "string") {
      return left < right ? NEGATIVE_ONE : (left > right ? ONE : ZERO);
    }
    if (typeof left === "boolean" && typeof right === "boolean") {
      return Number(left) - Number(right);
    }
    return canonicalJson(left).localeCompare(canonicalJson(right));
  },
  matchesFieldPredicate = (values: JsonObject, predicate: FieldPredicate): boolean => {
    const fieldValue = valueAtPath(values, predicate.path),
      expectedValue = predicate.value;
    switch (predicate.operator) {
      case "equals": {
        return (
          expectedValue !== undefined &&
          (Array.isArray(fieldValue)
            ? fieldValue.some((item) => canonicalJson(item) === canonicalJson(expectedValue))
            : canonicalJson(fieldValue ?? null) === canonicalJson(expectedValue))
        );
      }
      case "notEquals": {
        return (
          expectedValue !== undefined &&
          (Array.isArray(fieldValue)
            ? fieldValue.every((item) => canonicalJson(item) !== canonicalJson(expectedValue))
            : canonicalJson(fieldValue ?? null) !== canonicalJson(expectedValue))
        );
      }
      case "in":
      case "notIn": {
        const found =
          Array.isArray(expectedValue) &&
          expectedValue.some(
            (candidate) => canonicalJson(candidate) === canonicalJson(fieldValue ?? null),
          );
        return predicate.operator === "in" ? found : !found;
      }
      case "lessThan": {
        return (
          fieldValue !== undefined &&
          fieldValue !== null &&
          expectedValue !== undefined &&
          compareScalar(fieldValue, expectedValue) < ZERO
        );
      }
      case "lessThanOrEqual": {
        return (
          fieldValue !== undefined &&
          fieldValue !== null &&
          expectedValue !== undefined &&
          compareScalar(fieldValue, expectedValue) <= ZERO
        );
      }
      case "greaterThan": {
        return (
          fieldValue !== undefined &&
          fieldValue !== null &&
          expectedValue !== undefined &&
          compareScalar(fieldValue, expectedValue) > ZERO
        );
      }
      case "greaterThanOrEqual": {
        return (
          fieldValue !== undefined &&
          fieldValue !== null &&
          expectedValue !== undefined &&
          compareScalar(fieldValue, expectedValue) >= ZERO
        );
      }
      case "startsWith": {
        return (
          typeof fieldValue === "string" &&
          typeof expectedValue === "string" &&
          fieldValue.startsWith(expectedValue)
        );
      }
      case "contains": {
        return (
          typeof fieldValue === "string" &&
          typeof expectedValue === "string" &&
          fieldValue.includes(expectedValue)
        );
      }
      case "isNull": {
        const isNullOrMissing = fieldValue === null || fieldValue === undefined;
        return expectedValue === false ? !isNullOrMissing : isNullOrMissing;
      }
    }
    return predicate.operator;
  },
  matchesPredicate = (values: JsonObject, predicate: Predicate): boolean => {
    if (isFieldPredicate(predicate)) {
      return matchesFieldPredicate(values, predicate);
    }
    if (isAllPredicate(predicate)) {
      return predicate.all.every((child) => matchesPredicate(values, child));
    }
    if (isAnyPredicate(predicate)) {
      return predicate.any.some((child) => matchesPredicate(values, child));
    }
    return !matchesPredicate(values, predicate.not);
  },
  findField = (fields: readonly ResolvedField[], path: string): ResolvedField | undefined => {
    const segments = path.split(".");
    let currentFields = fields,
      field: ResolvedField | undefined;
    for (const segment of segments) {
      field = currentFields.find((candidate) => candidate.key === segment);
      if (field === undefined) {
        return undefined;
      }
      currentFields = field.kind.kind === "list" ? [] : (field.nestedFields ?? []);
    }
    return field;
  },
  validatePredicate = (predicate: Predicate, fields: readonly ResolvedField[]): void => {
    if (isFieldPredicate(predicate)) {
      const field = findField(fields, predicate.path);
      if (field === undefined) {
        throw InvalidInput.make({ message: `Unknown Field Path ${predicate.path}` });
      }
      const capabilities = capabilitiesFor(field.kind);
      if (!(capabilities.filter ?? []).includes(predicate.operator)) {
        throw UnsupportedQueryCapability.make({
          message: `Field ${predicate.path} does not support ${predicate.operator}`,
        });
      }
      if (predicate.operator !== "isNull" && predicate.value === undefined) {
        throw InvalidInput.make({ message: `${predicate.operator} requires a value` });
      }
      return;
    }
    const children = isAllPredicate(predicate)
      ? predicate.all
      : (isAnyPredicate(predicate)
        ? predicate.any
        : [predicate.not]);
    if (children.length === ZERO) {
      throw InvalidInput.make({ message: "Boolean Query groups cannot be empty" });
    }
    for (const child of children) {
      validatePredicate(child, fields);
    }
  },
  queryWithoutCursor = (query: Query): JsonValue => {
    const value: unknown = {
      contentTypeId: query.contentTypeId,
      ...(query.where === undefined ? {} : { where: query.where }),
      sort: query.sort ?? [],
      projection: query.projection ?? [],
      expansion: query.expansion ?? [],
      pageSize: query.pageSize,
    };
    if (!isJsonValue(value)) {
      throw InvalidInput.make({ message: "Query is not JSON-compatible" });
    }
    return value;
  },
  project = (entry: Representation, paths: readonly string[] | undefined): Representation => {
    if (paths === undefined) {
      return { ...entry, values: cloneJson(entry.values) };
    }
    const projected: Record<string, JsonValue> = {};
    for (const path of paths) {
      const value = valueAtPath(entry.values, path);
      if (value === undefined) {
        continue;
      }
      const segments = path.split(".");
      let current = projected;
      for (const [index, segment] of segments.entries()) {
        if (index === segments.length - ONE) {
          current[segment] = cloneJson(value);
        } else {
          const existing = current[segment],
            nested: Record<string, JsonValue> = isJsonObject(existing) ? { ...existing } : {};
          current[segment] = nested;
          current = nested;
        }
      }
    }
    return { contentTypeId: entry.contentTypeId, id: entry.id, values: projected };
  };

/** Evaluates a Query exactly and returns a cursor bound to its shape and snapshot. */
export const evaluate = ({ entries, options, query, snapshot }: EvaluationInput): QueryPage => {
  const limits = { ...defaultLimits, ...options.limits };
  if (
    !Number.isSafeInteger(query.pageSize) ||
    query.pageSize <= ZERO ||
    query.pageSize > limits.maximumPageSize
  ) {
    throw InvalidInput.make({
      message: `pageSize must be between 1 and ${limits.maximumPageSize}`,
    });
  }
  if ((query.projection?.length ?? ZERO) > limits.maximumProjectionPaths) {
    throw InvalidInput.make({ message: "Projection exceeds the configured Query Limit" });
  }
  if ((query.expansion?.length ?? ZERO) > limits.maximumExpansionPaths) {
    throw InvalidInput.make({
      message: "Relationship Expansion exceeds the configured Query Limit",
    });
  }
  if (entries.length > limits.maximumScanEntries) {
    throw UnsupportedQueryCapability.make({
      message: "Authoritative scan exceeds the configured work bound",
    });
  }
  const contentType = snapshot.contentTypes.get(query.contentTypeId);
  if (contentType === undefined) {
    throw InvalidInput.make({ message: `Unknown Content Type ${query.contentTypeId}` });
  }
  if (query.where !== undefined) {
    validatePredicate(query.where, contentType.fields);
  }
  for (const sort of query.sort ?? []) {
    const field = findField(contentType.fields, sort.path);
    if (field === undefined) {
      throw InvalidInput.make({ message: `Unknown sort Field Path ${sort.path}` });
    }
    if (!capabilitiesFor(field.kind).sortable) {
      throw UnsupportedQueryCapability.make({ message: `Field ${sort.path} is not sortable` });
    }
  }
  for (const projectionPath of query.projection ?? []) {
    if (findField(contentType.fields, projectionPath) === undefined) {
      throw InvalidInput.make({ message: `Unknown Projection Field Path ${projectionPath}` });
    }
  }
  const queryFingerprint = fingerprint(queryWithoutCursor(query));
  let offset = 0;
  if (query.cursor !== undefined) {
    const cursor = decodeCursor(query.cursor);
    if (cursor.generation !== options.generation) {
      throw Conflict.make({
        message: "Query cursor is stale after a persistence generation change",
      });
    }
    if (cursor.queryFingerprint !== queryFingerprint) {
      throw Conflict.make({ message: "Query cursor belongs to a different Query" });
    }
    ({ offset } = cursor);
  }
  const matchingEntries = entries.filter(
      (entry) =>
        entry.contentTypeId === query.contentTypeId &&
        (query.where === undefined || matchesPredicate(entry.values, query.where)),
    ),
    sorts = query.sort ?? [];
  matchingEntries.sort((leftEntry, rightEntry) => {
    for (const sort of sorts) {
      const leftValue = valueAtPath(leftEntry.values, sort.path),
        rightValue = valueAtPath(rightEntry.values, sort.path),
        leftMissing = leftValue === undefined || leftValue === null,
        rightMissing = rightValue === undefined || rightValue === null;
      if (leftMissing !== rightMissing) {
        return leftMissing ? ONE : NEGATIVE_ONE;
      }
      if (!leftMissing && !rightMissing) {
        const comparison = compareScalar(leftValue, rightValue);
        if (comparison !== ZERO) {
          return sort.direction === "ascending" ? comparison : -comparison;
        }
      }
    }
    return leftEntry.id < rightEntry.id
      ? NEGATIVE_ONE
      : (leftEntry.id > rightEntry.id ? ONE : ZERO);
  });
  const items = matchingEntries
      .slice(offset, offset + query.pageSize)
      .map((entry) => project(entry, query.projection)),
    nextOffset = offset + items.length;
  return nextOffset < matchingEntries.length
    ? {
        items,
        nextCursor: encodeCursor({
          generation: options.generation,
          offset: nextOffset,
          queryFingerprint,
        }),
      }
    : { items };
};
