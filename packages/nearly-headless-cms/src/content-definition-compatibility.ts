import type { Compatibility, CompiledContentType, CompiledSnapshot, ResolvedField } from "./content-definition-types.ts";
import { dual } from "effect/Function";

const // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
  classifyCompatibility = dual(
    2,
    (source: CompiledSnapshot, target: CompiledSnapshot): Compatibility => {
      for (const [contentTypeId, sourceContentType] of source.contentTypes) {
        const targetContentType = target.contentTypes.get(contentTypeId);
        if (targetContentType === undefined) {
          return "migrationRequired";
        }
        if (contentTypeRequiresMigration(sourceContentType, targetContentType)) {
          return "migrationRequired";
        }
      }
      return "compatible";
    },
  ),
  contentTypeRequiresMigration = (
    sourceContentType: CompiledContentType,
    targetContentType: CompiledContentType,
  ): boolean => {
    const targetFields = new Map(targetContentType.fields.map((field) => [field.key, field]));
    for (const sourceField of sourceContentType.fields) {
      if (sourceFieldRequiresMigration(sourceField, targetFields)) {
        return true;
      }
    }
    for (const targetField of targetContentType.fields) {
      if (targetFieldRequiresMigration(sourceContentType.fields, targetField)) {
        return true;
      }
    }
    return false;
  },
  fieldCompatibilitySignature = (field: ResolvedField): string =>
    JSON.stringify({
      kind: field.kind,
      nestedFields: field.nestedFields?.map(fieldCompatibilitySignature),
      nullable: Boolean(field.nullable),
      required: Boolean(field.required),
      unique: Boolean(field.unique),
    }),
  sourceFieldRequiresMigration = (
    sourceField: ResolvedField,
    targetFields: ReadonlyMap<string, ResolvedField>,
  ): boolean => {
    const targetField = targetFields.get(sourceField.key);
    if (targetField === undefined) {
      return true;
    }
    return fieldCompatibilitySignature(sourceField) !== fieldCompatibilitySignature(targetField);
  },
  targetFieldRequiresMigration = (
    sourceFields: readonly ResolvedField[],
    targetField: ResolvedField,
  ): boolean => {
    const sourceHasField = sourceFields.some((field) => field.key === targetField.key);
    if (sourceHasField) {
      return false;
    }
    return targetField.required === true;
  };

/** Classifies a snapshot change without modifying catalog or Entry state. */
export { classifyCompatibility };
