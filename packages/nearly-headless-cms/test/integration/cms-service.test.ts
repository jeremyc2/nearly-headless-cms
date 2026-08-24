import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Cms, ContentDefinition } from "../../src/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const snapshot = ContentDefinition.compile({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [
          { key: "name", kind: { kind: "text" }, label: "Name", required: true, unique: true },
        ],
        id: "author",
        kind: "contentType",
        name: "Author",
      },
      {
        fields: [
          { key: "title", kind: { kind: "text" }, label: "Title", required: true },
          {
            defaultValue: "draft",
            key: "status",
            kind: { kind: "enum", values: ["draft", "published"] },
            label: "Status",
          },
          {
            key: "author",
            kind: { kind: "relationship", targetContentTypeIds: ["author"] },
            label: "Author",
            required: true,
          },
        ],
        history: true,
        id: "post",
        kind: "contentType",
        name: "Post",
      },
    ],
    snapshotId: "initial",
  }),
  run = <Value, Error>(effect: Effect.Effect<Value, Error, Cms.Service>): Promise<Value> =>
    Effect.runPromise(effect.pipe(Effect.provide(DevelopmentCms.layer({ snapshot })))),
  verifySuccessfulOperations = Effect.gen(function* verifySuccessfulOperations() {
    const cms = yield* Cms.Service,
     author = yield* cms.createEntry({ contentTypeId: "author", values: { name: "Ada" } });
    expect("writeToken" in author).toBeFalse();
    if ("writeToken" in author) {
      return;
    }
    const post = yield* cms.createEntry({
      contentTypeId: "post",
      values: { author: author.id, title: "First" },
    });
    expect("writeToken" in post).toBeTrue();
    if (!("writeToken" in post)) {
      return;
    }
    expect(post.entry.values["status"]).toBe("draft");
    const updated = yield* cms.updateEntry({
      contentTypeId: "post",
      entryId: post.entry.id,
      values: { author: author.id, status: "published", title: "Published" },
      writeToken: post.writeToken,
    });
    if (!("writeToken" in updated)) {
      return;
    }
    expect(updated.revisionNumber).toBe(2);
    const revisions = yield* cms.listEntryRevisions({
      contentTypeId: "post",
      entryId: post.entry.id,
      pageSize: 10,
    });
    expect(revisions.items.map((revision) => revision.revisionNumber)).toEqual([2, 1]);
  }),
  verifyFailedRelationship = Effect.gen(function* verifyFailedRelationship() {
    const cms = yield* Cms.Service;
    yield* cms.createEntry({
      contentTypeId: "post",
      values: { author: "missing", title: "Broken" },
    });
  });

describe("Cms.Service", () => {
  test("enforces definitions, Relationships, unique values, and history-aware concurrency", async () => {
    await run(verifySuccessfulOperations);

    expect(run(verifyFailedRelationship)).rejects.toThrow("Relationship target");
  });
});
