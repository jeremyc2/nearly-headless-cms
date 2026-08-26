import { ContentDefinition } from "nearly-headless-cms";

const { Fields } = ContentDefinition,
  definitionSource = {
    definitionSpaceId: "example-blog-cms",
    definitions: [
    Fields.fieldGroup({
      fields: [
        Fields.requiredTextField("label", "Label", { maxLength: 80, minLength: 1 }),
        { key: "url", kind: { kind: "url" }, label: "URL", required: true },
      ],
      id: "external-link",
      name: "External Link",
    }),
    Fields.contentType({
      fields: [
        {
          ...Fields.requiredTextField("name", "Name", { maxLength: 120, minLength: 1 }),
          unique: true,
        },
        Fields.requiredSlugField("slug", "Slug", { maxLength: 100, minLength: 1 }),
        Fields.requiredTextField("biography", "Short biography", {
          maxLength: 500,
          minLength: 1,
          multiline: true,
        }),
        {
          key: "profile",
          kind: { formatVersion: 1, kind: "rich-text" },
          label: "Profile",
          nullable: true,
        },
        { key: "portrait", kind: { kind: "asset" }, label: "Portrait", nullable: true },
        {
          key: "portrait-alternative-text",
          kind: Fields.text({ maxLength: 240 }),
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
      name: "Author",
    }),
    Fields.contentType({
      fields: [
        {
          ...Fields.requiredTextField("name", "Name", { maxLength: 80, minLength: 1 }),
          unique: true,
        },
        Fields.requiredSlugField("slug", "Slug", { maxLength: 80, minLength: 1 }),
        {
          key: "description",
          kind: Fields.text({ maxLength: 300, multiline: true }),
          label: "Description",
          nullable: true,
        },
      ],
      history: true,
      id: "category",
      name: "Category",
    }),
    Fields.contentType({
      fields: [
        {
          ...Fields.requiredTextField("name", "Name", { maxLength: 80, minLength: 1 }),
          unique: true,
        },
        Fields.requiredSlugField("slug", "Slug", { maxLength: 80, minLength: 1 }),
        {
          key: "description",
          kind: Fields.text({ maxLength: 300, multiline: true }),
          label: "Description",
          nullable: true,
        },
      ],
      history: true,
      id: "tag",
      name: "Tag",
    }),
    Fields.contentType({
      fields: [
        Fields.requiredTextField("title", "Title", { maxLength: 180, minLength: 1 }),
        Fields.requiredSlugField("slug", "Slug", { maxLength: 140, minLength: 1 }),
        Fields.requiredTextField("excerpt", "Excerpt", {
          maxLength: 400,
          minLength: 1,
          multiline: true,
        }),
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
          kind: Fields.text({ maxLength: 240 }),
          label: "Featured image alternative text",
          nullable: true,
        },
        { key: "author", kind: Fields.relationship(["author"]), label: "Author", required: true },
        {
          key: "categories",
          kind: Fields.relationshipList(["category"], 20),
          label: "Categories",
        },
        {
          key: "tags",
          kind: Fields.relationshipList(["tag"], 40),
          label: "Tags",
        },
        {
          defaultValue: "draft",
          key: "status",
          kind: Fields.enumField(["draft", "published"]),
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
      name: "Post",
      revisionRetention: { maximumRevisionCount: 100 },
    }),
    Fields.contentType({
      fields: [
        { key: "post", kind: Fields.relationship(["post"]), label: "Post", required: true },
        Fields.requiredTextField("display-name", "Display name", { maxLength: 80, minLength: 1 }),
        { key: "website-url", kind: { kind: "url" }, label: "Website URL", nullable: true },
        Fields.requiredTextField("body", "Comment", {
          maxLength: 2000,
          minLength: 1,
          multiline: true,
        }),
        {
          key: "created-at",
          kind: { kind: "datetime" },
          label: "Creation time",
          required: true,
        },
        {
          defaultValue: "pending",
          key: "status",
          kind: Fields.enumField(["pending", "approved", "rejected"]),
          label: "Comment status",
          required: true,
        },
      ],
      history: true,
      id: "comment",
      name: "Comment",
      revisionRetention: { maximumRevisionCount: 25 },
    }),
  ],
  snapshotId: "example-blog-cms-v1",
  },
  definitionSnapshot = ContentDefinition.compileSnapshot(definitionSource);

/** Source input for the Example Blog definition snapshot. */
export { definitionSource };

/** Compiled Example Blog definition snapshot. */
export { definitionSnapshot };
