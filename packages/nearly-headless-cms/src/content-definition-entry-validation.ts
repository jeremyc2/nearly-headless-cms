import type {
  CustomFieldRegistration,
  JsonObject,
  JsonValue,
  ResolvedField,
  ValidateEntryOptions,
} from "./content-definition-types.ts";
import { cloneJson, isJsonObject } from "./internal/json.ts";
import type { ValidationIssue } from "./cms-error.ts";
import validationSupport from "./content-definition-validation-support.ts";
import valueValidation from "./content-definition-value-validation.ts";

interface ValidateFieldsInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly fields: readonly ResolvedField[];
  readonly parentPath: readonly (string | number)[];
  readonly validateOptions: ValidateEntryOptions;
  readonly values: JsonObject;
}

interface ValidateListBoundsInput {
  readonly field: ResolvedField;
  readonly fieldPath: readonly (string | number)[];
  readonly fieldValue: readonly JsonValue[];
  readonly issues: ValidationIssue[];
}

interface ValidatePresentFieldValueInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly field: ResolvedField;
  readonly fieldPath: readonly (string | number)[];
  readonly fieldValue: JsonValue;
  readonly issues: ValidationIssue[];
  readonly result: Record<string, JsonValue>;
  readonly validateOptions: ValidateEntryOptions;
}

interface ValidateUndefinedFieldValueInput {
  readonly field: ResolvedField;
  readonly fieldPath: readonly (string | number)[];
  readonly issues: ValidationIssue[];
  readonly result: Record<string, JsonValue>;
  readonly validateOptions: ValidateEntryOptions;
}

interface ValidateNullFieldValueInput {
  readonly field: ResolvedField;
  readonly fieldPath: readonly (string | number)[];
  readonly issues: ValidationIssue[];
  readonly result: Record<string, JsonValue>;
}

interface ValidateListItemInput {
  readonly input: ValidatePresentFieldValueInput;
  readonly item: JsonValue;
  readonly itemIndex: number;
  readonly listResult: JsonValue[];
}

const { createValidationIssue } = validationSupport,
  { validateValue } = valueValidation,
  appendUnknownFieldIssues = (input: ValidateFieldsInput, issues: ValidationIssue[]): void => {
    const knownKeys = new Set(input.fields.map((field) => field.key));
    for (const key of Object.keys(input.values)) {
      if (!knownKeys.has(key)) {
        issues.push(
          createValidationIssue(
            [...input.parentPath, key],
            "unknownField",
            `Unknown Field ${[...input.parentPath, key].join(".")}`,
          ),
        );
      }
    }
  },
  validateFields = (
    input: ValidateFieldsInput,
  ): { readonly issues: readonly ValidationIssue[]; readonly result: JsonObject } => {
    const entryIssues: ValidationIssue[] = [],
      result: Record<string, JsonValue> = {};
    appendUnknownFieldIssues(input, entryIssues);
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
  },
  validateListBounds = ({
    field,
    fieldPath,
    fieldValue,
    issues,
  }: ValidateListBoundsInput): void => {
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
      issues.push(createValidationIssue(fieldPath, "duplicateListItem", "List items must be distinct"));
    }
  },
  validateListItem = ({ input, item, itemIndex, listResult }: ValidateListItemInput): void => {
    const itemPath = [...input.fieldPath, itemIndex];
    if (isJsonObject(item) && input.field.nestedFields !== undefined) {
      const nested = validateFields({
        customRegistrations: input.customRegistrations,
        fields: input.field.nestedFields,
        parentPath: itemPath,
        validateOptions: input.validateOptions,
        values: item,
      });
      input.issues.push(...nested.issues);
      listResult.push(nested.result);
      return;
    }
    input.issues.push(
      createValidationIssue(
        itemPath,
        "expectedFieldGroupObject",
        `${input.field.label} items must be objects`,
      ),
    );
  },
  validateListItems = (
    input: ValidatePresentFieldValueInput,
    listItems: readonly JsonValue[],
    listResult: JsonValue[],
  ): void => {
    for (const [itemIndex, item] of listItems.entries()) {
      validateListItem({ input, item, itemIndex, listResult });
    }
  },
  validateNestedListFieldValue = (input: ValidatePresentFieldValueInput): void => {
    if (input.field.kind.kind !== "list" || input.field.nestedFields === undefined) {
      return;
    }
    if (!Array.isArray(input.fieldValue)) {
      input.issues.push(
        createValidationIssue(input.fieldPath, "expectedList", `${input.field.label} must be a list`),
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
    validateListItems(input, input.fieldValue, listResult);
    input.result[input.field.key] = listResult;
  },
  validateNestedObjectFieldValue = (input: ValidatePresentFieldValueInput): void => {
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
  validateNullFieldValue = ({
    field,
    fieldPath,
    issues,
    result,
  }: ValidateNullFieldValueInput): void => {
    if (field.nullable === true) {
      result[field.key] = null;
      return;
    }
    issues.push(createValidationIssue(fieldPath, "notNullable", `${field.label} cannot be null`));
  },
  validatePresentFieldValue = (input: ValidatePresentFieldValueInput): void => {
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
  validateScalarFieldValue = (input: ValidatePresentFieldValueInput): void => {
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
  validateUndefinedFieldValue = ({
    field,
    fieldPath,
    issues,
    result,
    validateOptions,
  }: ValidateUndefinedFieldValueInput): void => {
    if (validateOptions.applyDefaults && field.defaultValue !== undefined) {
      result[field.key] = cloneJson(field.defaultValue);
      return;
    }
    if (field.required === true) {
      issues.push(createValidationIssue(fieldPath, "required", `${field.label} is required`));
    }
  };

export default { validateFields };
