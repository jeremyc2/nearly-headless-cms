import * as RichText from "./rich-text.ts";
import { Effect } from "effect";
import type { Management as AssetManagement } from "./asset.ts";
import { type CmsError, Conflict, InvalidInput } from "./cms-error.ts";
import {
  type CompiledContentType,
  type CompiledSnapshot,
  type Field,
  type RelationshipFieldKind,
  type ResolvedField,
} from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import { type JsonObject, type JsonValue, cloneJson, isJsonObject } from "./internal/json.ts";
import type { Resource } from "./operation.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";

export interface References {
  readonly relationships: readonly {
    readonly entryId: string;
    readonly targetContentTypeIds: readonly string[];
  }[];
  readonly assetIds: readonly string[];
}

export interface EnsureUniqueValuesInput {
  readonly contentType: CompiledContentType;
  readonly ignoredEntryId?: string;
  readonly records: Iterable<EntryRecord>;
  readonly values: JsonObject;
}

interface CollectFieldReferencesInput {
  readonly assetIds: string[];
  readonly field: ResolvedField;
  readonly relationships: { entryId: string; targetContentTypeIds: readonly string[] }[];
  readonly value: JsonValue;
}

const collectFieldReferences = ({
    assetIds,
    field,
    relationships,
    value,
  }: CollectFieldReferencesInput): void => {
    const isAssetField =
        field.kind.kind === "asset" ||
        (field.kind.kind === "list" && field.kind.element.kind === "asset"),
      relationship = relationshipKind(field);
    if (relationship !== undefined) {
      const entryIds = oneOrMany(value);
      for (const entryId of entryIds) {
        if (typeof entryId === "string") {
          relationships.push({
            entryId,
            targetContentTypeIds: relationship.targetContentTypeIds,
          });
        }
      }
    }
    if (isAssetField) {
      const fieldAssetIds = oneOrMany(value);
      for (const assetId of fieldAssetIds) {
        if (typeof assetId === "string") {
          assetIds.push(assetId);
        }
      }
    }
    if (field.kind.kind === "rich-text") {
      const document = RichText.validate(value),
        richTextReferences = RichText.references(document);
      for (const entryId of richTextReferences.entryIds) {
        relationships.push({ entryId, targetContentTypeIds: [] });
      }
      assetIds.push(...richTextReferences.assetIds);
    }
  },
  collectReferences = (contentType: CompiledContentType, values: JsonObject): References => {
    const assetIds: string[] = [],
      relationships: { entryId: string; targetContentTypeIds: readonly string[] }[] = [],
      visit = (fields: readonly ResolvedField[], object: JsonObject): void => {
        for (const field of fields) {
          const value = object[field.key];
          if (value === undefined || value === null) {
            // Skip absent values.
          } else if (
            field.nestedFields !== undefined &&
            field.kind.kind === "list" &&
            Array.isArray(value)
          ) {
            for (const item of value) {
              if (isJsonObject(item)) {
                visit(field.nestedFields, item);
              }
            }
          } else if (field.nestedFields !== undefined && isJsonObject(value)) {
            visit(field.nestedFields, value);
          } else {
            collectFieldReferences({ assetIds, field, relationships, value });
          }
        }
      };
    visit(contentType.fields, values);
    return { assetIds, relationships };
  },
  ensureReferences = (
    references: References,
    generation: EntryGeneration,
    assets: AssetManagement["Service"],
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* ensureReferenceTargets() {
      for (const relationship of references.relationships) {
        const target = generation.records.get(relationship.entryId);
        if (
          target === undefined ||
          target.deletionRecord !== undefined ||
          (relationship.targetContentTypeIds.length > 0 &&
            !relationship.targetContentTypeIds.includes(target.entry.contentTypeId))
        ) {
          return yield* InvalidInput.make({
            message: `Relationship target ${relationship.entryId} does not exist in an allowed Content Type`,
          });
        }
      }
      for (const assetId of references.assetIds) {
        yield* assets.get(assetId);
      }
      return yield* Effect.void;
    }),
  ensureUniqueValues = ({
    contentType,
    ignoredEntryId,
    records,
    values,
  }: EnsureUniqueValuesInput): void => {
    for (const { path } of fieldsAtPaths(contentType.fields).filter(
      (candidate) => candidate.field.unique === true,
    )) {
      const candidateValue = valueAtPath(values, path);
      if (candidateValue === undefined || candidateValue === null) {
        // Skip absent unique fields.
      } else {
        for (const record of records) {
          if (
            record.deletionRecord !== undefined ||
            record.entry.id === ignoredEntryId ||
            record.entry.contentTypeId !== contentType.definition.id
          ) {
            // Skip deleted, ignored, or foreign entries.
          } else if (
            JSON.stringify(valueAtPath(record.entry.values, path)) ===
            JSON.stringify(candidateValue)
          ) {
            throw Conflict.make({
              message: `Unique Field ${path.join(".")} already contains this value`,
            });
          }
        }
      }
    }
  },
  entryResource = (
    snapshot: CompiledSnapshot,
    contentTypeId: string,
    entryId?: string,
  ): Resource => {
    const base = {
      contentTypeId,
      definitionSpaceId: snapshot.definitionSpaceId,
      kind: "entry",
    } as const;
    if (entryId === undefined) {
      return base;
    }
    return { ...base, entryId };
  },
  fieldsAtPaths = (
    fields: readonly ResolvedField[],
    parentPath: readonly string[] = [],
  ): readonly { readonly field: ResolvedField; readonly path: readonly string[] }[] =>
    fields.flatMap((field) => {
      const path = [...parentPath, field.key];
      let descendants: readonly {
        readonly field: ResolvedField;
        readonly path: readonly string[];
      }[] = [];
      if (field.nestedFields !== undefined) {
        descendants = fieldsAtPaths(field.nestedFields, path);
      }
      return [{ field, path }, ...descendants];
    }),
  liveRecords = (generation: EntryGeneration): readonly EntryRecord[] =>
    [...generation.records.values()].filter((record) => record.deletionRecord === undefined),
  oneOrMany = (value: JsonValue): readonly JsonValue[] => {
    if (Array.isArray(value)) {
      return value as readonly JsonValue[];
    }
    return [value];
  },
  project = (entry: Representation, projection: readonly string[] | undefined): Representation => {
    if (projection === undefined) {
      return structuredClone(entry);
    }
    const values: Record<string, JsonValue> = {};
    for (const path of projection) {
      const segments = path.split("."),
        projectedValue = valueAtPath(entry.values, segments);
      if (projectedValue === undefined) {
        // Skip absent projection paths.
      } else {
        setProjectedValue(values, segments, projectedValue);
      }
    }
    return { contentTypeId: entry.contentTypeId, id: entry.id, values };
  },
  relationshipKind = (field: Field): RelationshipFieldKind | undefined => {
    if (field.kind.kind === "relationship") {
      return field.kind;
    }
    if (field.kind.kind === "list" && field.kind.element.kind === "relationship") {
      return field.kind.element;
    }
    return undefined;
  },
  setProjectedValue = (
    values: Record<string, JsonValue>,
    segments: readonly string[],
    value: JsonValue,
  ): void => {
    let current = values;
    for (const [index, segment] of segments.entries()) {
      if (index === segments.length - 1) {
        current[segment] = cloneJson(value);
      } else {
        const existing = current[segment];
        let nested: Record<string, JsonValue> = {};
        if (isJsonObject(existing)) {
          nested = { ...existing };
        }
        current[segment] = nested;
        current = nested;
      }
    }
  },
  valueAtPath = (values: JsonObject, path: readonly string[]): JsonValue | undefined => {
    let current: JsonValue | undefined = values;
    for (const segment of path) {
      if (!isJsonObject(current)) {
        return undefined;
      }
      current = current[segment];
    }
    return current;
  };

export default {
  collectReferences,
  ensureReferences,
  ensureUniqueValues,
  entryResource,
  liveRecords,
  project,
  relationshipKind,
  valueAtPath,
};
