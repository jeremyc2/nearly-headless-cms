/** Serializable and compiled Content Definition model types. */
export type {
  Compatibility,
  CompileOptions,
  CompiledContentType,
  CompiledSnapshot,
  ContentTypeDefinition,
  CustomFieldRegistration,
  Definition,
  EnumFieldKind,
  Field,
  FieldGroupComposition,
  FieldGroupDefinition,
  FieldKind,
  InlineFieldGroup,
  JsonObject,
  JsonValue,
  ListFieldGroupElement,
  ListFieldKind,
  NestedFieldGroup,
  NumericFieldKind,
  QueryCapabilities,
  RelationshipFieldKind,
  ResolvedField,
  RevisionRetentionPolicy,
  RichTextExtensionRegistration,
  SimpleFieldKind,
  SnapshotInput,
  TextFieldKind,
  ValidateEntryOptions,
} from "./content-definition-types.ts";

/** Resolves portable Query capabilities for a Field. */
export { capabilitiesFor } from "./content-definition-capabilities.ts";
/** Classifies whether two Definition Snapshots are representation-compatible. */
export { classifyCompatibility } from "./content-definition-compatibility.ts";
/** Compiles and validates Content Definitions deterministically. */
export { compile, compileSnapshot } from "./content-definition-compile.ts";
