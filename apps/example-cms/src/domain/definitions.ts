import { ContentDefinition } from "nearly-headless-cms";

const relationship = (
    targetContentTypeIds: readonly string[],
  ): ContentDefinition.RelationshipFieldKind => ({ kind: "relationship", targetContentTypeIds }),
  text = (
    options: Omit<ContentDefinition.TextFieldKind, "kind"> = {},
  ): ContentDefinition.TextFieldKind => ({ kind: "text", ...options }),
  zDefinitionSnapshot = ContentDefinition.compileSnapshot({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [
          {
            key: "label",
            kind: text({ maxLength: 80, minLength: 1 }),
            label: "Label",
            required: true,
          },
          { key: "url", kind: { kind: "url" }, label: "URL", required: true },
        ],
        id: "external-link",
        kind: "fieldGroup",
        name: "External Link",
      },
      {
        fields: [
          {
            key: "name",
            kind: text({ maxLength: 120, minLength: 1 }),
            label: "Name",
            required: true,
            unique: true,
          },
          {
            key: "slug",
            kind: text({ maxLength: 100, minLength: 1, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
            label: "Slug",
            required: true,
            unique: true,
          },
          {
            key: "biography",
            kind: text({ maxLength: 500, minLength: 1, multiline: true }),
            label: "Short biography",
            required: true,
          },
          {
            key: "profile",
            kind: { formatVersion: 1, kind: "rich-text" },
            label: "Profile",
            nullable: true,
          },
          { key: "portrait", kind: { kind: "asset" }, label: "Portrait", nullable: true },
          {
            key: "portrait-alternative-text",
            kind: text({ maxLength: 240 }),
            label: "Portrait alternative text",
            nullable: true,
          },
          {
            key: "external-links",
            kind: { element: { kind: "json" }, kind: "list", maximumLength: 10 },
            label: "External links",
          },
        ],
        history: true,
        id: "author",
        kind: "contentType",
        name: "Author",
      },
      {
        fields: [
          {
            key: "name",
            kind: text({ maxLength: 80, minLength: 1 }),
            label: "Name",
            required: true,
            unique: true,
          },
          {
            key: "slug",
            kind: text({ maxLength: 80, minLength: 1, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
            label: "Slug",
            required: true,
            unique: true,
          },
          {
            key: "description",
            kind: text({ maxLength: 300, multiline: true }),
            label: "Description",
            nullable: true,
          },
        ],
        history: true,
        id: "category",
        kind: "contentType",
        name: "Category",
      },
      {
        fields: [
          {
            key: "name",
            kind: text({ maxLength: 80, minLength: 1 }),
            label: "Name",
            required: true,
            unique: true,
          },
          {
            key: "slug",
            kind: text({ maxLength: 80, minLength: 1, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
            label: "Slug",
            required: true,
            unique: true,
          },
          {
            key: "description",
            kind: text({ maxLength: 300, multiline: true }),
            label: "Description",
            nullable: true,
          },
        ],
        history: true,
        id: "tag",
        kind: "contentType",
        name: "Tag",
      },
      {
        fields: [
          {
            key: "title",
            kind: text({ maxLength: 180, minLength: 1 }),
            label: "Title",
            required: true,
          },
          {
            key: "slug",
            kind: text({ maxLength: 140, minLength: 1, pattern: "^[a-z0-9]+(?:-[a-z0-9]+)*$" }),
            label: "Slug",
            required: true,
            unique: true,
          },
          {
            key: "excerpt",
            kind: text({ maxLength: 400, minLength: 1, multiline: true }),
            label: "Excerpt",
            required: true,
          },
          {
            key: "body",
            kind: { formatVersion: 1, kind: "rich-text" },
            label: "Body",
            required: true,
          },
          {
            key: "featured-asset",
            kind: { kind: "asset" },
            label: "Featured image",
            nullable: true,
          },
          {
            key: "featured-alternative-text",
            kind: text({ maxLength: 240 }),
            label: "Featured image alternative text",
            nullable: true,
          },
          { key: "author", kind: relationship(["author"]), label: "Author", required: true },
          {
            key: "categories",
            kind: {
              distinct: true,
              element: relationship(["category"]),
              kind: "list",
              maximumLength: 20,
            },
            label: "Categories",
          },
          {
            key: "tags",
            kind: {
              distinct: true,
              element: relationship(["tag"]),
              kind: "list",
              maximumLength: 40,
            },
            label: "Tags",
          },
          {
            defaultValue: "draft",
            key: "status",
            kind: { kind: "enum", values: ["draft", "published"] },
            label: "Post status",
            required: true,
          },
          {
            key: "published-at",
            kind: { kind: "datetime" },
            label: "Publication time",
            nullable: true,
          },
        ],
        history: true,
        id: "post",
        kind: "contentType",
        name: "Post",
        revisionRetention: { maximumRevisionCount: 100 },
      },
      {
        fields: [
          { key: "post", kind: relationship(["post"]), label: "Post", required: true },
          {
            key: "display-name",
            kind: text({ maxLength: 80, minLength: 1 }),
            label: "Display name",
            required: true,
          },
          { key: "website-url", kind: { kind: "url" }, label: "Website URL", nullable: true },
          {
            key: "body",
            kind: text({ maxLength: 2000, minLength: 1, multiline: true }),
            label: "Comment",
            required: true,
          },
          { key: "created-at", kind: { kind: "datetime" }, label: "Creation time", required: true },
          {
            defaultValue: "pending",
            key: "status",
            kind: { kind: "enum", values: ["pending", "approved", "rejected"] },
            label: "Comment status",
            required: true,
          },
        ],
        history: true,
        id: "comment",
        kind: "contentType",
        name: "Comment",
        revisionRetention: { maximumRevisionCount: 25 },
      },
    ],
    snapshotId: "example-blog-v1",
  });

/** Compiled Example Blog definition snapshot. */
export { zDefinitionSnapshot as definitionSnapshot };
