import { describe, expect, test } from "bun:test";
import { ContentDefinition, DefinitionMigration } from "../../src/index.ts";

const source = ContentDefinition.compile({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        kind: "contentType",
        id: "post",
        name: "Post",
        fields: [{ key: "title", label: "Title", required: true, kind: { kind: "text" } }],
      },
    ],
    snapshotId: "source",
  }),
  target = ContentDefinition.compile({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        kind: "contentType",
        id: "post",
        name: "Post",
        fields: [{ key: "headline", label: "Headline", required: true, kind: { kind: "text" } }],
      },
    ],
    snapshotId: "target",
  });

describe("DefinitionMigration", () => {
  test("prepares deterministic one-to-one replacements and detects stale cutover", () => {
    const manifest = {
        handlerIdentifier: "com.example.rename-title",
        handlerVersion: 1,
        id: "rename-title",
        sourceSnapshotId: "source",
        targetSnapshotId: "target",
      } as const,
      preparation = DefinitionMigration.prepare({
        entries: [{ id: "post-1", contentTypeId: "post", values: { title: "Hello" } }],
        handlers: [
          {
            identifier: "com.example.rename-title",
            version: 1,
            transform: ({ values }) => ({ headline: values["title"] ?? "" }),
          },
        ],
        manifest,
        source,
        sourceGeneration: 3,
        target,
      });

    expect(preparation.report).toEqual({ status: "ready", transformedEntryCount: 1 });
    expect(preparation.entries[0]?.values).toEqual({ headline: "Hello" });
    expect(() => {
      DefinitionMigration.assertFresh(preparation, 4);
    }).toThrow("stale");
  });

  test("rejects migration edges that create more than one directed path", () => {
    expect(() => {
      DefinitionMigration.validateGraph([
        {
          handlerIdentifier: "com.example.edge",
          handlerVersion: 1,
          id: "a-b",
          sourceSnapshotId: "a",
          targetSnapshotId: "b",
        },
        {
          handlerIdentifier: "com.example.edge",
          handlerVersion: 1,
          id: "b-c",
          sourceSnapshotId: "b",
          targetSnapshotId: "c",
        },
        {
          handlerIdentifier: "com.example.edge",
          handlerVersion: 1,
          id: "a-c",
          sourceSnapshotId: "a",
          targetSnapshotId: "c",
        },
      ]);
    }).toThrow("ambiguous");
  });
});
