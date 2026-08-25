import { type CompiledSnapshot, type JsonObject, compileSnapshot } from "../../src/content-definition.ts";
import { describe, expect, test } from "bun:test";
import { DefinitionMigration } from "../../src/index.ts";

const firstEntryIndex = 0,
  source: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        id: "post",
        kind: "contentType",
        name: "Post",
      },
    ],
    snapshotId: "source",
  }),
  staleSourceGeneration = 4,
  target: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [{ key: "headline", kind: { kind: "text" }, label: "Headline", required: true }],
        id: "post",
        kind: "contentType",
        name: "Post",
      },
    ],
    snapshotId: "target",
  });

describe("DefinitionMigration preparation", () => {
  test("prepares deterministic one-to-one replacements and detects stale cutover", () => {
    const manifest = {
        handlerIdentifier: "com.example.rename-title",
        handlerVersion: 1,
        id: "rename-title",
        sourceSnapshotId: "source",
        targetSnapshotId: "target",
      } as const,
      preparation = DefinitionMigration.prepare({
        entries: [{ contentTypeId: "post", id: "post-1", values: { title: "Hello" } }],
        handlers: [
          {
            identifier: "com.example.rename-title",
            transform: ({ values }): JsonObject => ({
              headline: values["title"] ?? "",
            }),
            version: 1,
          },
        ],
        manifest,
        source,
        sourceGeneration: 3,
        target,
      });

    expect(preparation.report).toEqual({ status: "ready", transformedEntryCount: 1 });
    expect(preparation.entries[firstEntryIndex]?.values).toEqual({ headline: "Hello" });
    expect(() => {
      DefinitionMigration.assertFresh(preparation, staleSourceGeneration);
    }).toThrow("stale");
  });
});

describe("DefinitionMigration graph validation", () => {
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
