import type { FieldKind } from "./content-definition-types.ts";
import type { ValidationIssue } from "./cms-error.ts";
import { isJsonValue } from "./internal/json.ts";
import validationSupport from "./content-definition-validation-support.ts";

const {
    createValidationIssue,
    emailPattern,
    emptyLength,
    utcDatetimePattern,
    validateCalendarDate,
  } = validationSupport,
  validateAssetValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value === "string" && value.length > emptyLength) {
      return [];
    }
    return [createValidationIssue(path, "expectedAssetId", "Expected an Asset ID")];
  },
  validateBooleanValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value === "boolean") {
      return [];
    }
    return [createValidationIssue(path, "expectedBoolean", "Expected boolean")];
  },
  validateDateValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value === "string" && validateCalendarDate(value)) {
      return [];
    }
    return [createValidationIssue(path, "expectedDate", "Expected an ISO-8601 calendar date")];
  },
  validateDatetimeValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (
      typeof value === "string" &&
      utcDatetimePattern.test(value) &&
      !Number.isNaN(Date.parse(value))
    ) {
      return [];
    }
    return [
      createValidationIssue(path, "expectedDatetime", "Expected a normalized UTC ISO-8601 instant"),
    ];
  },
  validateEmailValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value === "string" && emailPattern.test(value)) {
      return [];
    }
    return [createValidationIssue(path, "expectedEmail", "Expected a valid email address")];
  },
  validateEnumValue = (
    fieldKind: Extract<FieldKind, { kind: "enum" }>,
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value === "string" && fieldKind.values.includes(value)) {
      return [];
    }
    return [
      createValidationIssue(
        path,
        "expectedEnumValue",
        `Expected one of: ${fieldKind.values.join(", ")}`,
      ),
    ];
  },
  validateJsonValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (isJsonValue(value)) {
      return [];
    }
    return [createValidationIssue(path, "expectedJsonValue", "Expected a JSON-compatible value")];
  },
  validateReferenceScalarKindValue = (
    fieldKind: FieldKind,
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (fieldKind.kind === "asset") {
      return validateAssetValue(path, value);
    }
    if (fieldKind.kind === "relationship") {
      return validateRelationshipValue(path, value);
    }
    if (fieldKind.kind === "rich-text") {
      return validateRichTextValue(path, value);
    }
    return [];
  },
  validateRelationshipValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value === "string" && value.length > emptyLength) {
      return [];
    }
    return [createValidationIssue(path, "expectedEntryId", "Expected an Entry ID")];
  },
  validateRichTextValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (isJsonValue(value) && value !== null && !Array.isArray(value) && typeof value === "object") {
      return [];
    }
    return [createValidationIssue(path, "expectedRichText", "Expected a Rich Text document")];
  },
  validateScalarKindValue = (
    fieldKind: FieldKind,
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (fieldKind.kind === "boolean") {
      return validateBooleanValue(path, value);
    }
    if (fieldKind.kind === "date") {
      return validateDateValue(path, value);
    }
    if (fieldKind.kind === "datetime") {
      return validateDatetimeValue(path, value);
    }
    if (fieldKind.kind === "email") {
      return validateEmailValue(path, value);
    }
    return validateStoredScalarKindValue(fieldKind, path, value);
  },
  validateStoredScalarKindValue = (
    fieldKind: FieldKind,
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (fieldKind.kind === "enum") {
      return validateEnumValue(fieldKind, path, value);
    }
    if (fieldKind.kind === "json") {
      return validateJsonValue(path, value);
    }
    return validateReferenceScalarKindValue(fieldKind, path, value);
  };

export default { validateScalarKindValue };
