import type { CustomFieldRegistration, Field, JsonValue } from "./content-definition-types.ts";
import type { ValidationIssue } from "./cms-error.ts";
import validationSupport from "./content-definition-validation-support.ts";
import valueValidation from "./content-definition-value-validation.ts";

interface ValidateFieldDefaultValuePresenceInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly field: Field;
  readonly issues: ValidationIssue[];
  readonly path: readonly (string | number)[];
}

const { createValidationIssue, customIdentifierPattern, emptyLength, validateIdentifier } =
    validationSupport,
  { validateValue } = valueValidation,
  validateCustomFieldKind = (
    field: Field,
    path: readonly (string | number)[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ValidationIssue[] => {
    if (field.kind.kind !== "custom") {
      return [];
    }
    return [
      ...validateCustomFieldKindIdentifier(field.kind, path),
      ...validateCustomFieldKindRegistration(field.kind, path, customRegistrations),
    ];
  },
  validateCustomFieldKindConfiguration = (
    configuration: JsonValue,
    path: readonly (string | number)[],
    registration: CustomFieldRegistration,
  ): readonly ValidationIssue[] =>
    registration.validateConfiguration(configuration).map((configurationIssue) =>
      Object.assign(configurationIssue, {
        path: [...path, "kind", "configuration", ...configurationIssue.path],
      }),
    ),
  validateCustomFieldKindIdentifier = (
    fieldKind: Extract<Field["kind"], { kind: "custom" }>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (customIdentifierPattern.test(fieldKind.identifier)) {
      return [];
    }
    return [
      createValidationIssue(
        [...path, "kind", "identifier"],
        "invalidCustomIdentifier",
        "Custom Field Kind identifiers must use reverse-domain form",
      ),
    ];
  },
  validateCustomFieldKindRegistration = (
    fieldKind: Extract<Field["kind"], { kind: "custom" }>,
    path: readonly (string | number)[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ValidationIssue[] => {
    const registration = customRegistrations.get(
      `${fieldKind.identifier}@${fieldKind.formatVersion}`,
    );
    if (registration === undefined) {
      return [
        createValidationIssue(
          [...path, "kind"],
          "unknownCustomFieldKind",
          `Unknown Custom Field Kind ${fieldKind.identifier}@${fieldKind.formatVersion}`,
        ),
      ];
    }
    return validateCustomFieldKindConfiguration(fieldKind.configuration, path, registration);
  },
  validateEnumFieldKind = (
    field: Field,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (field.kind.kind !== "enum") {
      return [];
    }
    if (
      field.kind.values.length === emptyLength ||
      new Set(field.kind.values).size !== field.kind.values.length
    ) {
      return [
        createValidationIssue(
          [...path, "kind", "values"],
          "invalidEnumValues",
          "Enum values must be non-empty and distinct",
        ),
      ];
    }
    return [];
  },
  validateFieldDefaultValue = (
    field: Field,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (field.required === true && field.defaultValue === null && field.nullable !== true) {
      return [
        createValidationIssue(
          [...path, "defaultValue"],
          "invalidDefault",
          "A non-nullable Field cannot default to null",
        ),
      ];
    }
    return [];
  },
  validateFieldDefaultValuePresence = <Input extends ValidateFieldDefaultValuePresenceInput>({
    customRegistrations,
    field,
    issues,
    path,
  }: Readonly<Input>): void => {
    if (field.defaultValue !== undefined) {
      issues.push(
        ...validateValue({
          customRegistrations,
          fieldKind: field.kind,
          path: [...path, "defaultValue"],
          value: field.defaultValue,
        }),
      );
    }
  },
  validateFieldDefinition = (
    field: Field,
    path: readonly (string | number)[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ValidationIssue[] => {
    const issues = [
      ...validateIdentifier(field.key, [...path, "key"]),
      ...validateFieldLabel(field, path),
      ...validateFieldDefaultValue(field, path),
      ...validateFieldUniqueness(field, path),
      ...validateEnumFieldKind(field, path),
      ...validateRelationshipFieldKind(field, path),
      ...validateCustomFieldKind(field, path, customRegistrations),
    ];
    validateFieldDefaultValuePresence({ customRegistrations, field, issues, path });
    return issues;
  },
  validateFieldLabel = (
    field: Field,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (field.label.trim().length === emptyLength) {
      return [
        createValidationIssue([...path, "label"], "requiredLabel", "Field label cannot be empty"),
      ];
    }
    return [];
  },
  validateFieldUniqueness = (
    field: Field,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (
      field.unique === true &&
      ["json", "rich-text", "list", "asset", "relationship", "custom"].includes(field.kind.kind)
    ) {
      return [
        createValidationIssue(
          [...path, "unique"],
          "unsupportedUniqueField",
          "Only non-null scalar Fields can be unique",
        ),
      ];
    }
    return [];
  },
  validateRelationshipFieldKind = (
    field: Field,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (field.kind.kind !== "relationship") {
      return [];
    }
    if (field.kind.targetContentTypeIds.length === emptyLength) {
      return [
        createValidationIssue(
          [...path, "kind", "targetContentTypeIds"],
          "missingRelationshipTarget",
          "A Relationship Field requires a target Content Type",
        ),
      ];
    }
    return [];
  };

export default { validateFieldDefinition };
