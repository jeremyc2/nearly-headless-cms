import {
  type CompiledSnapshot,
  type EntryGeneration,
  type Field,
  InvalidInput,
  type JsonObject,
  type JsonValue,
  type RelationshipFieldKind,
  type Representation,
  UnsupportedQueryCapability,
  capabilitiesFor,
  cloneJson,
} from "./cms-entry-expansion-relationship-imports.ts";

interface ExpandRelationshipEntryIdInput {
  readonly ancestorEntryIds: ReadonlySet<string>;
  readonly entryId: JsonValue;
  readonly expandRepresentation: (input: {
    readonly ancestorEntryIds: ReadonlySet<string>;
    readonly entry: Representation;
    readonly expansion: readonly string[];
    readonly generation: EntryGeneration;
    readonly snapshot: CompiledSnapshot;
  }) => Representation;
  readonly fieldPath: string;
  readonly generation: EntryGeneration;
  readonly nestedPaths: readonly string[];
  readonly relationship: RelationshipFieldKind;
  readonly snapshot: CompiledSnapshot;
}

interface ExpandRelationshipFieldInput {
  readonly ancestorEntryIds: ReadonlySet<string>;
  readonly expandRelationshipEntryId: (
    input: Omit<
      ExpandRelationshipEntryIdInput,
      "expandRelationshipEntryId" | "expandRepresentation"
    >,
  ) => JsonValue;
  readonly fieldKind: Field["kind"];
  readonly fieldKey: string;
  readonly fieldPath: string;
  readonly generation: EntryGeneration;
  readonly nestedPaths: readonly string[];
  readonly relationship: RelationshipFieldKind;
  readonly snapshot: CompiledSnapshot;
  readonly value: JsonValue;
  values: Record<string, JsonValue>;
}

const expandedEntryValue = (entry: Readonly<Representation>): JsonObject => ({
  contentTypeId: entry.contentTypeId,
  id: entry.id,
  values: cloneJson(entry.values),
}),

 loadRelationshipTarget = (input: {
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly relationship: RelationshipFieldKind;
}): NonNullable<ReturnType<EntryGeneration["records"]["get"]>> => {
  const { entryId, generation, relationship } = input,
   target = generation.records.get(entryId);
  if (
    target === undefined ||
    target.deletionRecord !== undefined ||
    !relationship.targetContentTypeIds.includes(target.entry.contentTypeId)
  ) {
    throw InvalidInput.make({
      message: `Relationship target ${entryId} does not exist in an allowed Content Type`,
    });
  }
  return target;
},

 // oxlint-disable-next-line eslint/sort-vars -- [EH-131] helper declaration order follows dependency order.
 expandRelationshipEntryId = (
  input: Readonly<ExpandRelationshipEntryIdInput>,
): JsonValue => {
  const {
    ancestorEntryIds,
    entryId,
    expandRepresentation,
    fieldPath,
    generation,
    nestedPaths,
    relationship,
    snapshot,
  } = input;
  if (typeof entryId !== "string") {
    throw InvalidInput.make({
      message: `Relationship ${fieldPath} contains an invalid Entry ID`,
    });
  }
  if (ancestorEntryIds.has(entryId)) {
    return entryId;
  }
  // oxlint-disable-next-line eslint/one-var -- [EH-125] helpers with readonly disables must stay as separate const declarations.
  const target = loadRelationshipTarget({
    entryId,
    generation,
    relationship,
  });
  let expandedTarget: Representation = structuredClone(target.entry);
  if (nestedPaths.length > 0) {
    expandedTarget = expandRepresentation({
      ancestorEntryIds,
      entry: target.entry,
      expansion: nestedPaths,
      generation,
      snapshot,
    });
  }
  return expandedEntryValue(expandedTarget);
},

 expandRelationshipField = (
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-191] mutable values out-param is bundled in input interface.
  input: Readonly<ExpandRelationshipFieldInput>,
): void => {
  const {
    ancestorEntryIds,
    expandRelationshipEntryId: resolveRelationshipEntryId,
    fieldKind,
    fieldKey,
    fieldPath,
    generation,
    nestedPaths,
    relationship,
    snapshot,
    value,
    values,
  } = input;
  if (
    fieldKind.capabilities?.expandable === false ||
    (fieldKind.capabilities === undefined &&
      fieldKind.kind !== "list" &&
      capabilitiesFor(fieldKind).expandable !== true)
  ) {
    throw UnsupportedQueryCapability.make({
      message: `Field ${fieldPath} does not support Relationship Expansion`,
    });
  }
  // oxlint-disable-next-line eslint/one-var -- [EH-125] helpers with readonly disables must stay as separate const declarations.
  const expandEntryId = (candidateEntryId: JsonValue): JsonValue =>
    resolveRelationshipEntryId({
      ancestorEntryIds,
      entryId: candidateEntryId,
      fieldPath,
      generation,
      nestedPaths,
      relationship,
      snapshot,
    });
  if (Array.isArray(value)) {
    values[fieldKey] = value.map((item: JsonValue) => expandEntryId(item));
    return;
  }
  values[fieldKey] = expandEntryId(value);
};

export default {
  expandRelationshipEntryId,
  expandRelationshipField,
};

export type { ExpandRelationshipEntryIdInput };
