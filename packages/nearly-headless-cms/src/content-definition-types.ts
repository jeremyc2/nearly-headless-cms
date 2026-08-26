import type { JsonObject, JsonValue } from "./internal/json.ts";
import type { ValidationIssue } from "./cms-error.ts";

/** JSON-compatible object and value types used by serializable definitions. */
export type { JsonObject, JsonValue } from "./internal/json.ts";

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

/** Whether activation can preserve all existing Entry representations unchanged. */
export type Compatibility = "compatible" | "migrationRequired";
