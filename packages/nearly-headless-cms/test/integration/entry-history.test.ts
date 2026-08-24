import { describe, expect, test } from "bun:test";
import { Effect, Option } from "effect";
import { Cms, ContentDefinition } from "../../src/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const FOURTH_REVISION_NUMBER = 4,
  SECOND_REVISION_NUMBER = 2,
  THIRD_REVISION_NUMBER = 3,
  snapshot = ContentDefinition.compile({
  definitionSpaceId: "history-contract",
  definitions: [
    {
      fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
      history: true,
      id: "note",
      kind: "contentType",
      name: "Note",
      revisionRetention: { maximumRevisionCount: 2 },
    },
  ],
  snapshotId: "initial",
  });

describe("Entry History state machine", () => {
  const runHistoryScenario = Effect.gen(function* runHistoryScenario() {
    const cms = yield* Cms.Service,
      created = yield* cms.createEntry({ contentTypeId: "note", values: { title: "One" } });
    if (!("entry" in created)) {
      return;
    }
    const second = yield* cms.updateEntry({
      contentTypeId: "note",
      entryId: created.entry.id,
      values: { title: "Two" },
      writeToken: created.writeToken,
    });
    if (!("entry" in second)) {
      return;
    }
    const third = yield* cms.updateEntry({
      contentTypeId: "note",
      entryId: created.entry.id,
      values: { title: "Three" },
      writeToken: second.writeToken,
    });
    if (!("entry" in third)) {
      return;
    }
    expect(
      (yield* cms.listEntryRevisions({
        contentTypeId: "note",
        entryId: created.entry.id,
        pageSize: 10,
      })).items.map((revision) => revision.revisionNumber),
    ).toEqual([THIRD_REVISION_NUMBER, SECOND_REVISION_NUMBER]);

    const stale = yield* Effect.option(
      cms.updateEntry({
        contentTypeId: "note",
        entryId: created.entry.id,
        values: { title: "Stale" },
        writeToken: second.writeToken,
      }),
    );
    expect(Option.isNone(stale)).toBeTrue();
    const deletion = yield* cms.deleteEntry({
      contentTypeId: "note",
      entryId: created.entry.id,
      writeToken: third.writeToken,
    });
    if (deletion === undefined) {
      return;
    }
    expect(deletion.latestRevisionNumber).toBe(THIRD_REVISION_NUMBER);
    expect(
      Option.isNone(
        yield* Effect.option(cms.getEntry({ contentTypeId: "note", entryId: created.entry.id })),
      ),
    ).toBeTrue();

    const restored = yield* cms.restoreEntryRevision({
      contentTypeId: "note",
      entryId: created.entry.id,
      revisionNumber: SECOND_REVISION_NUMBER,
      writeToken: deletion.writeToken,
    });
    expect(restored.revisionNumber).toBe(FOURTH_REVISION_NUMBER);
    expect(restored.entry.values["title"]).toBe("Two");
    const finalDeletion = yield* cms.deleteEntry({
      contentTypeId: "note",
      entryId: created.entry.id,
      writeToken: restored.writeToken,
    });
    if (finalDeletion === undefined) {
      return;
    }
    yield* cms.permanentlyPurgeEntry({
      contentTypeId: "note",
      entryId: created.entry.id,
      writeToken: finalDeletion.writeToken,
    });
    expect(
      Option.isNone(
        yield* Effect.option(
          cms.inspectEntryRevision({
            contentTypeId: "note",
            entryId: created.entry.id,
            revisionNumber: FOURTH_REVISION_NUMBER,
          }),
        ),
      ),
    ).toBeTrue();
  });

  test("keeps opaque tokens, retained revisions, deletion records, restoration, and purge coherent", () =>
    // This test invocation is the application entry point and owns the isolated CMS layer.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
    Effect.runPromise(runHistoryScenario.pipe(Effect.provide(DevelopmentCms.layer({ snapshot })))));
});
