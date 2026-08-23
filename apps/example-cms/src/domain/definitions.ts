import { ContentDefinition } from "nearly-headless-cms";

const text = (
    options: Omit<ContentDefinition.TextFieldKind, "kind"> = {},
  ): ContentDefinition.TextFieldKind => ({ kind: "text", ...options }),
  relationship = (
    targetContentTypeIds: readonly string[],
  ): ContentDefinition.RelationshipFieldKind => ({ kind: "relationship", targetContentTypeIds });

export const definitionSnapshot = ContentDefinition.compile({
  definitionSpaceId: "example-blog",
  definitions: [
    {
      kind: "fieldGroup",
      id: "external-link",
      name: "External Link",
      fields: [
        {
          key: "label",
          label: "Label",
          required: true,
          kind: text({ minLength: 1, maxLength: 80 }),
        },
        { key: "url", label: "URL", required: true, kind: { kind: "url" } },
      ],
    },
    {
      kind: "contentType",
      id: "author",
      name: "Author",
      history: true,
      fields: [
        {
          key: "name",
          label: "Name",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 120 }),
        },
        {
          key: "slug",
          label: "Slug",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 100, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
        },
        {
          key: "biography",
          label: "Short biography",
          required: true,
          kind: text({ minLength: 1, maxLength: 500, multiline: true }),
        },
        {
          key: "profile",
          label: "Profile",
          nullable: true,
          kind: { kind: "rich-text", formatVersion: 1 },
        },
        { key: "portrait", label: "Portrait", nullable: true, kind: { kind: "asset" } },
        {
          key: "portrait-alternative-text",
          label: "Portrait alternative text",
          nullable: true,
          kind: text({ maxLength: 240 }),
        },
        {
          key: "external-links",
          label: "External links",
          kind: { kind: "list", element: { kind: "json" }, maximumLength: 10 },
        },
      ],
    },
    {
      kind: "contentType",
      id: "category",
      name: "Category",
      history: true,
      fields: [
        {
          key: "name",
          label: "Name",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 80 }),
        },
        {
          key: "slug",
          label: "Slug",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
        },
        {
          key: "description",
          label: "Description",
          nullable: true,
          kind: text({ maxLength: 300, multiline: true }),
        },
      ],
    },
    {
      kind: "contentType",
      id: "tag",
      name: "Tag",
      history: true,
      fields: [
        {
          key: "name",
          label: "Name",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 80 }),
        },
        {
          key: "slug",
          label: "Slug",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 80, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
        },
        {
          key: "description",
          label: "Description",
          nullable: true,
          kind: text({ maxLength: 300, multiline: true }),
        },
      ],
    },
    {
      kind: "contentType",
      id: "post",
      name: "Post",
      history: true,
      revisionRetention: { maximumRevisionCount: 100 },
      fields: [
        {
          key: "title",
          label: "Title",
          required: true,
          kind: text({ minLength: 1, maxLength: 180 }),
        },
        {
          key: "slug",
          label: "Slug",
          required: true,
          unique: true,
          kind: text({ minLength: 1, maxLength: 140, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
        },
        {
          key: "excerpt",
          label: "Excerpt",
          required: true,
          kind: text({ minLength: 1, maxLength: 400, multiline: true }),
        },
        {
          key: "body",
          label: "Body",
          required: true,
          kind: { kind: "rich-text", formatVersion: 1 },
        },
        { key: "featured-asset", label: "Featured image", nullable: true, kind: { kind: "asset" } },
        {
          key: "featured-alternative-text",
          label: "Featured image alternative text",
          nullable: true,
          kind: text({ maxLength: 240 }),
        },
        { key: "author", label: "Author", required: true, kind: relationship(["author"]) },
        {
          key: "categories",
          label: "Categories",
          kind: {
            kind: "list",
            element: relationship(["category"]),
            distinct: true,
            maximumLength: 20,
          },
        },
        {
          key: "tags",
          label: "Tags",
          kind: { kind: "list", element: relationship(["tag"]), distinct: true, maximumLength: 40 },
        },
        {
          key: "status",
          label: "Post status",
          required: true,
          defaultValue: "draft",
          kind: { kind: "enum", values: ["draft", "published"] },
        },
        {
          key: "published-at",
          label: "Publication time",
          nullable: true,
          kind: { kind: "datetime" },
        },
      ],
    },
    {
      kind: "contentType",
      id: "comment",
      name: "Comment",
      history: true,
      revisionRetention: { maximumRevisionCount: 25 },
      fields: [
        { key: "post", label: "Post", required: true, kind: relationship(["post"]) },
        {
          key: "display-name",
          label: "Display name",
          required: true,
          kind: text({ minLength: 1, maxLength: 80 }),
        },
        { key: "website-url", label: "Website URL", nullable: true, kind: { kind: "url" } },
        {
          key: "body",
          label: "Comment",
          required: true,
          kind: text({ minLength: 1, maxLength: 2_000, multiline: true }),
        },
        { key: "created-at", label: "Creation time", required: true, kind: { kind: "datetime" } },
        {
          key: "status",
          label: "Comment status",
          required: true,
          defaultValue: "pending",
          kind: { kind: "enum", values: ["pending", "approved", "rejected"] },
        },
      ],
    },
  ],
  snapshotId: "example-blog-v1",
});
