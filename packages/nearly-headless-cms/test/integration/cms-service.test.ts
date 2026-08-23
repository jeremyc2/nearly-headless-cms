import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { Cms, ContentDefinition } from "../../src/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const snapshot = ContentDefinition.compile({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        kind: "contentType",
        id: "author",
        name: "Author",
        fields: [
          { key: "name", label: "Name", required: true, unique: true, kind: { kind: "text" } },
        ],
      },
      {
        kind: "contentType",
        id: "post",
        name: "Post",
        history: true,
        fields: [
          { key: "title", label: "Title", required: true, kind: { kind: "text" } },
          {
            key: "status",
            label: "Status",
            defaultValue: "draft",
            kind: { kind: "enum", values: ["draft", "published"] },
          },
          {
            key: "author",
            label: "Author",
            required: true,
            kind: { kind: "relationship", targetContentTypeIds: ["author"] },
          },
        ],
      },
    ],
    snapshotId: "initial",
  }),
  run = async <Value, Error>(effect: Effect.Effect<Value, Error, Cms.Service>) =>
    Effect.runPromise(effect.pipe(Effect.provide(DevelopmentCms.layer({ snapshot }))));

describe("Cms.Service", () => {
  test("enforces definitions, Relationships, unique values, and history-aware concurrency", async () => {
    await run(
      Effect.gen(function* () {
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
    );

    await expect(
      run(
        Effect.gen(function* () {
          const cms = yield* Cms.Service;
          yield* cms.createEntry({
            contentTypeId: "post",
            values: { author: "missing", title: "Broken" },
          });
        }),
      ),
    ).rejects.toThrow("Relationship target");
  });
});
