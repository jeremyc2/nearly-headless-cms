import { Conflict, InvalidInput, UnsupportedQueryCapability } from "./cms-error.ts";
import {
  type EvaluationInput,
  type JsonValue,
  type Query,
  type QueryLimits,
  type QueryPage,
  type Representation,
  type ResolvedField,
  type Sort,
  capabilitiesFor,
} from "./entry-query-types.ts";
import entryQueryPredicate from "./entry-query-predicate.ts";
import entryQueryProjection from "./entry-query-projection.ts";
import entryQuerySupport from "./entry-query-support.ts";

interface BuildQueryPageInput {
  readonly generation: number;
  readonly matchingEntries: readonly Representation[];
  readonly offset: number;
  readonly pageSize: number;
  readonly projection: readonly string[] | undefined;
  readonly queryFingerprint: string;
}

const {
    NEGATIVE_ONE,
    ONE,
    ZERO,
    compareScalar,
    decodeCursor,
    defaultLimits,
    encodeCursor,
    findField,
    queryFingerprintFor,
    valueAtPath,
  } = entryQuerySupport,
  { matchesPredicate, validatePredicate } = entryQueryPredicate,
  { project } = entryQueryProjection,
  aBuildQueryPage = ({
    generation,
    matchingEntries,
    offset,
    pageSize,
    projection,
    queryFingerprint,
  }: Readonly<BuildQueryPageInput>): QueryPage => {
    const items = matchingEntries
        .slice(offset, offset + pageSize)
        .map((entry) => project(entry, projection)),
      nextOffset = offset + items.length;
    if (nextOffset < matchingEntries.length) {
      return {
        items,
        nextCursor: encodeCursor({
          generation,
          offset: nextOffset,
          queryFingerprint,
        }),
      };
    }
    return { items };
  },
  bCompareEntryIdentifiers = (leftEntry: Representation, rightEntry: Representation): number => {
    if (leftEntry.id < rightEntry.id) {
      return NEGATIVE_ONE;
    }
    if (leftEntry.id > rightEntry.id) {
      return ONE;
    }
    return ZERO;
  },
  cCompareEntries = (
    leftEntry: Representation,
    rightEntry: Representation,
    sorts: readonly Sort[],
  ): number => {
    for (const sort of sorts) {
      const leftValue = valueAtPath(leftEntry.values, sort.path),
        missingComparison = eCompareMissingSortValues(
          leftValue === undefined || leftValue === null,
          valueAtPath(rightEntry.values, sort.path) === undefined ||
            valueAtPath(rightEntry.values, sort.path) === null,
        ),
        rightValue = valueAtPath(rightEntry.values, sort.path);
      if (missingComparison !== undefined) {
        return missingComparison;
      }
      if (
        leftValue !== undefined &&
        leftValue !== null &&
        rightValue !== undefined &&
        rightValue !== null
      ) {
        const valueComparison = fComparePresentSortValues(sort, leftValue, rightValue);
        if (valueComparison !== undefined) {
          return valueComparison;
        }
      }
    }
    return bCompareEntryIdentifiers(leftEntry, rightEntry);
  },
  dFilterMatchingEntries = (entries: readonly Representation[], query: Query): Representation[] =>
    entries.filter(
      (entry) =>
        entry.contentTypeId === query.contentTypeId &&
        (query.where === undefined || matchesPredicate(entry.values, query.where)),
    ),
  eCompareMissingSortValues = (leftMissing: boolean, rightMissing: boolean): number | undefined => {
    if (leftMissing === rightMissing) {
      return undefined;
    }
    if (leftMissing) {
      return ONE;
    }
    return NEGATIVE_ONE;
  },
  fComparePresentSortValues = (
    sort: Sort,
    leftValue: JsonValue,
    rightValue: JsonValue,
  ): number | undefined => {
    const comparison = compareScalar(leftValue, rightValue);
    if (comparison === ZERO) {
      return undefined;
    }
    if (sort.direction === "ascending") {
      return comparison;
    }
    return -comparison;
  },
  gResolveQueryOffset = (query: Query, generation: number, queryFingerprint: string): number => {
    if (query.cursor === undefined) {
      return ZERO;
    }
    const cursor = decodeCursor(query.cursor);
    if (cursor.generation !== generation) {
      throw Conflict.make({
        message: "Query cursor is stale after a persistence generation change",
      });
    }
    if (cursor.queryFingerprint !== queryFingerprint) {
      throw Conflict.make({ message: "Query cursor belongs to a different Query" });
    }
    return cursor.offset;
  },
  hValidatePageSize = (query: Query, limits: QueryLimits): void => {
    if (
      !Number.isSafeInteger(query.pageSize) ||
      query.pageSize <= ZERO ||
      query.pageSize > limits.maximumPageSize
    ) {
      throw InvalidInput.make({
        message: `pageSize must be between 1 and ${limits.maximumPageSize}`,
      });
    }
  },
  iValidateProjectionAndExpansionLimits = (query: Query, limits: QueryLimits): void => {
    if ((query.projection?.length ?? ZERO) > limits.maximumProjectionPaths) {
      throw InvalidInput.make({ message: "Projection exceeds the configured Query Limit" });
    }
    if ((query.expansion?.length ?? ZERO) > limits.maximumExpansionPaths) {
      throw InvalidInput.make({
        message: "Relationship Expansion exceeds the configured Query Limit",
      });
    }
  },
  jValidateQueryLimits = (query: Query, entryCount: number, limits: QueryLimits): void => {
    hValidatePageSize(query, limits);
    iValidateProjectionAndExpansionLimits(query, limits);
    if (entryCount > limits.maximumScanEntries) {
      throw UnsupportedQueryCapability.make({
        message: "Authoritative scan exceeds the configured work bound",
      });
    }
  },
  kValidateSortPaths = (sorts: readonly Sort[], fields: readonly ResolvedField[]): void => {
    for (const sort of sorts) {
      const field = findField(fields, sort.path);
      if (field === undefined) {
        throw InvalidInput.make({ message: `Unknown sort Field Path ${sort.path}` });
      }
      if (capabilitiesFor(field.kind).sortable !== true) {
        throw UnsupportedQueryCapability.make({ message: `Field ${sort.path} is not sortable` });
      }
    }
  },
  lValidateQueryPaths = (query: Query, fields: readonly ResolvedField[]): void => {
    if (query.where !== undefined) {
      validatePredicate(query.where, fields);
    }
    kValidateSortPaths(query.sort ?? [], fields);
    for (const projectionPath of query.projection ?? []) {
      if (findField(fields, projectionPath) === undefined) {
        throw InvalidInput.make({ message: `Unknown Projection Field Path ${projectionPath}` });
      }
    }
  },
  mEvaluate = ({ entries, options, query, snapshot }: Readonly<EvaluationInput>): QueryPage => {
    const aQueryFingerprint = queryFingerprintFor(query),
      bOffset = gResolveQueryOffset(query, options.generation, aQueryFingerprint),
      cContentType = snapshot.contentTypes.get(query.contentTypeId),
      dLimits = { ...defaultLimits, ...options.limits },
      eMatchingEntries = dFilterMatchingEntries(entries, query),
      fSorts = query.sort ?? [];
    jValidateQueryLimits(query, entries.length, dLimits);
    if (cContentType === undefined) {
      throw InvalidInput.make({ message: `Unknown Content Type ${query.contentTypeId}` });
    }
    lValidateQueryPaths(query, cContentType.fields);
    eMatchingEntries.sort((leftEntry, rightEntry) =>
      cCompareEntries(leftEntry, rightEntry, fSorts),
    );
    return aBuildQueryPage({
      generation: options.generation,
      matchingEntries: eMatchingEntries,
      offset: bOffset,
      pageSize: query.pageSize,
      projection: query.projection,
      queryFingerprint: aQueryFingerprint,
    });
  };

export { mEvaluate as evaluate };
