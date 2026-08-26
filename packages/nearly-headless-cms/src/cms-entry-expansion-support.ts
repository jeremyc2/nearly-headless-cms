import type { CompiledSnapshot, ResolvedField } from "./content-definition.ts";
import type { JsonObject, JsonValue } from "./content-definition-types.ts";
import type { EntryGeneration } from "./persistence.ts";
import { InvalidInput } from "./cms-error.ts";
import type { Representation } from "./entry.ts";
import { cloneJson } from "./internal/json.ts";
import fieldGroupSupport from "./cms-entry-expansion-field-group-support.ts";
import pathGroupingSupport from "./cms-entry-expansion-path-grouping-support.ts";
import referencesSupport from "./cms-entry-references-support.ts";
import relationshipSupport from "./cms-entry-expansion-relationship-support.ts";

interface ExpandObjectFieldInput {
  readonly ancestorEntryIds: ReadonlySet<string>;
  readonly expansion: readonly string[];
  readonly fieldKey: string;
  readonly fields: readonly ResolvedField[];
  readonly generation: EntryGeneration;
  readonly nestedPaths: readonly string[];
  readonly object: JsonObject;
  readonly parentPath: string;
  readonly snapshot: CompiledSnapshot;
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

interface ResolvedExpandableField {
  readonly field: ResolvedField;
  readonly fieldPath: string;
  readonly relationship: ReturnType<typeof referencesSupport.relationshipKind>;
  readonly value: JsonValue;
}

const { expandFieldGroup } = fieldGroupSupport,
  { groupExpansionPaths } = pathGroupingSupport,
  { expandRelationshipEntryId, expandRelationshipField } = relationshipSupport,
  { relationshipKind } = referencesSupport,
  expandNestedFieldGroup = <Input extends ExpandObjectFieldInput & ResolvedExpandableField>(
    input: Readonly<Input>,
  ): void => {
    const {
      ancestorEntryIds,
      expansion,
      field,
      fieldKey,
      fieldPath,
      fields,
      generation,
      nestedPaths,
      object,
      parentPath,
      snapshot,
      value,
      values,
    } = input;
    if (field.nestedFields === undefined || nestedPaths.length === 0) {
      throw InvalidInput.make({
        message: `Field ${fieldPath} is not an expandable Relationship`,
      });
    }
    expandFieldGroup({
      expandObject,
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
  },
  expandObject = <Input extends ExpandObjectInput>(input: Readonly<Input>): JsonObject => {
    const {
        ancestorEntryIds,
        expansion,
        fields,
        generation,
        object,
        parentPath = "",
        snapshot,
      } = input,
      values: Record<string, JsonValue> = Object.fromEntries(
        Object.entries(object).map(([key, value]) => [key, cloneJson(value)]),
      );
    for (const [fieldKey, nestedPaths] of groupExpansionPaths(expansion)) {
      expandObjectField({
        ancestorEntryIds,
        expansion,
        fieldKey,
        fields,
        generation,
        nestedPaths,
        object,
        parentPath,
        snapshot,
        values,
      });
    }
    return values;
  },
  expandObjectField = <Input extends ExpandObjectFieldInput>(input: Readonly<Input>): void => {
    const resolvedField = resolveExpandableField(input);
    if (resolvedField === undefined) {
      return;
    }
    if (resolvedField.relationship === undefined) {
      expandNestedFieldGroup({ ...input, ...resolvedField });
      return;
    }
    expandRelationshipField({
      ancestorEntryIds: input.ancestorEntryIds,
      expandRelationshipEntryId: (relationshipInput) =>
        expandRelationshipEntryId({
          ...relationshipInput,
          expandRepresentation,
        }),
      fieldKey: input.fieldKey,
      fieldKind: resolvedField.field.kind,
      fieldPath: resolvedField.fieldPath,
      generation: input.generation,
      nestedPaths: input.nestedPaths,
      relationship: resolvedField.relationship,
      snapshot: input.snapshot,
      value: resolvedField.value,
      values: input.values,
    });
  },
  expandRepresentation = <Input extends ExpandRepresentationInput>(
    input: Readonly<Input>,
  ): Representation => {
    const { ancestorEntryIds = new Set(), entry, expansion, generation, snapshot } = input,
      contentType = snapshot.contentTypes.get(entry.contentTypeId);
    if (expansion === undefined || expansion.length === 0) {
      return structuredClone(entry);
    }
    if (contentType === undefined) {
      throw InvalidInput.make({ message: `Unknown Content Type ${entry.contentTypeId}` });
    }
    return {
      contentTypeId: entry.contentTypeId,
      id: entry.id,
      values: expandObject({
        ancestorEntryIds: new Set(ancestorEntryIds).add(entry.id),
        expansion,
        fields: contentType.fields,
        generation,
        object: entry.values,
        snapshot,
      }),
    };
  },
  resolveExpandableField = <Input extends ExpandObjectFieldInput>(
    input: Readonly<Input>,
  ): ResolvedExpandableField | undefined => {
    const { fieldKey, fields, parentPath, values } = input,
      field = fields.find((candidate) => candidate.key === fieldKey),
      fieldPath = [parentPath, fieldKey].filter((segment) => segment.length > 0).join("."),
      value = values[fieldKey];
    if (field === undefined) {
      throw InvalidInput.make({ message: `Field ${fieldPath} is not expandable` });
    }
    if (value === undefined || value === null) {
      return undefined;
    }
    return {
      field,
      fieldPath,
      relationship: relationshipKind(field),
      value,
    };
  };

export default {
  expandObject,
  expandRepresentation,
};
export type { ExpandObjectInput, ExpandRepresentationInput };
