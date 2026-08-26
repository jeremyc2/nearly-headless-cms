import type {
  AppendUnknownFieldIssuesInput,
  ValidateFieldsInput,
  ValidateListBoundsInput,
  ValidateListItemInput,
  ValidateListItemsInput,
  ValidateNullFieldValueInput,
  ValidatePresentFieldValueInput,
  ValidateUndefinedFieldValueInput,
} from "./content-definition-entry-validation-types.ts";
import { cloneJson, isJsonObject } from "./internal/json.ts";
import type { JsonObject, JsonValue } from "./content-definition-types.ts";
import type { ValidationIssue } from "./cms-error.ts";
import validationSupport from "./content-definition-validation-support.ts";
import valueValidation from "./content-definition-value-validation.ts";

const { createValidationIssue } = validationSupport,
  { validateValue } = valueValidation,
  appendUnknownFieldIssues = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-251] mutable issues out-param is bundled in input interface.
    input: Readonly<AppendUnknownFieldIssuesInput>,
  ): ValidationIssue[] => {
    const knownKeys = new Set(input.input.fields.map((field) => field.key));
    for (const key of Object.keys(input.input.values)) {
      if (!knownKeys.has(key)) {
        input.issues.push(
          createValidationIssue(
            [...input.input.parentPath, key],
            "unknownField",
            `Unknown Field ${[...input.input.parentPath, key].join(".")}`,
          ),
        );
      }
    }
    return input.issues;
  },
  validateListBounds = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-251] mutable issues out-param is bundled in input interface.
    input: Readonly<ValidateListBoundsInput>,
  ): void => {
    const { field, fieldPath, fieldValue, issues } = input;
    if (field.kind.kind !== "list") {
      return;
    }
    if (field.kind.minimumLength !== undefined && fieldValue.length < field.kind.minimumLength) {
      issues.push(
        createValidationIssue(
          fieldPath,
          "tooFewItems",
          `Must contain at least ${field.kind.minimumLength} items`,
        ),
      );
    }
    if (field.kind.maximumLength !== undefined && fieldValue.length > field.kind.maximumLength) {
      issues.push(
        createValidationIssue(
          fieldPath,
          "tooManyItems",
          `Must contain at most ${field.kind.maximumLength} items`,
        ),
      );
    }
    if (
      field.kind.distinct === true &&
      new Set(fieldValue.map((item) => JSON.stringify(item))).size !== fieldValue.length
    ) {
      issues.push(
        createValidationIssue(fieldPath, "duplicateListItem", "List items must be distinct"),
      );
    }
  },
  validateListItem = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-252] mutable listResult out-param is bundled in input interface.
    input: Readonly<ValidateListItemInput>,
  ): void => {
    const itemPath = [...input.input.fieldPath, input.itemIndex];
    if (isJsonObject(input.item) && input.input.field.nestedFields !== undefined) {
      const nested = validateFields({
        customRegistrations: input.input.customRegistrations,
        fields: input.input.field.nestedFields,
        parentPath: itemPath,
        validateOptions: input.input.validateOptions,
        values: input.item,
      });
      input.input.issues.push(...nested.issues);
      input.listResult.push(nested.result);
      return;
    }
    input.input.issues.push(
      createValidationIssue(
        itemPath,
        "expectedFieldGroupObject",
        `${input.input.field.label} items must be objects`,
      ),
    );
  },
  validateListItems = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-252] mutable listResult out-param is bundled in input interface.
    input: Readonly<ValidateListItemsInput>,
  ): void => {
    for (const [itemIndex, item] of input.listItems.entries()) {
      validateListItem({ input: input.input, item, itemIndex, listResult: input.listResult });
    }
  },
  validateNestedListFieldValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-250] mutable issues and result out-params are bundled in input interface.
    input: Readonly<ValidatePresentFieldValueInput>,
  ): void => {
    if (input.field.kind.kind !== "list" || input.field.nestedFields === undefined) {
      return;
    }
    if (!Array.isArray(input.fieldValue)) {
      input.issues.push(
        createValidationIssue(
          input.fieldPath,
          "expectedList",
          `${input.field.label} must be a list`,
        ),
      );
      return;
    }
    const listResult: JsonValue[] = [];
    validateListBounds({
      field: input.field,
      fieldPath: input.fieldPath,
      fieldValue: input.fieldValue,
      issues: input.issues,
    });
    validateListItems({ input, listItems: input.fieldValue, listResult });
    input.result[input.field.key] = listResult;
  },
  validateNestedObjectFieldValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-250] mutable issues and result out-params are bundled in input interface.
    input: Readonly<ValidatePresentFieldValueInput>,
  ): void => {
    if (input.field.nestedFields === undefined) {
      return;
    }
    if (isJsonObject(input.fieldValue)) {
      const nested = validateFields({
        customRegistrations: input.customRegistrations,
        fields: input.field.nestedFields,
        parentPath: input.fieldPath,
        validateOptions: input.validateOptions,
        values: input.fieldValue,
      });
      input.issues.push(...nested.issues);
      input.result[input.field.key] = nested.result;
      return;
    }
    input.issues.push(
      createValidationIssue(
        input.fieldPath,
        "expectedFieldGroupObject",
        `${input.field.label} must be an object`,
      ),
    );
  },
  validateNullFieldValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-250] mutable issues and result out-params are bundled in input interface.
    input: Readonly<ValidateNullFieldValueInput>,
  ): void => {
    const { field, fieldPath, issues, result } = input;
    if (field.nullable === true) {
      result[field.key] = null;
      return;
    }
    issues.push(createValidationIssue(fieldPath, "notNullable", `${field.label} cannot be null`));
  },
  validateScalarFieldValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-250] mutable issues and result out-params are bundled in input interface.
    input: Readonly<ValidatePresentFieldValueInput>,
  ): void => {
    input.issues.push(
      ...validateValue({
        customRegistrations: input.customRegistrations,
        fieldKind: input.field.kind,
        path: input.fieldPath,
        value: input.fieldValue,
      }),
    );
    input.result[input.field.key] = cloneJson(input.fieldValue);
  },
  validatePresentFieldValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-250] mutable issues and result out-params are bundled in input interface.
    input: Readonly<ValidatePresentFieldValueInput>,
  ): void => {
    if (input.field.nestedFields !== undefined && input.field.kind.kind === "list") {
      validateNestedListFieldValue(input);
      return;
    }
    if (input.field.nestedFields !== undefined) {
      validateNestedObjectFieldValue(input);
      return;
    }
    validateScalarFieldValue(input);
  },
  validateUndefinedFieldValue = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-250] mutable issues and result out-params are bundled in input interface.
    input: Readonly<ValidateUndefinedFieldValueInput>,
  ): void => {
    const { field, fieldPath, issues, result, validateOptions } = input;
    if (validateOptions.applyDefaults && field.defaultValue !== undefined) {
      result[field.key] = cloneJson(field.defaultValue);
      return;
    }
    if (field.required === true) {
      issues.push(createValidationIssue(fieldPath, "required", `${field.label} is required`));
    }
  },
  validateFields = (
    input: Readonly<ValidateFieldsInput>,
  ): {
    readonly issues: readonly ValidationIssue[];
    readonly result: JsonObject;
  } => {
    const entryIssues: ValidationIssue[] = [],
      result: Record<string, JsonValue> = {};
    appendUnknownFieldIssues({ input, issues: entryIssues });
    for (const field of input.fields) {
      const fieldPath = [...input.parentPath, field.key],
        fieldValue = input.values[field.key];
      if (fieldValue === undefined) {
        validateUndefinedFieldValue({
          field,
          fieldPath,
          issues: entryIssues,
          result,
          validateOptions: input.validateOptions,
        });
      } else if (fieldValue === null) {
        validateNullFieldValue({ field, fieldPath, issues: entryIssues, result });
      } else {
        validatePresentFieldValue({
          customRegistrations: input.customRegistrations,
          field,
          fieldPath,
          fieldValue,
          issues: entryIssues,
          result,
          validateOptions: input.validateOptions,
        });
      }
    }
    return { issues: entryIssues, result };
  };

export default { validateFields };
