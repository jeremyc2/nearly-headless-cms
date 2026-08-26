import { ContentDefinition } from "nearly-headless-cms";

const { Fields } = ContentDefinition,
  definitionSource = {
    definitionSpaceId: "minimal-notes",
    definitions: [
      Fields.contentType({
        fields: [
          Fields.requiredTextField("title", "Title", { maxLength: 120 }),
          Fields.requiredSlugField("slug", "Slug", { maxLength: 100 }),
          {
            key: "body",
            kind: Fields.text({ maxLength: 2000, multiline: true }),
            label: "Body",
            required: true,
          },
        ],
        id: "note",
        name: "Note",
      }),
    ],
    snapshotId: "initial",
  },
  definitionSnapshot = ContentDefinition.compileSnapshot(definitionSource);

export { definitionSnapshot, definitionSource };
