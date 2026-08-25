import type {
  CustomFieldRegistration,
  FieldKind,
  ListFieldKind,
  NumericFieldKind,
  TextFieldKind,
} from "./content-definition-types.ts";
import type { ValidationIssue } from "./cms-error.ts";
import { isJsonValue } from "./internal/json.ts";
import scalarValueValidation from "./content-definition-scalar-value-validation.ts";
import validationSupport from "./content-definition-validation-support.ts";

interface ValidateCustomValueInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly fieldKind: Extract<FieldKind, { kind: "custom" }>;
  readonly path: readonly (string | number)[];
  readonly value: unknown;
}

interface ValidateListValueInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly fieldKind: ListFieldKind;
  readonly path: readonly (string | number)[];
  readonly value: unknown;
}

interface ValidateNumericBoundInput {
  readonly fieldKind: NumericFieldKind;
  readonly issues: ValidationIssue[];
  readonly path: readonly (string | number)[];
  readonly value: number;
}

const { createValidationIssue } = validationSupport,
  { validateScalarKindValue } = scalarValueValidation,
  validateCustomValue = ({
    customRegistrations,
    fieldKind,
    path,
    value,
  }: Readonly<ValidateCustomValueInput>): readonly ValidationIssue[] => {
    if (!isJsonValue(value)) {
      return [
        createValidationIssue(
          path,
          "expectedJsonValue",
          "Expected a JSON-compatible custom Field value",
        ),
      ];
    }
    const registration = customRegistrations.get(
      `${fieldKind.identifier}@${fieldKind.formatVersion}`,
    );
    if (registration === undefined) {
      return [
        createValidationIssue(
          path,
          "unknownCustomFieldKind",
          `Unknown Custom Field Kind ${fieldKind.identifier}@${fieldKind.formatVersion}`,
        ),
      ];
    }
    return registration
      .validateValue(value, fieldKind.configuration)
      .map((customIssue) => Object.assign(customIssue, { path: [...path, ...customIssue.path] }));
  },
  validateListBounds = <BoundFieldKind extends ListFieldKind>(
    fieldKind: Readonly<BoundFieldKind>,
    path: readonly (string | number)[],
    value: readonly unknown[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (fieldKind.minimumLength !== undefined && value.length < fieldKind.minimumLength) {
      issues.push(
        createValidationIssue(
          path,
          "tooFewItems",
          `Must contain at least ${fieldKind.minimumLength} items`,
        ),
      );
    }
    if (fieldKind.maximumLength !== undefined && value.length > fieldKind.maximumLength) {
      issues.push(
        createValidationIssue(
          path,
          "tooManyItems",
          `Must contain at most ${fieldKind.maximumLength} items`,
        ),
      );
    }
    if (
      fieldKind.distinct === true &&
      new Set(value.map((item) => JSON.stringify(item))).size !== value.length
    ) {
      issues.push(createValidationIssue(path, "duplicateListItem", "List items must be distinct"));
    }
    return issues;
  },
  validateListElements = <
    Input extends ValidateListValueInput & { readonly value: readonly unknown[] },
  >(
    input: Readonly<Input>,
  ): readonly ValidationIssue[] => {
    const { customRegistrations, fieldKind, path, value } = input,
      {element} = fieldKind,
      issues: ValidationIssue[] = [];
    if (element.kind === "fieldGroup") {
      return issues;
    }
    for (const [index, child] of value.entries()) {
      issues.push(
        ...validateValue({
          customRegistrations,
          fieldKind: element,
          path: [...path, index],
          value: child,
        }),
      );
    }
    return issues;
  },
  validateListValue = ({
    customRegistrations,
    fieldKind,
    path,
    value,
  }: Readonly<ValidateListValueInput>): readonly ValidationIssue[] => {
    if (!Array.isArray(value)) {
      return [createValidationIssue(path, "expectedList", "Expected a list")];
    }
    return [
      ...validateListBounds(fieldKind, path, value),
      ...validateListElements({ customRegistrations, fieldKind, path, value }),
    ];
  },
  validateNumericMaximum = <Input extends ValidateNumericBoundInput>(
    input: Readonly<Input>,
  ): void => {
    const { fieldKind, issues, path, value } = input;
    if (fieldKind.maximum !== undefined && value > fieldKind.maximum) {
      issues.push(
        createValidationIssue(path, "aboveMaximum", `Must be at most ${fieldKind.maximum}`),
      );
    }
  },
  validateNumericMinimum = <Input extends ValidateNumericBoundInput>(
    input: Readonly<Input>,
  ): void => {
    const { fieldKind, issues, path, value } = input;
    if (fieldKind.minimum !== undefined && value < fieldKind.minimum) {
      issues.push(
        createValidationIssue(path, "belowMinimum", `Must be at least ${fieldKind.minimum}`),
      );
    }
  },
  validateNumericValue = (
    fieldKind: NumericFieldKind,
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (
      typeof value !== "number" ||
      !Number.isFinite(value) ||
      (fieldKind.kind === "integer" && !Number.isSafeInteger(value))
    ) {
      let reason = "expectedFiniteNumber";
      if (fieldKind.kind === "integer") {
        reason = "expectedSafeInteger";
      }
      return [createValidationIssue(path, reason, `Expected ${fieldKind.kind}`)];
    }
    const issues: ValidationIssue[] = [];
    validateNumericMinimum({ fieldKind, issues, path, value });
    validateNumericMaximum({ fieldKind, issues, path, value });
    return issues;
  },
  validateStructuredValue = ({
    customRegistrations,
    fieldKind,
    path,
    value,
  }: {
    readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
    readonly fieldKind: FieldKind;
    readonly path: readonly (string | number)[];
    readonly value: unknown;
  }): readonly ValidationIssue[] => {
    if (fieldKind.kind === "list") {
      return validateListValue({ customRegistrations, fieldKind, path, value });
    }
    if (fieldKind.kind === "custom") {
      return validateCustomValue({ customRegistrations, fieldKind, path, value });
    }
    return validateScalarKindValue(fieldKind, path, value);
  },
  validateTextValue = (
    fieldKind: TextFieldKind,
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value !== "string") {
      return [createValidationIssue(path, "expectedText", "Expected text")];
    }
    const issues: ValidationIssue[] = [];
    if (fieldKind.minLength !== undefined && value.length < fieldKind.minLength) {
      issues.push(
        createValidationIssue(
          path,
          "tooShort",
          `Must contain at least ${fieldKind.minLength} characters`,
        ),
      );
    }
    if (fieldKind.maxLength !== undefined && value.length > fieldKind.maxLength) {
      issues.push(
        createValidationIssue(
          path,
          "tooLong",
          `Must contain at most ${fieldKind.maxLength} characters`,
        ),
      );
    }
    if (fieldKind.pattern !== undefined && !new RegExp(fieldKind.pattern, "u").test(value)) {
      issues.push(createValidationIssue(path, "pattern", "Does not match the required pattern"));
    }
    return issues;
  },
  validateUrlValue = (
    path: readonly (string | number)[],
    value: unknown,
  ): readonly ValidationIssue[] => {
    if (typeof value !== "string") {
      return [createValidationIssue(path, "expectedUrl", "Expected URL text")];
    }
    try {
      const parsedUrl = new URL(value);
      if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
        return [];
      }
      return [createValidationIssue(path, "unsupportedUrlProtocol", "URL must use HTTP or HTTPS")];
    } catch {
      return [createValidationIssue(path, "expectedUrl", "Expected a valid URL")];
    }
  },
  validateValue = ({
    customRegistrations,
    fieldKind,
    path,
    value,
  }: {
    readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
    readonly fieldKind: FieldKind;
    readonly path: readonly (string | number)[];
    readonly value: unknown;
  }): readonly ValidationIssue[] => {
    if (fieldKind.kind === "text") {
      return validateTextValue(fieldKind, path, value);
    }
    if (fieldKind.kind === "integer" || fieldKind.kind === "number") {
      return validateNumericValue(fieldKind, path, value);
    }
    if (fieldKind.kind === "url") {
      return validateUrlValue(path, value);
    }
    return validateStructuredValue({ customRegistrations, fieldKind, path, value });
  };

export default { validateValue };
