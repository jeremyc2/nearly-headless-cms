import { InvalidInput, type ValidationIssue } from "./CmsError.ts";
import {
  type JsonObject,
  type JsonValue,
  cloneJson,
  fingerprint,
  isJsonObject,
  isJsonValue,
} from "./internal/json.ts";

export type { JsonObject, JsonValue } from "./internal/json.ts";

const identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
  customIdentifierPattern = /^(?:[a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/,
  calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/,
  utcDatetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/,
  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface QueryCapabilities {
  readonly filter?: readonly string[];
  readonly sortable?: boolean;
  readonly projectable?: boolean;
  readonly expandable?: boolean;
}

interface BaseFieldKind {
  readonly capabilities?: QueryCapabilities;
}

export interface TextFieldKind extends BaseFieldKind {
  readonly kind: "text";
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly multiline?: boolean;
}

export interface NumericFieldKind extends BaseFieldKind {
  readonly kind: "integer" | "number";
  readonly minimum?: number;
  readonly maximum?: number;
}

export interface SimpleFieldKind extends BaseFieldKind {
  readonly kind: "boolean" | "date" | "datetime" | "url" | "email" | "json" | "asset" | "rich-text";
  readonly formatVersion?: number;
  readonly extensionIdentifiers?: readonly string[];
}

export interface EnumFieldKind extends BaseFieldKind {
  readonly kind: "enum";
  readonly values: readonly string[];
}

export interface RelationshipFieldKind extends BaseFieldKind {
  readonly kind: "relationship";
  readonly targetContentTypeIds: readonly string[];
}

export interface ListFieldKind extends BaseFieldKind {
  readonly kind: "list";
  readonly element: FieldKind | ListFieldGroupElement;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly distinct?: boolean;
}

export interface ListFieldGroupElement {
  readonly kind: "fieldGroup";
  readonly fieldGroupId: string;
}

export interface CustomFieldKind extends BaseFieldKind {
  readonly kind: "custom";
  readonly identifier: string;
  readonly formatVersion: number;
  readonly configuration: JsonValue;
}

export type FieldKind =
  | TextFieldKind
  | NumericFieldKind
  | SimpleFieldKind
  | EnumFieldKind
  | RelationshipFieldKind
  | ListFieldKind
  | CustomFieldKind;

export interface Field {
  readonly key: string;
  readonly label: string;
  readonly description?: string;
  readonly required?: boolean;
  readonly nullable?: boolean;
  readonly defaultValue?: JsonValue;
  readonly unique?: boolean;
  readonly kind: FieldKind;
}

export interface ResolvedField extends Field {
  readonly nestedFields?: readonly ResolvedField[];
}

export interface NestedFieldGroup {
  readonly mode: "nested";
  readonly fieldGroupId: string;
  readonly key: string;
  readonly label: string;
  readonly required?: boolean;
  readonly nullable?: boolean;
}

export interface InlineFieldGroup {
  readonly mode: "inline";
  readonly fieldGroupId: string;
}

export type FieldGroupComposition = NestedFieldGroup | InlineFieldGroup;

interface DefinitionBase {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly revision?: number;
  readonly parentRevision?: number;
  readonly formatVersion?: number;
}

export interface RevisionRetentionPolicy {
  readonly maximumRevisionCount?: number;
  readonly maximumAgeMilliseconds?: number;
}

export interface ContentTypeDefinition extends DefinitionBase {
  readonly kind: "contentType";
  readonly fields: readonly Field[];
  readonly fieldGroups?: readonly FieldGroupComposition[];
  readonly history?: boolean;
  readonly revisionRetention?: RevisionRetentionPolicy;
}

export interface FieldGroupDefinition extends DefinitionBase {
  readonly kind: "fieldGroup";
  readonly fields: readonly Field[];
  readonly fieldGroups?: readonly FieldGroupComposition[];
}

export type Definition = ContentTypeDefinition | FieldGroupDefinition;

export interface SnapshotInput {
  readonly definitionSpaceId: string;
  readonly snapshotId: string;
  readonly compilerFormatVersion?: number;
  readonly definitions: readonly Definition[];
}

export interface CustomFieldRegistration {
  readonly identifier: string;
  readonly formatVersion: number;
  readonly validateConfiguration: (configuration: JsonValue) => readonly ValidationIssue[];
  readonly validateValue: (
    value: JsonValue,
    configuration: JsonValue,
  ) => readonly ValidationIssue[];
  readonly capabilities: QueryCapabilities;
}

export interface RichTextExtensionRegistration {
  readonly identifier: string;
  readonly formatVersion: number;
  readonly validate: (value: JsonObject) => readonly ValidationIssue[];
  readonly referenceBehavior: "none" | "entry" | "asset";
}

export interface CompileOptions {
  readonly customFieldKinds?: readonly CustomFieldRegistration[];
  readonly richTextExtensions?: readonly RichTextExtensionRegistration[];
}

export interface ValidateEntryOptions {
  readonly applyDefaults: boolean;
}

export interface CompiledContentType {
  readonly definition: ContentTypeDefinition;
  readonly fields: readonly ResolvedField[];
}

export interface CompiledSnapshot {
  readonly input: SnapshotInput;
  readonly definitionSpaceId: string;
  readonly snapshotId: string;
  readonly compilerFormatVersion: number;
  readonly fingerprint: string;
  readonly definitions: ReadonlyMap<string, Definition>;
  readonly contentTypes: ReadonlyMap<string, CompiledContentType>;
  readonly validateEntry: (
    contentTypeId: string,
    values: JsonObject,
    options: ValidateEntryOptions,
  ) => JsonObject;
}

const issue = (
    path: readonly (string | number)[],
    reason: string,
    message: string,
  ): ValidationIssue => ({ message, path, reason }),
  fail = (message: string, issues: readonly ValidationIssue[]): never => {
    const firstIssue = issues[0],
      issueLocation = firstIssue === undefined ? "" : ` at ${firstIssue.path.join(".")}`;
    throw new InvalidInput({ issues: [...issues], message: `${message}${issueLocation}` });
  },
  validateIdentifier = (
    identifier: string,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] =>
    identifierPattern.test(identifier)
      ? []
      : [issue(path, "invalidIdentifier", `Invalid URL-safe lowercase identifier: ${identifier}`)],
  defaultCapabilities = (fieldKind: FieldKind): QueryCapabilities => {
    switch (fieldKind.kind) {
      case "text": {
        return {
          filter: ["equals", "notEquals", "in", "notIn", "startsWith", "contains", "isNull"],
          sortable: true,
          projectable: true,
        };
      }
      case "integer":
      case "number":
      case "date":
      case "datetime": {
        return {
          filter: [
            "equals",
            "notEquals",
            "in",
            "notIn",
            "lessThan",
            "lessThanOrEqual",
            "greaterThan",
            "greaterThanOrEqual",
            "isNull",
          ],
          sortable: true,
          projectable: true,
        };
      }
      case "boolean":
      case "url":
      case "email":
      case "enum": {
        return {
          filter: ["equals", "notEquals", "in", "notIn", "isNull"],
          sortable: true,
          projectable: true,
        };
      }
      case "asset": {
        return { filter: ["equals", "notEquals", "isNull"], projectable: true };
      }
      case "relationship": {
        return {
          filter: ["equals", "notEquals", "in", "notIn", "isNull"],
          projectable: true,
          expandable: true,
        };
      }
      case "list": {
        return fieldKind.element.kind === "relationship"
          ? { filter: ["equals", "notEquals", "isNull"], projectable: true }
          : { projectable: true };
      }
      case "json":
      case "rich-text": {
        return { projectable: true };
      }
      case "custom": {
        return fieldKind.capabilities ?? {};
      }
    }
  };

export const capabilitiesFor = (fieldKind: FieldKind): QueryCapabilities =>
  fieldKind.capabilities ?? defaultCapabilities(fieldKind);

const validateCalendarDate = (value: string): boolean => {
    if (!calendarDatePattern.test(value)) {
      return false;
    }
    const [year, month, day] = value.split("-").map(Number),
      date = new Date(Date.UTC(year ?? 0, (month ?? 1) - 1, day ?? 1));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    );
  },
  validateValue = (
    fieldKind: FieldKind,
    value: unknown,
    path: readonly (string | number)[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ValidationIssue[] => {
    switch (fieldKind.kind) {
      case "text": {
        if (typeof value !== "string") {
          return [issue(path, "expectedText", "Expected text")];
        }
        const issues: ValidationIssue[] = [];
        if (fieldKind.minLength !== undefined && value.length < fieldKind.minLength) {
          issues.push(
            issue(path, "tooShort", `Must contain at least ${fieldKind.minLength} characters`),
          );
        }
        if (fieldKind.maxLength !== undefined && value.length > fieldKind.maxLength) {
          issues.push(
            issue(path, "tooLong", `Must contain at most ${fieldKind.maxLength} characters`),
          );
        }
        if (fieldKind.pattern !== undefined && !new RegExp(fieldKind.pattern, "u").test(value)) {
          issues.push(issue(path, "pattern", "Does not match the required pattern"));
        }
        return issues;
      }
      case "integer":
      case "number": {
        if (
          typeof value !== "number" ||
          !Number.isFinite(value) ||
          (fieldKind.kind === "integer" && !Number.isSafeInteger(value))
        ) {
          return [
            issue(
              path,
              fieldKind.kind === "integer" ? "expectedSafeInteger" : "expectedFiniteNumber",
              `Expected ${fieldKind.kind}`,
            ),
          ];
        }
        const issues: ValidationIssue[] = [];
        if (fieldKind.minimum !== undefined && value < fieldKind.minimum) {
          issues.push(issue(path, "belowMinimum", `Must be at least ${fieldKind.minimum}`));
        }
        if (fieldKind.maximum !== undefined && value > fieldKind.maximum) {
          issues.push(issue(path, "aboveMaximum", `Must be at most ${fieldKind.maximum}`));
        }
        return issues;
      }
      case "boolean": {
        return typeof value === "boolean"
          ? []
          : [issue(path, "expectedBoolean", "Expected boolean")];
      }
      case "date": {
        return typeof value === "string" && validateCalendarDate(value)
          ? []
          : [issue(path, "expectedDate", "Expected an ISO-8601 calendar date")];
      }
      case "datetime": {
        return typeof value === "string" &&
          utcDatetimePattern.test(value) &&
          !Number.isNaN(Date.parse(value))
          ? []
          : [issue(path, "expectedDatetime", "Expected a normalized UTC ISO-8601 instant")];
      }
      case "url": {
        if (typeof value !== "string") {
          return [issue(path, "expectedUrl", "Expected URL text")];
        }
        try {
          const parsedUrl = new URL(value);
          return parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:"
            ? []
            : [issue(path, "unsupportedUrlProtocol", "URL must use HTTP or HTTPS")];
        } catch {
          return [issue(path, "expectedUrl", "Expected a valid URL")];
        }
      }
      case "email": {
        return typeof value === "string" && emailPattern.test(value)
          ? []
          : [issue(path, "expectedEmail", "Expected a valid email address")];
      }
      case "enum": {
        return typeof value === "string" && fieldKind.values.includes(value)
          ? []
          : [issue(path, "expectedEnumValue", `Expected one of: ${fieldKind.values.join(", ")}`)];
      }
      case "json": {
        return isJsonValue(value)
          ? []
          : [issue(path, "expectedJsonValue", "Expected a JSON-compatible value")];
      }
      case "asset": {
        return typeof value === "string" && value.length > 0
          ? []
          : [issue(path, "expectedAssetId", "Expected an Asset ID")];
      }
      case "relationship": {
        return typeof value === "string" && value.length > 0
          ? []
          : [issue(path, "expectedEntryId", "Expected an Entry ID")];
      }
      case "rich-text": {
        return isJsonValue(value) &&
          value !== null &&
          !Array.isArray(value) &&
          typeof value === "object"
          ? []
          : [issue(path, "expectedRichText", "Expected a Rich Text document")];
      }
      case "list": {
        if (!Array.isArray(value)) {
          return [issue(path, "expectedList", "Expected a list")];
        }
        const issues: ValidationIssue[] = [];
        if (fieldKind.minimumLength !== undefined && value.length < fieldKind.minimumLength) {
          issues.push(
            issue(path, "tooFewItems", `Must contain at least ${fieldKind.minimumLength} items`),
          );
        }
        if (fieldKind.maximumLength !== undefined && value.length > fieldKind.maximumLength) {
          issues.push(
            issue(path, "tooManyItems", `Must contain at most ${fieldKind.maximumLength} items`),
          );
        }
        if (
          fieldKind.distinct &&
          new Set(value.map((item) => JSON.stringify(item))).size !== value.length
        ) {
          issues.push(issue(path, "duplicateListItem", "List items must be distinct"));
        }
        if (fieldKind.element.kind !== "fieldGroup") {
          const element = fieldKind.element;
          value.forEach((child, index) =>
            issues.push(...validateValue(element, child, [...path, index], customRegistrations)),
          );
        }
        return issues;
      }
      case "custom": {
        if (!isJsonValue(value)) {
          return [
            issue(path, "expectedJsonValue", "Expected a JSON-compatible custom Field value"),
          ];
        }
        const registration = customRegistrations.get(
          `${fieldKind.identifier}@${fieldKind.formatVersion}`,
        );
        return registration === undefined
          ? [
              issue(
                path,
                "unknownCustomFieldKind",
                `Unknown Custom Field Kind ${fieldKind.identifier}@${fieldKind.formatVersion}`,
              ),
            ]
          : registration
              .validateValue(value, fieldKind.configuration)
              .map((customIssue) => ({ ...customIssue, path: [...path, ...customIssue.path] }));
      }
    }
  },
  validateFieldDefinition = (
    field: Field,
    path: readonly (string | number)[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ValidationIssue[] => {
    const issues = [...validateIdentifier(field.key, [...path, "key"])];
    if (field.label.trim().length === 0) {
      issues.push(issue([...path, "label"], "requiredLabel", "Field label cannot be empty"));
    }
    if (field.required && field.defaultValue === null && !field.nullable) {
      issues.push(
        issue(
          [...path, "defaultValue"],
          "invalidDefault",
          "A non-nullable Field cannot default to null",
        ),
      );
    }
    if (
      field.unique &&
      ["json", "rich-text", "list", "asset", "relationship", "custom"].includes(field.kind.kind)
    ) {
      issues.push(
        issue(
          [...path, "unique"],
          "unsupportedUniqueField",
          "Only non-null scalar Fields can be unique",
        ),
      );
    }
    if (
      field.kind.kind === "enum" &&
      (field.kind.values.length === 0 ||
        new Set(field.kind.values).size !== field.kind.values.length)
    ) {
      issues.push(
        issue(
          [...path, "kind", "values"],
          "invalidEnumValues",
          "Enum values must be non-empty and distinct",
        ),
      );
    }
    if (field.kind.kind === "relationship" && field.kind.targetContentTypeIds.length === 0) {
      issues.push(
        issue(
          [...path, "kind", "targetContentTypeIds"],
          "missingRelationshipTarget",
          "A Relationship Field requires a target Content Type",
        ),
      );
    }
    if (field.kind.kind === "custom") {
      if (!customIdentifierPattern.test(field.kind.identifier)) {
        issues.push(
          issue(
            [...path, "kind", "identifier"],
            "invalidCustomIdentifier",
            "Custom Field Kind identifiers must use reverse-domain form",
          ),
        );
      }
      const registration = customRegistrations.get(
        `${field.kind.identifier}@${field.kind.formatVersion}`,
      );
      if (registration === undefined) {
        issues.push(
          issue(
            [...path, "kind"],
            "unknownCustomFieldKind",
            `Unknown Custom Field Kind ${field.kind.identifier}@${field.kind.formatVersion}`,
          ),
        );
      } else {
        issues.push(
          ...registration
            .validateConfiguration(field.kind.configuration)
            .map((configurationIssue) => ({
              ...configurationIssue,
              path: [...path, "kind", "configuration", ...configurationIssue.path],
            })),
        );
      }
    }
    if (field.defaultValue !== undefined) {
      issues.push(
        ...validateValue(
          field.kind,
          field.defaultValue,
          [...path, "defaultValue"],
          customRegistrations,
        ),
      );
    }
    return issues;
  },
  resolveFields = (
    definition: ContentTypeDefinition | FieldGroupDefinition,
    definitions: ReadonlyMap<string, Definition>,
    resolving: readonly string[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ResolvedField[] => {
    if (resolving.includes(definition.id)) {
      fail("Field Group inclusion cycle", [
        issue(
          ["definitions", definition.id],
          "fieldGroupCycle",
          `Field Group inclusion cycle: ${[...resolving, definition.id].join(" -> ")}`,
        ),
      ]);
    }
    const fields: ResolvedField[] = [...definition.fields];
    for (const [fieldIndex, field] of fields.entries()) {
      const fieldIssues = validateFieldDefinition(
        field,
        ["definitions", definition.id, "fields", fieldIndex],
        customRegistrations,
      );
      if (fieldIssues.length > 0) {
        fail("Invalid Field definition", fieldIssues);
      }
      if (field.kind.kind === "list" && field.kind.element.kind === "fieldGroup") {
        const target = definitions.get(field.kind.element.fieldGroupId);
        if (target === undefined) {
          return fail("Missing Field Group", [
            issue(
              ["definitions", definition.id, "fields", fieldIndex, "kind", "element"],
              "missingFieldGroup",
              `Field Group ${field.kind.element.fieldGroupId} does not exist`,
            ),
          ]);
        }
        if (target.kind !== "fieldGroup") {
          return fail("Invalid Field Group", [
            issue(
              ["definitions", definition.id, "fields", fieldIndex, "kind", "element"],
              "invalidFieldGroup",
              `${target.id} is not a Field Group`,
            ),
          ]);
        }
        fields[fieldIndex] = {
          ...field,
          nestedFields: resolveFields(
            target,
            definitions,
            [...resolving, definition.id],
            customRegistrations,
          ),
        };
      }
    }
    for (const composition of definition.fieldGroups ?? []) {
      const target = definitions.get(composition.fieldGroupId);
      if (target === undefined || target.kind !== "fieldGroup") {
        return fail("Missing Field Group", [
          issue(
            ["definitions", definition.id, "fieldGroups"],
            "missingFieldGroup",
            `Field Group ${composition.fieldGroupId} does not exist`,
          ),
        ]);
      }
      const composedFields = resolveFields(
        target,
        definitions,
        [...resolving, definition.id],
        customRegistrations,
      );
      if (composition.mode === "inline") {
        fields.push(...composedFields);
      } else {
        fields.push({
          key: composition.key,
          label: composition.label,
          required: composition.required,
          nullable: composition.nullable,
          kind: { kind: "json" },
          nestedFields: composedFields,
        });
      }
    }
    const duplicateKey = fields.find(
      (field, index) => fields.findIndex((candidate) => candidate.key === field.key) !== index,
    )?.key;
    if (duplicateKey !== undefined) {
      fail("Field key collision", [
        issue(
          ["definitions", definition.id, "fields"],
          "fieldKeyCollision",
          `Field key ${duplicateKey} is included more than once`,
        ),
      ]);
    }
    return fields;
  };

export const compile = (input: SnapshotInput, options: CompileOptions = {}): CompiledSnapshot => {
  const inputIssues = [
      ...validateIdentifier(input.definitionSpaceId, ["definitionSpaceId"]),
      ...validateIdentifier(input.snapshotId, ["snapshotId"]),
    ],
    definitions = new Map<string, Definition>();
  for (const [definitionIndex, definition] of input.definitions.entries()) {
    inputIssues.push(...validateIdentifier(definition.id, ["definitions", definitionIndex, "id"]));
    if (definitions.has(definition.id)) {
      inputIssues.push(
        issue(
          ["definitions", definitionIndex, "id"],
          "duplicateDefinition",
          `Definition ${definition.id} occurs more than once`,
        ),
      );
    }
    definitions.set(definition.id, definition);
  }
  if (inputIssues.length > 0) {
    fail("Invalid Definition Snapshot", inputIssues);
  }
  const customRegistrations = new Map(
      (options.customFieldKinds ?? []).map((registration) => [
        `${registration.identifier}@${registration.formatVersion}`,
        registration,
      ]),
    ),
    contentTypes = new Map<string, CompiledContentType>();
  for (const definition of definitions.values()) {
    if (definition.kind === "contentType") {
      contentTypes.set(definition.id, {
        definition,
        fields: resolveFields(definition, definitions, [], customRegistrations),
      });
    } else {
      resolveFields(definition, definitions, [], customRegistrations);
    }
  }
  for (const [contentTypeId, compiledContentType] of contentTypes) {
    const validateRelationshipTargets = (
      fields: readonly ResolvedField[],
      parentPath: readonly (string | number)[],
    ): void => {
      for (const field of fields) {
        const fieldPath = [...parentPath, field.key],
          relationshipKind =
            field.kind.kind === "relationship"
              ? field.kind
              : field.kind.kind === "list" && field.kind.element.kind === "relationship"
                ? field.kind.element
                : undefined;
        for (const targetContentTypeId of relationshipKind?.targetContentTypeIds ?? []) {
          if (!contentTypes.has(targetContentTypeId)) {
            fail("Invalid Relationship target", [
              issue(
                fieldPath,
                "missingRelationshipTarget",
                `Content Type ${targetContentTypeId} does not exist`,
              ),
            ]);
          }
        }
        if (field.nestedFields !== undefined) {
          validateRelationshipTargets(field.nestedFields, fieldPath);
        }
      }
    };
    validateRelationshipTargets(compiledContentType.fields, [
      "definitions",
      contentTypeId,
      "fields",
    ]);
  }
  const compilerFormatVersion = input.compilerFormatVersion ?? 1,
    snapshotFingerprint = fingerprint(input as unknown as JsonValue),
    validateFields = (
      fields: readonly ResolvedField[],
      values: JsonObject,
      validateOptions: ValidateEntryOptions,
      parentPath: readonly (string | number)[],
    ): { readonly result: JsonObject; readonly issues: readonly ValidationIssue[] } => {
      const result: Record<string, JsonValue> = {},
        entryIssues: ValidationIssue[] = [],
        knownKeys = new Set(fields.map((field) => field.key));
      for (const key of Object.keys(values)) {
        if (!knownKeys.has(key))
          entryIssues.push(
            issue(
              [...parentPath, key],
              "unknownField",
              `Unknown Field ${[...parentPath, key].join(".")}`,
            ),
          );
      }
      for (const field of fields) {
        const fieldPath = [...parentPath, field.key],
          fieldValue = values[field.key];
        if (fieldValue === undefined) {
          if (validateOptions.applyDefaults && field.defaultValue !== undefined) {
            result[field.key] = cloneJson(field.defaultValue);
          } else if (field.required) {
            entryIssues.push(issue(fieldPath, "required", `${field.label} is required`));
          }
          continue;
        }
        if (fieldValue === null) {
          if (field.nullable) {
            result[field.key] = null;
          } else {
            entryIssues.push(issue(fieldPath, "notNullable", `${field.label} cannot be null`));
          }
          continue;
        }
        if (field.nestedFields !== undefined && field.kind.kind === "list") {
          if (!Array.isArray(fieldValue)) {
            entryIssues.push(issue(fieldPath, "expectedList", `${field.label} must be a list`));
            continue;
          }
          if (
            field.kind.minimumLength !== undefined &&
            fieldValue.length < field.kind.minimumLength
          ) {
            entryIssues.push(
              issue(
                fieldPath,
                "tooFewItems",
                `Must contain at least ${field.kind.minimumLength} items`,
              ),
            );
          }
          if (
            field.kind.maximumLength !== undefined &&
            fieldValue.length > field.kind.maximumLength
          ) {
            entryIssues.push(
              issue(
                fieldPath,
                "tooManyItems",
                `Must contain at most ${field.kind.maximumLength} items`,
              ),
            );
          }
          if (
            field.kind.distinct &&
            new Set(fieldValue.map((item) => JSON.stringify(item))).size !== fieldValue.length
          ) {
            entryIssues.push(issue(fieldPath, "duplicateListItem", "List items must be distinct"));
          }
          const listResult: JsonValue[] = [];
          for (const [itemIndex, item] of fieldValue.entries()) {
            if (!isJsonObject(item)) {
              entryIssues.push(
                issue(
                  [...fieldPath, itemIndex],
                  "expectedFieldGroupObject",
                  `${field.label} items must be objects`,
                ),
              );
              continue;
            }
            const nested = validateFields(field.nestedFields, item, validateOptions, [
              ...fieldPath,
              itemIndex,
            ]);
            entryIssues.push(...nested.issues);
            listResult.push(nested.result);
          }
          result[field.key] = listResult;
          continue;
        }
        if (field.nestedFields !== undefined) {
          if (!isJsonObject(fieldValue)) {
            entryIssues.push(
              issue(fieldPath, "expectedFieldGroupObject", `${field.label} must be an object`),
            );
            continue;
          }
          const nested = validateFields(field.nestedFields, fieldValue, validateOptions, fieldPath);
          entryIssues.push(...nested.issues);
          result[field.key] = nested.result;
          continue;
        }
        entryIssues.push(...validateValue(field.kind, fieldValue, fieldPath, customRegistrations));
        result[field.key] = cloneJson(fieldValue);
      }
      return { issues: entryIssues, result };
    },
    validateEntry = (
      contentTypeId: string,
      values: JsonObject,
      validateOptions: ValidateEntryOptions,
    ): JsonObject => {
      const compiledContentType = contentTypes.get(contentTypeId);
      if (compiledContentType === undefined) {
        return fail("Unknown Content Type", [
          issue(
            ["contentTypeId"],
            "unknownContentType",
            `Content Type ${contentTypeId} does not exist`,
          ),
        ]);
      }
      if (!isJsonValue(values) || values === null || Array.isArray(values)) {
        fail("Invalid Entry values", [
          issue(["values"], "expectedObject", "Entry values must be a JSON-compatible object"),
        ]);
      }
      const validated = validateFields(compiledContentType.fields, values, validateOptions, []);
      if (validated.issues.length > 0) {
        fail("Entry validation failed", validated.issues);
      }
      return validated.result;
    };
  return {
    compilerFormatVersion,
    contentTypes,
    definitionSpaceId: input.definitionSpaceId,
    definitions,
    fingerprint: snapshotFingerprint,
    input: structuredClone(input),
    snapshotId: input.snapshotId,
    validateEntry,
  };
};

export type Compatibility = "compatible" | "migrationRequired";

const fieldCompatibilitySignature = (field: ResolvedField): string =>
  JSON.stringify({
    kind: field.kind,
    nestedFields: field.nestedFields?.map(fieldCompatibilitySignature),
    nullable: Boolean(field.nullable),
    required: Boolean(field.required),
    unique: Boolean(field.unique),
  });

export const classifyCompatibility = (
  source: CompiledSnapshot,
  target: CompiledSnapshot,
): Compatibility => {
  for (const [contentTypeId, sourceContentType] of source.contentTypes) {
    const targetContentType = target.contentTypes.get(contentTypeId);
    if (targetContentType === undefined) {
      return "migrationRequired";
    }
    const targetFields = new Map(targetContentType.fields.map((field) => [field.key, field]));
    for (const sourceField of sourceContentType.fields) {
      const targetField = targetFields.get(sourceField.key);
      if (
        targetField === undefined ||
        fieldCompatibilitySignature(sourceField) !== fieldCompatibilitySignature(targetField)
      ) {
        return "migrationRequired";
      }
    }
    for (const targetField of targetContentType.fields) {
      if (
        !sourceContentType.fields.some((field) => field.key === targetField.key) &&
        targetField.required
      )
        return "migrationRequired";
    }
  }
  return "compatible";
};
