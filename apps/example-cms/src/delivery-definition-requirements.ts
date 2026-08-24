export const authorDefinitionRequirement = {
    contentTypeId: "author",
    fields: [
      { kind: "text", path: "name", projectable: true, required: true },
      { kind: "text", path: "slug", projectable: true, required: true },
      { kind: "text", path: "biography", projectable: true, required: true },
      { formatVersion: 1, kind: "rich-text", path: "profile", projectable: true },
      { kind: "asset", path: "portrait", projectable: true },
      { kind: "text", path: "portrait-alternative-text", projectable: true },
      { kind: "list", path: "external-links", projectable: true },
    ],
  } as const,
  commentDefinitionRequirement = {
    contentTypeId: "comment",
    fields: [
      { kind: "relationship", path: "post", projectable: true, required: true },
      { kind: "text", path: "display-name", projectable: true, required: true },
      { kind: "url", path: "website-url", projectable: true },
      { kind: "text", path: "body", projectable: true, required: true },
      { kind: "datetime", path: "created-at", projectable: true, required: true },
      { kind: "enum", path: "status", projectable: true, required: true },
    ],
  } as const,
  postDefinitionRequirement = {
    contentTypeId: "post",
    fields: [
      { kind: "text", path: "title", projectable: true, required: true },
      { kind: "text", path: "slug", projectable: true, required: true },
      { kind: "text", path: "excerpt", projectable: true, required: true },
      { formatVersion: 1, kind: "rich-text", path: "body", projectable: true, required: true },
      { kind: "asset", path: "featured-asset", projectable: true },
      { kind: "text", path: "featured-alternative-text", projectable: true },
      { kind: "relationship", path: "author", projectable: true, required: true },
      { kind: "list", path: "categories", projectable: true },
      { kind: "list", path: "tags", projectable: true },
      { kind: "enum", path: "status", projectable: true, required: true },
      { kind: "datetime", path: "published-at", projectable: true },
    ],
  } as const,
  taxonomyDefinitionRequirement = (contentTypeId: "category" | "tag") =>
    ({
      contentTypeId,
      fields: [
        { kind: "text", path: "name", projectable: true, required: true },
        { kind: "text", path: "slug", projectable: true, required: true },
        { kind: "text", path: "description", projectable: true },
      ],
    }) as const;
