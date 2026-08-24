import { InvalidInput, type ValidationIssue } from "./cms-error.ts";
import {
  type JsonObject,
  type JsonValue,
  cloneJson,
  fingerprint,
  isJsonObject,
  isJsonValue,
} from "./internal/json.ts";

/** JSON-compatible object and value types used by serializable definitions. */
export type { JsonObject, JsonValue } from "./internal/json.ts";

const calendarDatePattern = /^\d{4}-\d{2}-\d{2}$/u,
  calendarMonthOffset = 1,
  customIdentifierPattern = /^(?:[a-z][a-z0-9-]*\.)+[a-z][a-z0-9-]*$/u,
  defaultCalendarDay = 1,
  defaultCalendarMonth = 1,
  defaultCalendarYear = 0,
  defaultCompilerFormatVersion = 1,
  emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u,
  emptyLength = 0,
  identifierPattern = /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/u,
  utcDatetimePattern = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/u;

/** Exact generic Query behaviors supported by a Field Kind. */
export interface QueryCapabilities {
  readonly filter?: readonly string[];
  readonly sortable?: boolean;
  readonly projectable?: boolean;
  readonly expandable?: boolean;
}

interface BaseFieldKind {
  readonly capabilities?: QueryCapabilities;
}

/** Portable text Field Kind and its declarative constraints. */
export interface TextFieldKind extends BaseFieldKind {
  readonly kind: "text";
  readonly minLength?: number;
  readonly maxLength?: number;
  readonly pattern?: string;
  readonly multiline?: boolean;
}

/** Portable integer or finite-number Field Kind. */
export interface NumericFieldKind extends BaseFieldKind {
  readonly kind: "integer" | "number";
  readonly minimum?: number;
  readonly maximum?: number;
}

/** Portable scalar or structured built-in Field Kind without extra configuration. */
export interface SimpleFieldKind extends BaseFieldKind {
  readonly kind: "boolean" | "date" | "datetime" | "url" | "email" | "json" | "asset" | "rich-text";
  readonly formatVersion?: number;
  readonly extensionIdentifiers?: readonly string[];
}

/** Portable string enumeration Field Kind. */
export interface EnumFieldKind extends BaseFieldKind {
  readonly kind: "enum";
  readonly values: readonly string[];
}

/** Same-space typed Relationship Field Kind. */
export interface RelationshipFieldKind extends BaseFieldKind {
  readonly kind: "relationship";
  readonly targetContentTypeIds: readonly string[];
}

/** Bounded list Field Kind containing a scalar Kind or Field Group. */
export interface ListFieldKind extends BaseFieldKind {
  readonly kind: "list";
  readonly element: FieldKind | ListFieldGroupElement;
  readonly minimumLength?: number;
  readonly maximumLength?: number;
  readonly distinct?: boolean;
}

/** Field Group element configuration for a list Field. */
export interface ListFieldGroupElement {
  readonly kind: "fieldGroup";
  readonly fieldGroupId: string;
}

/** Versioned Builder-defined serializable Field Kind. */
export interface CustomFieldKind extends BaseFieldKind {
  readonly kind: "custom";
  readonly identifier: string;
  readonly formatVersion: number;
  readonly configuration: JsonValue;
}

/** Every built-in and Builder-defined Field Kind declaration. */
export type FieldKind =
  | TextFieldKind
  | NumericFieldKind
  | SimpleFieldKind
  | EnumFieldKind
  | RelationshipFieldKind
  | ListFieldKind
  | CustomFieldKind;

/** One immutable-keyed, presentation-neutral Field declaration. */
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

/** A Field paired with its canonical dotted path after group expansion. */
export interface ResolvedField extends Field {
  readonly nestedFields?: readonly ResolvedField[];
}

/** A Field Group composed as one nested object Field. */
export interface NestedFieldGroup {
  readonly mode: "nested";
  readonly fieldGroupId: string;
  readonly key: string;
  readonly label: string;
  readonly required?: boolean;
  readonly nullable?: boolean;
}

/** A Field Group whose Fields are composed inline into its parent. */
export interface InlineFieldGroup {
  readonly mode: "inline";
  readonly fieldGroupId: string;
}

/** The two supported acyclic Field Group composition modes. */
export type FieldGroupComposition = NestedFieldGroup | InlineFieldGroup;

interface DefinitionBase {
  readonly id: string;
  readonly name: string;
  readonly description?: string;
  readonly revision?: number;
  readonly parentRevision?: number;
  readonly formatVersion?: number;
}

/** Bounded count and age policy for opt-in Entry History. */
export interface RevisionRetentionPolicy {
  readonly maximumRevisionCount?: number;
  readonly maximumAgeMilliseconds?: number;
}

/** Serializable definition of one Content Type and its Fields. */
export interface ContentTypeDefinition extends DefinitionBase {
  readonly kind: "contentType";
  readonly fields: readonly Field[];
  readonly fieldGroups?: readonly FieldGroupComposition[];
  readonly history?: boolean;
  readonly revisionRetention?: RevisionRetentionPolicy;
}

/** Serializable reusable Field Group definition. */
export interface FieldGroupDefinition extends DefinitionBase {
  readonly kind: "fieldGroup";
  readonly fields: readonly Field[];
  readonly fieldGroups?: readonly FieldGroupComposition[];
}

/** A serializable Content Type or Field Group definition. */
export type Definition = ContentTypeDefinition | FieldGroupDefinition;

/** Complete immutable input used to compile a Definition Snapshot. */
export interface SnapshotInput {
  readonly definitionSpaceId: string;
  readonly snapshotId: string;
  readonly compilerFormatVersion?: number;
  readonly definitions: readonly Definition[];
}

/** Executable validator and capabilities registered for one Custom Field Kind version. */
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

/** Executable validation contract for one Rich Text Extension version. */
export interface RichTextExtensionRegistration {
  readonly identifier: string;
  readonly formatVersion: number;
  readonly validate: (value: JsonObject) => readonly ValidationIssue[];
  readonly referenceBehavior: "none" | "entry" | "asset";
}

/** Builder registrations used while compiling serializable definitions. */
export interface CompileOptions {
  readonly customFieldKinds?: readonly CustomFieldRegistration[];
  readonly richTextExtensions?: readonly RichTextExtensionRegistration[];
}

/** Controls creation-only defaults during Entry validation. */
export interface ValidateEntryOptions {
  readonly applyDefaults: boolean;
}

/** Validated Content Type with resolved Field paths and deterministic validation. */
export interface CompiledContentType {
  readonly definition: ContentTypeDefinition;
  readonly fields: readonly ResolvedField[];
}

/** Deterministically compiled snapshot, fingerprint, and resolved Content Types. */
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
    const [firstIssue] = issues;
    let issueLocation = "";
    if (firstIssue !== undefined) {
      issueLocation = ` at ${firstIssue.path.join(".")}`;
    }
    throw InvalidInput.make({ issues: [...issues], message: `${message}${issueLocation}` });
  },
  validateIdentifier = (
    identifier: string,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (identifierPattern.test(identifier)) {
      return [];
    }
    return [
      issue(path, "invalidIdentifier", `Invalid URL-safe lowercase identifier: ${identifier}`),
    ];
  },
  defaultCapabilities = (fieldKind: FieldKind): QueryCapabilities => {
    switch (fieldKind.kind) {
      case "text": {
        return {
          filter: ["equals", "notEquals", "in", "notIn", "startsWith", "contains", "isNull"],
          projectable: true,
          sortable: true,
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
          projectable: true,
          sortable: true,
        };
      }
      case "boolean":
      case "url":
      case "email":
      case "enum": {
        return {
          filter: ["equals", "notEquals", "in", "notIn", "isNull"],
          projectable: true,
          sortable: true,
        };
      }
      case "asset": {
        return { filter: ["equals", "notEquals", "isNull"], projectable: true };
      }
      case "relationship": {
        return {
          expandable: true,
          filter: ["equals", "notEquals", "in", "notIn", "isNull"],
          projectable: true,
        };
      }
      case "list": {
        if (fieldKind.element.kind === "relationship") {
          return { filter: ["equals", "notEquals", "isNull"], projectable: true };
        }
        return { projectable: true };
      }
      case "json":
      case "rich-text": {
        return { projectable: true };
      }
      case "custom": {
        return fieldKind.capabilities ?? {};
      }
    }
    return fieldKind;
  };

/** Returns the effective portable Query capabilities for a Field Kind. */
export const capabilitiesFor = (fieldKind: FieldKind): QueryCapabilities =>
  fieldKind.capabilities ?? defaultCapabilities(fieldKind);

const validateCalendarDate = (value: string): boolean => {
    if (!calendarDatePattern.test(value)) {
      return false;
    }
    const [year, month, day] = value.split("-").map(Number),
      date = new Date(
        Date.UTC(
          year ?? defaultCalendarYear,
          (month ?? defaultCalendarMonth) - calendarMonthOffset,
          day ?? defaultCalendarDay,
        ),
      );
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + calendarMonthOffset === month &&
      date.getUTCDate() === day
    );
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
          let reason = "expectedFiniteNumber";
          if (fieldKind.kind === "integer") {
            reason = "expectedSafeInteger";
          }
          return [
            issue(
              path,
              reason,
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
        if (typeof value === "boolean") {
          return [];
        }
        return [issue(path, "expectedBoolean", "Expected boolean")];
      }
      case "date": {
        if (typeof value === "string" && validateCalendarDate(value)) {
          return [];
        }
        return [issue(path, "expectedDate", "Expected an ISO-8601 calendar date")];
      }
      case "datetime": {
        if (
          typeof value === "string" &&
          utcDatetimePattern.test(value) &&
          !Number.isNaN(Date.parse(value))
        ) {
          return [];
        }
        return [issue(path, "expectedDatetime", "Expected a normalized UTC ISO-8601 instant")];
      }
      case "url": {
        if (typeof value !== "string") {
          return [issue(path, "expectedUrl", "Expected URL text")];
        }
        try {
          const parsedUrl = new URL(value);
          if (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") {
            return [];
          }
          return [issue(path, "unsupportedUrlProtocol", "URL must use HTTP or HTTPS")];
        } catch {
          return [issue(path, "expectedUrl", "Expected a valid URL")];
        }
      }
      case "email": {
        if (typeof value === "string" && emailPattern.test(value)) {
          return [];
        }
        return [issue(path, "expectedEmail", "Expected a valid email address")];
      }
      case "enum": {
        if (typeof value === "string" && fieldKind.values.includes(value)) {
          return [];
        }
        return [issue(path, "expectedEnumValue", `Expected one of: ${fieldKind.values.join(", ")}`)];
      }
      case "json": {
        if (isJsonValue(value)) {
          return [];
        }
        return [issue(path, "expectedJsonValue", "Expected a JSON-compatible value")];
      }
      case "asset": {
        if (typeof value === "string" && value.length > emptyLength) {
          return [];
        }
        return [issue(path, "expectedAssetId", "Expected an Asset ID")];
      }
      case "relationship": {
        if (typeof value === "string" && value.length > emptyLength) {
          return [];
        }
        return [issue(path, "expectedEntryId", "Expected an Entry ID")];
      }
      case "rich-text": {
        if (
          isJsonValue(value) &&
          value !== null &&
          !Array.isArray(value) &&
          typeof value === "object"
        ) {
          return [];
        }
        return [issue(path, "expectedRichText", "Expected a Rich Text document")];
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
          fieldKind.distinct === true &&
          new Set(value.map((item) => JSON.stringify(item))).size !== value.length
        ) {
          issues.push(issue(path, "duplicateListItem", "List items must be distinct"));
        }
        if (fieldKind.element.kind !== "fieldGroup") {
          const { element } = fieldKind;
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
        if (registration === undefined) {
          return [
            issue(
              path,
              "unknownCustomFieldKind",
              `Unknown Custom Field Kind ${fieldKind.identifier}@${fieldKind.formatVersion}`,
            ),
          ];
        }
        return registration
          .validateValue(value, fieldKind.configuration)
          .map((customIssue) => ({ ...customIssue, path: [...path, ...customIssue.path] }));
      }
    }
    return fieldKind;
  },
  validateFieldDefinition = (
    field: Field,
    path: readonly (string | number)[],
    customRegistrations: ReadonlyMap<string, CustomFieldRegistration>,
  ): readonly ValidationIssue[] => {
    const issues = [...validateIdentifier(field.key, [...path, "key"])];
    if (field.label.trim().length === emptyLength) {
      issues.push(issue([...path, "label"], "requiredLabel", "Field label cannot be empty"));
    }
    if (field.required === true && field.defaultValue === null && field.nullable !== true) {
      issues.push(
        issue(
          [...path, "defaultValue"],
          "invalidDefault",
          "A non-nullable Field cannot default to null",
        ),
      );
    }
    if (
      field.unique === true &&
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
      (field.kind.values.length === emptyLength ||
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
    if (
      field.kind.kind === "relationship" &&
      field.kind.targetContentTypeIds.length === emptyLength
    ) {
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
        ...validateValue({
          customRegistrations,
          fieldKind: field.kind,
          path: [...path, "defaultValue"],
          value: field.defaultValue,
        }),
      );
    }
    return issues;
  },
  resolveFields = ({
    customRegistrations,
    definition,
    definitions,
    resolving,
  }: {
    readonly customRegistrations: ReadonlyMap<string, CustomFieldRegistration>;
    readonly definition: ContentTypeDefinition | FieldGroupDefinition;
    readonly definitions: ReadonlyMap<string, Definition>;
    readonly resolving: readonly string[];
  }): readonly ResolvedField[] => {
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
      if (fieldIssues.length > emptyLength) {
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
          nestedFields: resolveFields({
            customRegistrations,
            definition: target,
            definitions,
            resolving: [...resolving, definition.id],
          }),
        };
      }
    }
    for (const composition of definition.fieldGroups ?? []) {
      const target = definitions.get(composition.fieldGroupId);
      if (target?.kind !== "fieldGroup") {
        return fail("Missing Field Group", [
          issue(
            ["definitions", definition.id, "fieldGroups"],
            "missingFieldGroup",
            `Field Group ${composition.fieldGroupId} does not exist`,
          ),
        ]);
      }
      const composedFields = resolveFields({
        customRegistrations,
        definition: target,
        definitions,
        resolving: [...resolving, definition.id],
      });
      if (composition.mode === "inline") {
        fields.push(...composedFields);
      } else {
        fields.push({
          key: composition.key,
          kind: { kind: "json" },
          label: composition.label,
          nestedFields: composedFields,
          nullable: composition.nullable,
          required: composition.required,
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

/** Compiles and fingerprints a complete snapshot or throws `InvalidInput` atomically. */
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
  if (inputIssues.length > emptyLength) {
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
        fields: resolveFields({
          customRegistrations,
          definition,
          definitions,
          resolving: [],
        }),
      });
    } else {
      resolveFields({ customRegistrations, definition, definitions, resolving: [] });
    }
  }
  for (const [contentTypeId, compiledContentType] of contentTypes) {
    const validateRelationshipTargets = (
      fields: readonly ResolvedField[],
      parentPath: readonly (string | number)[],
    ): void => {
      for (const field of fields) {
        const fieldPath = [...parentPath, field.key];
        let relationshipKind: Extract<FieldKind, { readonly kind: "relationship" }> | undefined;
        if (field.kind.kind === "relationship") {
          relationshipKind = field.kind;
        } else if (field.kind.kind === "list" && field.kind.element.kind === "relationship") {
          relationshipKind = field.kind.element;
        }
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
  const compilerFormatVersion = input.compilerFormatVersion ?? defaultCompilerFormatVersion,
    snapshotFingerprint = fingerprint(input),
    validateFields = ({
      fields,
      parentPath,
      validateOptions,
      values,
    }: {
      readonly fields: readonly ResolvedField[];
      readonly parentPath: readonly (string | number)[];
      readonly validateOptions: ValidateEntryOptions;
      readonly values: JsonObject;
    }): { readonly result: JsonObject; readonly issues: readonly ValidationIssue[] } => {
      const result: Record<string, JsonValue> = {},
        entryIssues: ValidationIssue[] = [],
        knownKeys = new Set(fields.map((field) => field.key));
      for (const key of Object.keys(values)) {
        if (!knownKeys.has(key)) {
          entryIssues.push(
            issue(
              [...parentPath, key],
              "unknownField",
              `Unknown Field ${[...parentPath, key].join(".")}`,
            ),
          );
        }
      }
      for (const field of fields) {
        const fieldPath = [...parentPath, field.key],
          fieldValue = values[field.key];
        if (fieldValue === undefined) {
          if (validateOptions.applyDefaults && field.defaultValue !== undefined) {
            result[field.key] = cloneJson(field.defaultValue);
          } else if (field.required === true) {
            entryIssues.push(issue(fieldPath, "required", `${field.label} is required`));
          }
          continue;
        }
        if (fieldValue === null) {
          if (field.nullable === true) {
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
            field.kind.distinct === true &&
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
            const nested = validateFields({
              fields: field.nestedFields,
              parentPath: [...fieldPath, itemIndex],
              validateOptions,
              values: item,
            });
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
          const nested = validateFields({
            fields: field.nestedFields,
            parentPath: fieldPath,
            validateOptions,
            values: fieldValue,
          });
          entryIssues.push(...nested.issues);
          result[field.key] = nested.result;
          continue;
        }
        entryIssues.push(
          ...validateValue({
            customRegistrations,
            fieldKind: field.kind,
            path: fieldPath,
            value: fieldValue,
          }),
        );
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
      const validated = validateFields({
        fields: compiledContentType.fields,
        parentPath: [],
        validateOptions,
        values,
      });
      if (validated.issues.length > emptyLength) {
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

/** Whether activation can preserve all existing Entry representations unchanged. */
export type Compatibility = "compatible" | "migrationRequired";

const fieldCompatibilitySignature = (field: ResolvedField): string =>
  JSON.stringify({
    kind: field.kind,
    nestedFields: field.nestedFields?.map(fieldCompatibilitySignature),
    nullable: Boolean(field.nullable),
    required: Boolean(field.required),
    unique: Boolean(field.unique),
  });

/** Classifies a snapshot change without modifying catalog or Entry state. */
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
        targetField.required === true
      ) {
        return "migrationRequired";
      }
    }
  }
  return "compatible";
};
