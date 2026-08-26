import type {
  ContentTypeDefinition,
  EnumFieldKind,
  Field,
  FieldGroupDefinition,
  ListFieldKind,
  RelationshipFieldKind,
  TextFieldKind,
} from "./content-definition-types.ts";

const slugPattern = "^[a-z0-9]+(?:-[a-z0-9]+)*$",

 text = (options: Omit<TextFieldKind, "kind"> = {}): TextFieldKind => ({ kind: "text", ...options }),

 slug = (options: Omit<TextFieldKind, "kind" | "pattern"> = {}): TextFieldKind =>
  text({ ...options, pattern: slugPattern }),

 relationship = (targetContentTypeIds: readonly string[]): RelationshipFieldKind => ({
  kind: "relationship",
  targetContentTypeIds,
 }),

 enumField = (values: readonly string[]): EnumFieldKind => ({ kind: "enum", values }),

 relationshipList = (
  targetContentTypeIds: readonly string[],
  maximumLength: number,
 ): ListFieldKind => ({
  distinct: true,
  element: relationship(targetContentTypeIds),
  kind: "list",
  maximumLength,
 }),

 list = (
  element: ListFieldKind["element"],
  maximumLength: number,
  options: { readonly distinct?: boolean } = {},
 ): ListFieldKind => ({
  distinct: options.distinct,
  element,
  kind: "list",
  maximumLength,
 }),

 requiredTextField = (
  key: string,
  label: string,
  options: Omit<TextFieldKind, "kind"> = {},
 ): Field => ({
  key,
  kind: text(options),
  label,
  required: true,
 }),

 requiredSlugField = (
  key: string,
  label: string,
  options: Omit<TextFieldKind, "kind" | "pattern"> = {},
 ): Field => ({
  key,
  kind: slug(options),
  label,
  required: true,
  unique: true,
 }),

 contentType = (definition: Omit<ContentTypeDefinition, "kind">): ContentTypeDefinition => ({
  kind: "contentType",
  ...definition,
 }),

 fieldGroup = (definition: Omit<FieldGroupDefinition, "kind">): FieldGroupDefinition => ({
  kind: "fieldGroup",
  ...definition,
 }),

 Fields = {
  contentType,
  enumField,
  fieldGroup,
  list,
  relationship,
  relationshipList,
  requiredSlugField,
  requiredTextField,
  slug,
  text,
} as const;

export { Fields };
