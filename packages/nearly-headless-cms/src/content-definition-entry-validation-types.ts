import type {
  CustomFieldRegistration,
  JsonObject,
  JsonValue,
  ResolvedField,
  ValidateEntryOptions,
} from "./content-definition-types.ts";
import type { ValidationIssue } from "./cms-error.ts";

export interface ValidateFieldsInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly fields: readonly ResolvedField[];
  readonly parentPath: readonly (string | number)[];
  readonly validateOptions: Readonly<ValidateEntryOptions>;
  readonly values: Readonly<JsonObject>;
}

export interface ValidateListBoundsInput {
  readonly field: Readonly<ResolvedField>;
  readonly fieldPath: readonly (string | number)[];
  readonly fieldValue: readonly JsonValue[];
  readonly issues: ValidationIssue[];
}

export interface ValidatePresentFieldValueInput {
  readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
  readonly field: Readonly<ResolvedField>;
  readonly fieldPath: readonly (string | number)[];
  readonly fieldValue: Readonly<JsonValue>;
  readonly issues: ValidationIssue[];
  readonly result: Record<string, JsonValue>;
  readonly validateOptions: Readonly<ValidateEntryOptions>;
}

export interface ValidateUndefinedFieldValueInput {
  readonly field: Readonly<ResolvedField>;
  readonly fieldPath: readonly (string | number)[];
  readonly issues: ValidationIssue[];
  readonly result: Record<string, JsonValue>;
  readonly validateOptions: Readonly<ValidateEntryOptions>;
}

export interface ValidateNullFieldValueInput {
  readonly field: Readonly<ResolvedField>;
  readonly fieldPath: readonly (string | number)[];
  readonly issues: ValidationIssue[];
  readonly result: Record<string, JsonValue>;
}

export interface ValidateListItemInput {
  readonly input: Readonly<ValidatePresentFieldValueInput>;
  readonly item: Readonly<JsonValue>;
  readonly itemIndex: number;
  readonly listResult: JsonValue[];
}

export interface AppendUnknownFieldIssuesInput {
  issues: ValidationIssue[];
  readonly input: Readonly<ValidateFieldsInput>;
}

export interface ValidateListItemsInput {
  readonly input: Readonly<ValidatePresentFieldValueInput>;
  readonly listItems: readonly JsonValue[];
  listResult: JsonValue[];
}
