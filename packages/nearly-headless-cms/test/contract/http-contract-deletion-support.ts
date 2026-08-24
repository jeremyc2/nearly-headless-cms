import { ContentDefinition } from "../../src/index.ts";

export const deletionSnapshot = ContentDefinition.compile({
  definitionSpaceId: "delete-contract",
  definitions: [
    {
      fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
      history: true,
      id: "historical-note",
      kind: "contentType",
      name: "Historical Note",
    },
    {
      fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
      id: "temporary-note",
      kind: "contentType",
      name: "Temporary Note",
    },
  ],
  snapshotId: "initial",
});
