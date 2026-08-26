import type {
  AssetManagement,
  CompiledContentType,
  EntryGeneration,
  EntryRecord,
  Field,
  RelationshipFieldKind,
  ResolvedField,
} from "./cms-entry-references-types.ts";
import {
  type CmsError,
  Conflict,
  Effect,
  InvalidInput,
  type JsonObject,
  type JsonValue,
  isJsonObject,
} from "./cms-entry-references-imports.ts";
import cmsEntryReferencesPathSupport from "./cms-entry-references-path-support.ts";
import cmsEntryReferencesRichTextSupport from "./cms-entry-references-rich-text-support.ts";

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

interface AppendAssetIdentifiersInput {
  assetIds: string[];
  value: JsonValue;
}

interface AppendRelationshipTargetsInput {
  relationships: { entryId: string; targetContentTypeIds: readonly string[] }[];
  targetContentTypeIds: readonly string[];
  value: JsonValue;
}

const { collectRichTextReferences, validateRichTextDocument } = cmsEntryReferencesRichTextSupport,
  { entryResource, fieldsAtPaths, liveRecords, project, valueAtPath } =
    cmsEntryReferencesPathSupport,
  oneOrMany = (value: JsonValue): readonly JsonValue[] => {
    if (Array.isArray(value)) {
      return value as readonly JsonValue[];
    }
    return [value];
  },
  appendAssetIdentifiers = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-249] mutable assetIds out-param is bundled in input interface.
    input: Readonly<AppendAssetIdentifiersInput>,
  ): void => {
    for (const assetId of oneOrMany(input.value)) {
      if (typeof assetId === "string") {
        input.assetIds.push(assetId);
      }
    }
  },
  appendRelationshipTargets = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-255] mutable relationships out-param is bundled in input interface.
    input: Readonly<AppendRelationshipTargetsInput>,
  ): void => {
    for (const entryId of oneOrMany(input.value)) {
      if (typeof entryId === "string") {
        input.relationships.push({ entryId, targetContentTypeIds: input.targetContentTypeIds });
      }
    }
  },
  relationshipKind = (field: Readonly<Field>): RelationshipFieldKind | undefined => {
    if (field.kind.kind === "relationship") {
      return field.kind;
    }
    if (field.kind.kind === "list" && field.kind.element.kind === "relationship") {
      return field.kind.element;
    }
    return undefined;
  },
  collectAssetFieldReferences = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-253] mutable out-params are bundled in input interface.
    input: Readonly<CollectFieldReferencesInput>,
  ): void => {
    const { assetIds, field, value } = input,
      isAssetField =
        field.kind.kind === "asset" ||
        (field.kind.kind === "list" && field.kind.element.kind === "asset");
    if (isAssetField) {
      appendAssetIdentifiers({ assetIds, value });
    }
  },
  collectRelationshipFieldReferences = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-253] mutable out-params are bundled in input interface.
    input: Readonly<CollectFieldReferencesInput>,
  ): void => {
    const { field, relationships, value } = input,
      relationship = relationshipKind(field);
    if (relationship !== undefined) {
      appendRelationshipTargets({
        relationships,
        targetContentTypeIds: relationship.targetContentTypeIds,
        value,
      });
    }
  },
  collectRichTextFieldReferences = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-253] mutable out-params are bundled in input interface.
    input: Readonly<CollectFieldReferencesInput>,
  ): void => {
    const { assetIds, field, relationships, value } = input;
    if (field.kind.kind === "rich-text") {
      const richTextReferences = collectRichTextReferences(validateRichTextDocument(value));
      for (const entryId of richTextReferences.entryIds) {
        relationships.push({ entryId, targetContentTypeIds: [] });
      }
      assetIds.push(...richTextReferences.assetIds);
    }
  },
  collectFieldReferences = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-253] mutable out-params are bundled in input interface.
    input: Readonly<CollectFieldReferencesInput>,
  ): void => {
    collectRelationshipFieldReferences(input);
    collectAssetFieldReferences(input);
    collectRichTextFieldReferences(input);
  },
  collectReferences = (
    contentType: Readonly<CompiledContentType>,
    values: Readonly<JsonObject>,
  ): References => {
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
    references: Readonly<References>,
    generation: Readonly<EntryGeneration>,
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
  ensureUniqueValues = (input: Readonly<EnsureUniqueValuesInput>): void => {
    for (const { path } of fieldsAtPaths(input.contentType.fields).filter(
      (candidate) => candidate.field.unique === true,
    )) {
      const candidateValue = valueAtPath(input.values, path);
      if (candidateValue === undefined || candidateValue === null) {
        // Skip absent unique fields.
      } else {
        for (const record of input.records) {
          if (
            record.deletionRecord !== undefined ||
            record.entry.id === input.ignoredEntryId ||
            record.entry.contentTypeId !== input.contentType.definition.id
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
