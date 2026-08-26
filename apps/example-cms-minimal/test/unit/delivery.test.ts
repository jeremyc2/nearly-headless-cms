import { ContentDefinition } from "nearly-headless-cms";
import { definitionRequirementFromContentType } from "nearly-headless-cms/http";
import { expect, test } from "bun:test";
import { makeDeliveryOperations } from "../../src/core/delivery.ts";

const { compileSnapshot, Fields } = ContentDefinition;

test("minimal delivery operations declare note routes", () => {
  const snapshot = compileSnapshot({
      definitionSpaceId: "minimal-notes-test",
      definitions: [
        Fields.contentType({
          fields: [Fields.requiredTextField("title", "Title", { maxLength: 120 })],
          id: "note",
          name: "Note",
        }),
      ],
      snapshotId: "test",
    }),
    requirement = definitionRequirementFromContentType(snapshot, "note"),
    operations = makeDeliveryOperations();

  expect(requirement.contentTypeId).toBe("note");
  expect(operations.map((operation) => operation.identifier)).toEqual([
    "listNotes",
    "getNoteBySlug",
  ]);
});

test("compileSnapshot accepts an empty definition list", () => {
  const snapshot = compileSnapshot({
    definitionSpaceId: "notes",
    definitions: [],
    snapshotId: "empty",
  });
  expect(snapshot.contentTypes.size).toBe(0);
});
