import type {
  AllPredicate,
  AnyPredicate,
  FieldPredicate,
  JsonObject,
  JsonValue,
  NotPredicate,
  Predicate,
  PredicateOperator,
} from "./entry-query-types.ts";
import { InvalidInput, UnsupportedQueryCapability } from "./cms-error.ts";
import { type ResolvedField, capabilitiesFor } from "./content-definition.ts";
import { canonicalJson } from "./internal/json.ts";
import entryQuerySupport from "./entry-query-support.ts";

const { ZERO, compareScalar, findField, valueAtPath } = entryQuerySupport,
  isAllPredicate = (predicate: Readonly<Predicate>): predicate is AllPredicate =>
    "all" in predicate,
  isAnyPredicate = (predicate: Readonly<Predicate>): predicate is AnyPredicate =>
    "any" in predicate,
  isFieldPredicate = (predicate: Readonly<Predicate>): predicate is FieldPredicate =>
    "path" in predicate,
  isNotPredicate = (predicate: Readonly<Predicate>): predicate is NotPredicate =>
    "not" in predicate,
  matchesComparisonPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
    compare: (left: JsonValue, right: JsonValue) => number,
  ): boolean =>
    fieldValue !== undefined &&
    fieldValue !== null &&
    expectedValue !== undefined &&
    compare(fieldValue, expectedValue) < ZERO,
  matchesContainsPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean =>
    typeof fieldValue === "string" &&
    typeof expectedValue === "string" &&
    fieldValue.includes(expectedValue),
  matchesEqualsPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean => {
    if (expectedValue === undefined) {
      return false;
    }
    if (Array.isArray(fieldValue)) {
      return fieldValue.some((item) => canonicalJson(item) === canonicalJson(expectedValue));
    }
    return canonicalJson(fieldValue ?? null) === canonicalJson(expectedValue);
  },
  matchesFieldPredicate = (values: JsonObject, predicate: FieldPredicate): boolean =>
    zFieldPredicateMatchers[predicate.operator](
      valueAtPath(values, predicate.path),
      predicate.value,
    ),
  matchesGreaterThanOrEqualPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean =>
    fieldValue !== undefined &&
    fieldValue !== null &&
    expectedValue !== undefined &&
    compareScalar(fieldValue, expectedValue) >= ZERO,
  matchesGreaterThanPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean =>
    fieldValue !== undefined &&
    fieldValue !== null &&
    expectedValue !== undefined &&
    compareScalar(fieldValue, expectedValue) > ZERO,
  matchesInPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
    negate: boolean,
  ): boolean => {
    const found =
      Array.isArray(expectedValue) &&
      expectedValue.some(
        (candidate) => canonicalJson(candidate) === canonicalJson(fieldValue ?? null),
      );
    if (negate) {
      return !found;
    }
    return found;
  },
  matchesIsNullPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean => {
    const isNullOrMissing = fieldValue === null || fieldValue === undefined;
    if (expectedValue === false) {
      return !isNullOrMissing;
    }
    return isNullOrMissing;
  },
  matchesLessThanOrEqualPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean =>
    fieldValue !== undefined &&
    fieldValue !== null &&
    expectedValue !== undefined &&
    compareScalar(fieldValue, expectedValue) <= ZERO,
  matchesNotEqualsPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean => {
    if (expectedValue === undefined) {
      return false;
    }
    if (Array.isArray(fieldValue)) {
      return fieldValue.every((item) => canonicalJson(item) !== canonicalJson(expectedValue));
    }
    return canonicalJson(fieldValue ?? null) !== canonicalJson(expectedValue);
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
  matchesStartsWithPredicate = (
    fieldValue: JsonValue | undefined,
    expectedValue: JsonValue | undefined,
  ): boolean =>
    typeof fieldValue === "string" &&
    typeof expectedValue === "string" &&
    fieldValue.startsWith(expectedValue),
  predicateChildren = (predicate: Readonly<Predicate>): readonly Predicate[] => {
    if (isAllPredicate(predicate)) {
      return predicate.all;
    }
    if (isAnyPredicate(predicate)) {
      return predicate.any;
    }
    if (isNotPredicate(predicate)) {
      return [predicate.not];
    }
    return [];
  },
  validateFieldPredicate = (predicate: FieldPredicate, fields: readonly ResolvedField[]): void => {
    const field = findField(fields, predicate.path);
    if (field === undefined) {
      throw InvalidInput.make({ message: `Unknown Field Path ${predicate.path}` });
    }
    if (!(capabilitiesFor(field.kind).filter ?? []).includes(predicate.operator)) {
      throw UnsupportedQueryCapability.make({
        message: `Field ${predicate.path} does not support ${predicate.operator}`,
      });
    }
    if (predicate.operator !== "isNull" && predicate.value === undefined) {
      throw InvalidInput.make({ message: `${predicate.operator} requires a value` });
    }
  },
  validatePredicate = (predicate: Predicate, fields: readonly ResolvedField[]): void => {
    if (isFieldPredicate(predicate)) {
      validateFieldPredicate(predicate, fields);
      return;
    }
    const children = predicateChildren(predicate);
    if (children.length === ZERO) {
      throw InvalidInput.make({ message: "Boolean Query groups cannot be empty" });
    }
    for (const child of children) {
      validatePredicate(child, fields);
    }
  },
  zFieldPredicateMatchers: Record<
    PredicateOperator,
    (fieldValue: JsonValue | undefined, expectedValue: JsonValue | undefined) => boolean
  > = {
    contains: matchesContainsPredicate,
    equals: matchesEqualsPredicate,
    greaterThan: matchesGreaterThanPredicate,
    greaterThanOrEqual: matchesGreaterThanOrEqualPredicate,
    in: (fieldValue, expectedValue) => matchesInPredicate(fieldValue, expectedValue, false),
    isNull: matchesIsNullPredicate,
    lessThan: (fieldValue, expectedValue) =>
      matchesComparisonPredicate(fieldValue, expectedValue, compareScalar),
    lessThanOrEqual: matchesLessThanOrEqualPredicate,
    notEquals: matchesNotEqualsPredicate,
    notIn: (fieldValue, expectedValue) => matchesInPredicate(fieldValue, expectedValue, true),
    startsWith: matchesStartsWithPredicate,
  };

export default { matchesPredicate, validatePredicate };
