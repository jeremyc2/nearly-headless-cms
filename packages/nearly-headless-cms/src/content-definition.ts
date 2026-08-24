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

export { capabilitiesFor } from "./content-definition-capabilities.ts";
export { classifyCompatibility } from "./content-definition-compatibility.ts";
export { compile, compileSnapshot } from "./content-definition-compile.ts";
