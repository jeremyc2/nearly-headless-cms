import type {
  ContentTypeDefinition,
  CustomFieldRegistration,
  Definition,
  FieldGroupDefinition,
  ResolvedField,
} from "./content-definition-types.ts";
import fieldValidation from "./content-definition-field-validation.ts";
import validationSupport from "./content-definition-validation-support.ts";

interface ResolveFieldsInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly definition: ContentTypeDefinition | FieldGroupDefinition;
  readonly definitions: ReadonlyMap<string, Definition>;
  readonly resolving: readonly string[];
}

const { createValidationIssue, emptyLength, failValidation } = validationSupport,
  { validateFieldDefinition } = fieldValidation,
  appendComposedFieldGroup = (
    fields: ResolvedField[],
    input: ResolveFieldsInput,
    composition: NonNullable<ContentTypeDefinition["fieldGroups"]>[number],
  ): void => {
    const composedFields = ((): readonly ResolvedField[] => {
      const target = input.definitions.get(composition.fieldGroupId);
      if (target === undefined || target.kind !== "fieldGroup") {
        return failValidation("Missing Field Group", [
          createValidationIssue(
            ["definitions", input.definition.id, "fieldGroups"],
            "missingFieldGroup",
            `Field Group ${composition.fieldGroupId} does not exist`,
          ),
        ]);
      }
      return resolveComposedFields(input, target);
    })();
    if (composition.mode === "inline") {
      fields.push(...composedFields);
      return;
    }
    fields.push(composeFieldGroup(composition, composedFields));
  },
  assertUniqueFieldKeys = (definitionId: string, fields: readonly ResolvedField[]): void => {
    const duplicateKey = fields.find(
      (field, index) => fields.findIndex((candidate) => candidate.key === field.key) !== index,
    )?.key;
    if (duplicateKey !== undefined) {
      failValidation("Field key collision", [
        createValidationIssue(
          ["definitions", definitionId, "fields"],
          "fieldKeyCollision",
          `Field key ${duplicateKey} is included more than once`,
        ),
      ]);
    }
  },
  composeFieldGroup = (
    composition: Extract<NonNullable<ContentTypeDefinition["fieldGroups"]>[number], { mode: "nested" }>,
    composedFields: readonly ResolvedField[],
  ): ResolvedField => ({
    key: composition.key,
    kind: { kind: "json" },
    label: composition.label,
    nestedFields: composedFields,
    nullable: composition.nullable,
    required: composition.required,
  }),
  resolveComposedFields = (
    input: ResolveFieldsInput,
    target: FieldGroupDefinition,
  ): readonly ResolvedField[] =>
    resolveFields({
      customRegistrations: input.customRegistrations,
      definition: target,
      definitions: input.definitions,
      resolving: [...input.resolving, input.definition.id],
    }),
  resolveFields = (input: ResolveFieldsInput): readonly ResolvedField[] => {
    if (input.resolving.includes(input.definition.id)) {
      failValidation("Field Group inclusion cycle", [
        createValidationIssue(
          ["definitions", input.definition.id],
          "fieldGroupCycle",
          `Field Group inclusion cycle: ${[...input.resolving, input.definition.id].join(" -> ")}`,
        ),
      ]);
    }
    const fields: ResolvedField[] = [...input.definition.fields];
    for (const [fieldIndex, field] of fields.entries()) {
      validateResolvedField(field, fieldIndex, input);
      fields[fieldIndex] = resolveListFieldGroupElement(fieldIndex, input, field);
    }
    for (const composition of input.definition.fieldGroups ?? []) {
      appendComposedFieldGroup(fields, input, composition);
    }
    assertUniqueFieldKeys(input.definition.id, fields);
    return fields;
  },
  resolveListFieldGroupElement = (
    fieldIndex: number,
    input: ResolveFieldsInput,
    field: ResolvedField,
  ): ResolvedField => {
    if (field.kind.kind !== "list" || field.kind.element.kind !== "fieldGroup") {
      return field;
    }
    const target = input.definitions.get(field.kind.element.fieldGroupId);
    if (target === undefined) {
      return failValidation("Missing Field Group", [
        createValidationIssue(
          ["definitions", input.definition.id, "fields", fieldIndex, "kind", "element"],
          "missingFieldGroup",
          `Field Group ${field.kind.element.fieldGroupId} does not exist`,
        ),
      ]);
    }
    if (target.kind !== "fieldGroup") {
      return failValidation("Invalid Field Group", [
        createValidationIssue(
          ["definitions", input.definition.id, "fields", fieldIndex, "kind", "element"],
          "invalidFieldGroup",
          `${target.id} is not a Field Group`,
        ),
      ]);
    }
    return {
      ...field,
      nestedFields: resolveFields({
        customRegistrations: input.customRegistrations,
        definition: target,
        definitions: input.definitions,
        resolving: [...input.resolving, input.definition.id],
      }),
    };
  },
  validateResolvedField = (
    field: ResolvedField,
    fieldIndex: number,
    input: ResolveFieldsInput,
  ): void => {
    const fieldIssues = validateFieldDefinition(
      field,
      ["definitions", input.definition.id, "fields", fieldIndex],
      input.customRegistrations,
    );
    if (fieldIssues.length > emptyLength) {
      failValidation("Invalid Field definition", fieldIssues);
    }
  };

export default { resolveFields };
