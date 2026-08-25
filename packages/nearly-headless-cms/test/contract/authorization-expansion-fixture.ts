import { type CompiledSnapshot, compileSnapshot } from "../../src/content-definition.ts";

const authorizationContractSnapshot: CompiledSnapshot = compileSnapshot({
  definitionSpaceId: "authorization-contract",
  definitions: [
    {
      fields: [
        { key: "name", kind: { kind: "text" }, label: "Name", required: true },
        {
          key: "friend",
          kind: { kind: "relationship", targetContentTypeIds: ["person"] },
          label: "Friend",
          nullable: true,
        },
      ],
      id: "person",
      kind: "contentType",
      name: "Person",
    },
    {
      fields: [
        {
          key: "editor",
          kind: { kind: "relationship", targetContentTypeIds: ["person"] },
          label: "Editor",
        },
      ],
      id: "byline",
      kind: "fieldGroup",
      name: "Byline",
    },
    {
      fieldGroups: [{ fieldGroupId: "byline", key: "metadata", label: "Metadata", mode: "nested" }],
      fields: [
        { key: "title", kind: { kind: "text" }, label: "Title", required: true },
        {
          key: "authors",
          kind: {
            distinct: true,
            element: { kind: "relationship", targetContentTypeIds: ["person"] },
            kind: "list",
          },
          label: "Authors",
        },
      ],
      id: "article",
      kind: "contentType",
      name: "Article",
    },
  ],
  snapshotId: "initial",
});

export { authorizationContractSnapshot };
