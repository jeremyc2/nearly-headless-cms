import {
  type CompiledSnapshot,
  type EntryGeneration,
  InvalidInput,
  type JsonObject,
  type JsonValue,
  type ResolvedField,
  isJsonObject,
} from "./cms-entry-expansion-field-group-imports.ts";

interface ExpandFieldGroupInput {
  readonly expandObject: (input: ExpandObjectInput) => JsonObject;
  readonly expandObjectInput: ExpandObjectInput;
  readonly field: ResolvedField;
  readonly fieldKey: string;
  readonly fieldPath: string;
  readonly nestedPaths: readonly string[];
  readonly value: JsonValue;
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

const expandFieldGroup = ({
    expandObject,
    expandObjectInput,
    field,
    fieldKey,
    fieldPath,
    nestedPaths,
    value,
    values,
  }: ExpandFieldGroupInput): void => {
    const { nestedFields } = field;
    if (nestedFields === undefined) {
      throw InvalidInput.make({ message: `Field Group ${fieldPath} has no nested fields` });
    }
    if (field.kind.kind === "list") {
      expandFieldGroupList({
        expandObject,
        expandObjectInput,
        fieldKey,
        fieldPath,
        nestedFields,
        nestedPaths,
        value,
        values,
      });
      return;
    }
    if (!isJsonObject(value)) {
      throw InvalidInput.make({ message: `Field Group ${fieldPath} contains an invalid value` });
    }
    values[fieldKey] = expandObject({
      ...expandObjectInput,
      expansion: nestedPaths,
      fields: nestedFields,
      object: value,
      parentPath: fieldPath,
    });
  },
  expandFieldGroupList = (input: {
    readonly expandObject: (input: ExpandObjectInput) => JsonObject;
    readonly expandObjectInput: ExpandObjectInput;
    readonly fieldKey: string;
    readonly fieldPath: string;
    readonly nestedFields: readonly ResolvedField[];
    readonly nestedPaths: readonly string[];
    readonly value: JsonValue;
    readonly values: Record<string, JsonValue>;
  }): void => {
    const { expandObject, expandObjectInput, fieldKey, fieldPath, nestedFields, nestedPaths, value, values } =
      input;
    if (!Array.isArray(value)) {
      throw InvalidInput.make({
        message: `Field Group List ${fieldPath} contains an invalid value`,
      });
    }
    values[fieldKey] = value.map((item) => {
      if (!isJsonObject(item)) {
        throw InvalidInput.make({
          message: `Field Group List ${fieldPath} contains an invalid item`,
        });
      }
      return expandObject({
        ...expandObjectInput,
        expansion: nestedPaths,
        fields: nestedFields,
        object: item,
        parentPath: fieldPath,
      });
    });
  };

export default { expandFieldGroup };
export type { ExpandObjectInput };
