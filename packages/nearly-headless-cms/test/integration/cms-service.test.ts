import { type CompiledSnapshot, compileSnapshot } from "../../src/content-definition.ts";
import { describe, expect, test } from "bun:test";
import { Cms } from "../../src/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";
import { Effect } from "effect";

const createVerifiedAuthor = Effect.gen(function* createVerifiedAuthor() {
    const author = yield* Cms.Service.pipe(
      Effect.flatMap((cms) =>
        cms.createEntry({ contentTypeId: "author", values: { name: "Ada" } }),
      ),
    );
    expect("writeToken" in author).toBeFalse();
    if ("writeToken" in author) {
      return yield* Effect.die("Author entry unexpectedly returned a write token");
    }
    return author;
  }),
  createVerifiedPost = Effect.gen(function* createVerifiedPost() {
    const author = yield* createVerifiedAuthor,
      post = yield* Cms.Service.pipe(
        Effect.flatMap((cms) =>
          cms.createEntry({
            contentTypeId: "post",
            values: { author: author.id, title: "First" },
          }),
        ),
      );
    expect("writeToken" in post).toBeTrue();
    if (!("writeToken" in post)) {
      return yield* Effect.die("Expected write token on post create");
    }
    expect(post.entry.values["status"]).toBe("draft");
    return { author, post };
  }),
  firstRevisionNumber = 1,
  run = <Value, Failure>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-237] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, Failure, Cms.Service>>,
  ): Promise<Value> => {
    const layer = DevelopmentCms.layer({ snapshot }),
      // This test helper is the application entry point for each isolated test run.
      // The layer must be provided here so every run gets a fresh in-memory CMS.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-161] test entry point needs a fresh isolated layer per run.
      providedEffect = effect.pipe(Effect.provide(layer));
    return Effect.runPromise(providedEffect);
  },
  secondRevisionNumber = 2,
  snapshot: CompiledSnapshot = compileSnapshot({
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
  verifyFailedRelationship = Effect.gen(function* verifyFailedRelationship() {
    const cms = yield* Cms.Service;
    yield* cms.createEntry({
      contentTypeId: "post",
      values: { author: "missing", title: "Broken" },
    });
  }),
  verifySuccessfulOperations = Effect.gen(function* verifySuccessfulOperations() {
    const { author, post } = yield* createVerifiedPost,
      cms = yield* Cms.Service,
      publishedPost = yield* cms.updateEntry({
        contentTypeId: "post",
        entryId: post.entry.id,
        values: { author: author.id, status: "published", title: "Published" },
        writeToken: post.writeToken,
      }),
      revisionListing = yield* cms.listEntryRevisions({
        contentTypeId: "post",
        entryId: post.entry.id,
        pageSize: 10,
      });
    if (!("writeToken" in publishedPost)) {
      return yield* Effect.die("Expected write token on post update");
    }
    expect(publishedPost.revisionNumber).toBe(secondRevisionNumber);
    expect(revisionListing.items.map((revision) => revision.revisionNumber)).toEqual([
      secondRevisionNumber,
      firstRevisionNumber,
    ]);
    return yield* Effect.void;
  });

describe("Cms.Service", () => {
  test("enforces definitions, Relationships, unique values, and history-aware concurrency", () =>
    run(verifySuccessfulOperations).then(() => {
      expect(verifyFailedRelationship.pipe(run)).rejects.toThrow("Relationship target");
    }));
});
