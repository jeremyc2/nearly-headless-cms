import type { CompiledContentType, ResolvedField } from "./content-definition-types.ts";
import validationSupport from "./content-definition-validation-support.ts";

const { createValidationIssue, failValidation } = validationSupport,
  relationshipKindForField = (
    field: ResolvedField,
  ): Extract<ResolvedField["kind"], { kind: "relationship" }> | undefined => {
    if (field.kind.kind === "relationship") {
      return field.kind;
    }
    if (field.kind.kind === "list" && field.kind.element.kind === "relationship") {
      return field.kind.element;
    }
    return undefined;
  },
  validateRelationshipField = (
    contentTypes: ReadonlyMap<string, CompiledContentType>,
    field: ResolvedField,
    fieldPath: readonly (string | number)[],
  ): void => {
    const relationshipKind = relationshipKindForField(field);
    for (const targetContentTypeId of relationshipKind?.targetContentTypeIds ?? []) {
      if (!contentTypes.has(targetContentTypeId)) {
        failValidation("Invalid Relationship target", [
          createValidationIssue(
            fieldPath,
            "missingRelationshipTarget",
            `Content Type ${targetContentTypeId} does not exist`,
          ),
        ]);
      }
    }
  },
  validateRelationshipTargets = (
    contentTypes: ReadonlyMap<string, CompiledContentType>,
    fields: readonly ResolvedField[],
    parentPath: readonly (string | number)[],
  ): void => {
    for (const field of fields) {
      const fieldPath = [...parentPath, field.key];
      validateRelationshipField(contentTypes, field, fieldPath);
      if (field.nestedFields !== undefined) {
        validateRelationshipTargets(contentTypes, field.nestedFields, fieldPath);
      }
    }
  };

export default { validateRelationshipTargets };
