import { type CompiledSnapshot, compileSnapshot } from "../../src/content-definition.ts";
import { Effect, Option } from "effect";
import { describe, expect, test } from "bun:test";
import { Cms } from "../../src/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const FOURTH_REVISION_NUMBER = 4,
  SECOND_REVISION_NUMBER = 2,
  THIRD_REVISION_NUMBER = 3,
  run = <Value, Failure>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, Failure, Cms.Service>>,
  ): Promise<Value> => {
    const layer = DevelopmentCms.layer({ snapshot }),
      // This test helper is the application entry point for each isolated test run.
      // The layer must be provided here so every run gets a fresh in-memory CMS.
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-111] test entry point needs a fresh isolated layer per run.
      providedEffect = effect.pipe(Effect.provide(layer));
    return Effect.runPromise(providedEffect);
  },
  snapshot: CompiledSnapshot = compileSnapshot({
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
  }),
  verifyCreatedNote = Effect.gen(function* verifyCreatedNote() {
    const cms = yield* Cms.Service,
      created = yield* cms.createEntry({ contentTypeId: "note", values: { title: "One" } });
    if (!("entry" in created)) {
      return yield* Effect.die("Expected entry on create");
    }
    return { cms, created };
  }),
  verifyDeletionAndRestore = Effect.gen(function* verifyDeletionAndRestore() {
    const { cms, created, third } = yield* verifyRevisionRetention;
    return yield* cms
      .deleteEntry({
        contentTypeId: "note",
        entryId: created.entry.id,
        writeToken: third.writeToken,
      })
      .pipe(
        Effect.flatMap((deletion) => {
          if (deletion === undefined) {
            return Effect.die("Expected deletion record");
          }
          return Effect.gen(function* verifyDeletionRestoration() {
            const entryAfterDeletion = yield* Effect.option(
                cms.getEntry({ contentTypeId: "note", entryId: created.entry.id }),
              ),
              restored = yield* cms.restoreEntryRevision({
                contentTypeId: "note",
                entryId: created.entry.id,
                revisionNumber: SECOND_REVISION_NUMBER,
                writeToken: deletion.writeToken,
              });
            expect(deletion.latestRevisionNumber).toBe(THIRD_REVISION_NUMBER);
            expect(Option.isNone(entryAfterDeletion)).toBeTrue();
            expect(restored.revisionNumber).toBe(FOURTH_REVISION_NUMBER);
            expect(restored.entry.values["title"]).toBe("Two");
            return { cms, created, restored };
          });
        }),
      );
  }),
  verifyPermanentPurge = Effect.gen(function* verifyPermanentPurge() {
    const { cms, created, restored } = yield* verifyDeletionAndRestore;
    return yield* cms
      .deleteEntry({
        contentTypeId: "note",
        entryId: created.entry.id,
        writeToken: restored.writeToken,
      })
      .pipe(
        Effect.flatMap((finalDeletion) => {
          if (finalDeletion === undefined) {
            return Effect.die("Expected final deletion record");
          }
          return cms
            .permanentlyPurgeEntry({
              contentTypeId: "note",
              entryId: created.entry.id,
              writeToken: finalDeletion.writeToken,
            })
            .pipe(
              Effect.flatMap(() =>
                Effect.option(
                  cms.inspectEntryRevision({
                    contentTypeId: "note",
                    entryId: created.entry.id,
                    revisionNumber: FOURTH_REVISION_NUMBER,
                  }),
                ),
              ),
              Effect.tap((purgedRevision) =>
                Effect.sync(() => {
                  expect(Option.isNone(purgedRevision)).toBeTrue();
                }),
              ),
              Effect.asVoid,
            );
        }),
      );
  }),
  verifyRevisionRetention = Effect.gen(function* verifyRevisionRetention() {
    const { cms, created, second } = yield* verifySecondNoteUpdate,
      revisionThreeUpdate = yield* cms.updateEntry({
        contentTypeId: "note",
        entryId: created.entry.id,
        values: { title: "Three" },
        writeToken: second.writeToken,
      }),
      staleWriteAttempt = yield* Effect.option(
        cms.updateEntry({
          contentTypeId: "note",
          entryId: created.entry.id,
          values: { title: "Stale" },
          writeToken: second.writeToken,
        }),
      );
    if (!("entry" in revisionThreeUpdate)) {
      return yield* Effect.die("Expected entry on third update");
    }
    expect(
      (yield* cms.listEntryRevisions({
        contentTypeId: "note",
        entryId: created.entry.id,
        pageSize: 10,
      })).items.map((revision) => revision.revisionNumber),
    ).toEqual([THIRD_REVISION_NUMBER, SECOND_REVISION_NUMBER]);
    expect(Option.isNone(staleWriteAttempt)).toBeTrue();
    return { cms, created, third: revisionThreeUpdate };
  }),
  verifySecondNoteUpdate = Effect.gen(function* verifySecondNoteUpdate() {
    const { cms, created } = yield* verifyCreatedNote,
      second = yield* cms.updateEntry({
        contentTypeId: "note",
        entryId: created.entry.id,
        values: { title: "Two" },
        writeToken: created.writeToken,
      });
    if (!("entry" in second)) {
      return yield* Effect.die("Expected entry on second update");
    }
    return { cms, created, second };
  });

describe("Entry History state machine", () => {
  test("keeps opaque tokens, retained revisions, deletion records, restoration, and purge coherent", () =>
    run(verifyPermanentPurge));
});
