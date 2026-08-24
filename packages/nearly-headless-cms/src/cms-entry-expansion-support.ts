import referencesSupport from "./cms-entry-references-support.ts";
import { InvalidInput, UnsupportedQueryCapability } from "./cms-error.ts";
import {
  type CompiledSnapshot,
  type Field,
  type RelationshipFieldKind,
  type ResolvedField,
  capabilitiesFor,
} from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import { type JsonObject, type JsonValue, cloneJson, isJsonObject } from "./internal/json.ts";
import type { EntryGeneration } from "./persistence.ts";

interface ExpandFieldGroupInput {
  readonly expandObjectInput: ExpandObjectInput;
  readonly field: ResolvedField;
  readonly fieldKey: string;
  readonly fieldPath: string;
  readonly nestedPaths: readonly string[];
  readonly value: JsonValue;
  readonly values: Record<string, JsonValue>;
}

interface ExpandObjectInput {
  readonly ancestorEntryIds: ReadonlySet<string>;
  readonly expansion: readonly string[];
  readonly fields: readonly ResolvedField[];
  readonly generation: EntryGeneration;
  readonly object: JsonObject;
  readonly parentPath?: string;
  readonly snapshot: CompiledSnapshot;
}

interface ExpandRepresentationInput {
  readonly ancestorEntryIds?: ReadonlySet<string>;
  readonly entry: Representation;
  readonly expansion?: readonly string[];
  readonly generation: EntryGeneration;
  readonly snapshot: CompiledSnapshot;
}

const { relationshipKind } = referencesSupport,
  expandFieldGroup = ({
    expandObjectInput,
    field,
    fieldKey,
    fieldPath,
    nestedPaths,
    value,
    values,
  }: ExpandFieldGroupInput): void => {
    const { nestedFields } = field;
    if (nestedFields === undefined) {
      throw InvalidInput.make({ message: `Field Group ${fieldPath} has no nested fields` });
    }
    if (field.kind.kind === "list") {
      if (!Array.isArray(value)) {
        throw InvalidInput.make({
          message: `Field Group List ${fieldPath} contains an invalid value`,
        });
      }
      values[fieldKey] = value.map((item) => {
        if (!isJsonObject(item)) {
          throw InvalidInput.make({
            message: `Field Group List ${fieldPath} contains an invalid item`,
          });
        }
        return expandObject({
          ...expandObjectInput,
          expansion: nestedPaths,
          fields: nestedFields,
          object: item,
          parentPath: fieldPath,
        });
      });
      return;
    }
    if (!isJsonObject(value)) {
      throw InvalidInput.make({ message: `Field Group ${fieldPath} contains an invalid value` });
    }
    values[fieldKey] = expandObject({
      ...expandObjectInput,
      expansion: nestedPaths,
      fields: nestedFields,
      object: value,
      parentPath: fieldPath,
    });
  },
  expandObject = ({
    ancestorEntryIds,
    expansion,
    fields,
    generation,
    object,
    parentPath = "",
    snapshot,
  }: ExpandObjectInput): JsonObject => {
    const values: Record<string, JsonValue> = Object.fromEntries(
      Object.entries(object).map(([key, value]) => [key, cloneJson(value)]),
    );
    for (const [fieldKey, nestedPaths] of groupExpansionPaths(expansion)) {
      let fieldPath = fieldKey;
      if (parentPath.length > 0) {
        fieldPath = `${parentPath}.${fieldKey}`;
      }
      const field = fields.find((candidate) => candidate.key === fieldKey);
      if (field === undefined) {
        throw InvalidInput.make({ message: `Field ${fieldPath} is not expandable` });
      }
      const relationship = relationshipKind(field),
        value = values[fieldKey];
      if (value === undefined || value === null) {
        // Skip absent values.
      } else if (relationship === undefined) {
        if (field.nestedFields === undefined || nestedPaths.length === 0) {
          throw InvalidInput.make({
            message: `Field ${fieldPath} is not an expandable Relationship`,
          });
        }
        expandFieldGroup({
          expandObjectInput: {
            ancestorEntryIds,
            expansion,
            fields,
            generation,
            object,
            parentPath,
            snapshot,
          },
          field,
          fieldKey,
          fieldPath,
          nestedPaths,
          value,
          values,
        });
      } else {
        expandRelationshipField({
          ancestorEntryIds,
          fieldKey,
          fieldKind: field.kind,
          fieldPath,
          generation,
          nestedPaths,
          relationship,
          snapshot,
          value,
          values,
        });
      }
    }
    return values;
  },
  expandRelationshipEntryId = (input: {
    readonly ancestorEntryIds: ReadonlySet<string>;
    readonly entryId: JsonValue;
    readonly fieldPath: string;
    readonly generation: EntryGeneration;
    readonly nestedPaths: readonly string[];
    readonly relationship: RelationshipFieldKind;
    readonly snapshot: CompiledSnapshot;
  }): JsonValue => {
    const {
      ancestorEntryIds,
      entryId,
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
    const target = generation.records.get(entryId);
    if (
      target === undefined ||
      target.deletionRecord !== undefined ||
      !relationship.targetContentTypeIds.includes(target.entry.contentTypeId)
    ) {
      throw InvalidInput.make({
        message: `Relationship target ${entryId} does not exist in an allowed Content Type`,
      });
    }
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
  expandedEntryValue = (entry: Representation): JsonObject => ({
    contentTypeId: entry.contentTypeId,
    id: entry.id,
    values: cloneJson(entry.values),
  }),
  expandRelationshipField = (input: {
    readonly ancestorEntryIds: ReadonlySet<string>;
    readonly fieldKind: Field["kind"];
    readonly fieldKey: string;
    readonly fieldPath: string;
    readonly generation: EntryGeneration;
    readonly nestedPaths: readonly string[];
    readonly relationship: RelationshipFieldKind;
    readonly snapshot: CompiledSnapshot;
    readonly value: JsonValue;
    readonly values: Record<string, JsonValue>;
  }): void => {
    const {
      ancestorEntryIds,
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
    const expandEntryId = (candidateEntryId: JsonValue): JsonValue =>
      expandRelationshipEntryId({
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
    } else {
      values[fieldKey] = expandEntryId(value);
    }
  },
  expandRepresentation = ({
    ancestorEntryIds = new Set(),
    entry,
    expansion,
    generation,
    snapshot,
  }: ExpandRepresentationInput): Representation => {
    if (expansion === undefined || expansion.length === 0) {
      return structuredClone(entry);
    }
    const contentType = snapshot.contentTypes.get(entry.contentTypeId);
    if (contentType === undefined) {
      throw InvalidInput.make({ message: `Unknown Content Type ${entry.contentTypeId}` });
    }
    const nextAncestors = new Set(ancestorEntryIds).add(entry.id),
      values = expandObject({
        ancestorEntryIds: nextAncestors,
        expansion,
        fields: contentType.fields,
        generation,
        object: entry.values,
        snapshot,
      });
    return { contentTypeId: entry.contentTypeId, id: entry.id, values };
  },
  groupExpansionPaths = (paths: readonly string[]): ReadonlyMap<string, readonly string[]> => {
    if (paths.length > maximumExpansionPaths) {
      throw InvalidInput.make({
        message: `Relationship Expansion cannot contain more than ${maximumExpansionPaths} paths`,
      });
    }
    const grouped = new Map<string, string[]>();
    for (const path of paths) {
      const segments = path.split("."),
        remainder = segments.slice(1).join("."),
        root = segments[0] ?? "";
      if (segments.some((segment) => segment.length === 0)) {
        throw InvalidInput.make({ message: `Invalid Relationship Expansion path ${path}` });
      }
      if (segments.length > maximumExpansionDepth) {
        throw InvalidInput.make({
          message: `Relationship Expansion cannot exceed ${maximumExpansionDepth} levels`,
        });
      }
      const nested = grouped.get(root) ?? [];
      if (remainder.length > 0) {
        nested.push(remainder);
      }
      grouped.set(root, nested);
    }
    return grouped;
  },
  maximumExpansionDepth = 8,
  maximumExpansionPaths = 20;

export default {
  expandObject,
  expandRepresentation,
};
