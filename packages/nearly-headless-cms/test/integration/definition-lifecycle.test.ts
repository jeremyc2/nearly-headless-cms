import { Effect, Exit } from "effect";
import { describe, expect, test } from "bun:test";
import {
  incompatibleNoteDefinition,
  noteSlugMigrationLayer,
  noteSlugMigrationManifest,
  operationContractsLayer,
  optionalSummaryDefinition,
  ratedNoteDefinition,
  ratedNotesLayer,
  requiredSlugDefinition,
} from "./definition-lifecycle-fixture.ts";
import { Cms } from "../../src/index.ts";

const runNoteSlugMigration = <Value, Failure>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, Failure, Cms.Service>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-111] test entry point needs a fresh isolated layer per run.
    Effect.runPromise(effect.pipe(Effect.provide(noteSlugMigrationLayer))),
  runOperationContracts = <Value, Failure>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, Failure, Cms.Service>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-111] test entry point needs a fresh isolated layer per run.
    Effect.runPromise(effect.pipe(Effect.provide(operationContractsLayer))),
  runRatedNotes = <Value, Failure>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, Failure, Cms.Service>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-111] test entry point needs a fresh isolated layer per run.
    Effect.runPromise(effect.pipe(Effect.provide(ratedNotesLayer))),
  secondCatalogVersion = 2,
  verifyCatalogEvents = Effect.gen(function* verifyCatalogEvents() {
    const { cms } = yield* verifyEntryRestoreAfterMigration,
      catalog = yield* cms.readDefinitionCatalog();
    expect(catalog.active.compiled.snapshotId).toBe("required-slug");
    expect(catalog.events.map((event) => event.eventType)).toContain("revisionAppended");
    expect(catalog.events.map((event) => event.eventType)).toContain("snapshotActivated");
  }),
  verifyEntryRestoreAfterMigration = Effect.gen(function* verifyEntryRestoreAfterMigration() {
    const { cms, entry } = yield* verifyMigrationActivated,
      current = yield* cms.getCurrentEntryState({ contentTypeId: "note", entryId: entry.id }),
      restored = yield* cms.restoreEntryRevision({
        contentTypeId: "note",
        entryId: entry.id,
        revisionNumber: 1,
        writeToken: current.writeToken,
      });
    expect(restored.entry.values["slug"]).toBe("a-durable-note");
    return { cms, entry };
  }),
  verifyIncompatibleActivationRejected = Effect.gen(
    function* verifyIncompatibleActivationRejected() {
      const { appended, cms } = yield* verifyIncompatibleRevisionAppended,
        activation = yield* Effect.exit(
          cms.activateDefinitionSnapshot({
            expectedCatalogVersion: appended.version,
            snapshot: {
              definitionSpaceId: "definition-lifecycle",
              definitions: [incompatibleNoteDefinition],
              snapshotId: "incompatible-operation-contract",
            },
          }),
        ),
        catalog = yield* cms.readDefinitionCatalog();
      expect(Exit.isFailure(activation)).toBeTrue();
      expect((yield* cms.activeDefinitionSnapshot()).snapshotId).toBe("initial");
      expect(catalog.version).toBe(appended.version);
    },
  ),
  verifyIncompatibleRevisionAppended = Cms.Service.pipe(
    Effect.flatMap((cms) =>
      cms
        .appendDefinitionRevision({
          definition: incompatibleNoteDefinition,
          expectedCatalogVersion: 1,
        })
        .pipe(Effect.map((appended) => ({ appended, cms }))),
    ),
  ),
  verifyInvalidRatingRejected = Effect.gen(function* verifyInvalidRatingRejected() {
    yield* verifyRatedNoteActivation;
    const cms = yield* Cms.Service,
      invalidCreate = yield* Effect.exit(
        cms.createEntry({ contentTypeId: "note", values: { rating: 6, title: "Invalid" } }),
      );
    expect(Exit.isFailure(invalidCreate)).toBeTrue();
  }),
  verifyMigrationActivated = Effect.gen(function* verifyMigrationActivated() {
    const { cms, entry, preparation, preparedCatalog } = yield* verifyMigrationPrepared,
      migrated = yield* cms.activateDefinitionSnapshot({
        expectedCatalogVersion: preparedCatalog.version,
        migration: { manifest: noteSlugMigrationManifest, preparationId: preparation.id },
        snapshot: {
          definitionSpaceId: "definition-lifecycle",
          definitions: [requiredSlugDefinition],
          snapshotId: "required-slug",
        },
        source: "integration test",
      });
    expect(migrated.migratedEntryCount).toBe(1);
    expect((yield* cms.getEntry({ contentTypeId: "note", entryId: entry.id })).values["slug"]).toBe(
      "a-durable-note",
    );
    return { cms, entry };
  }),
  verifyMigrationPrepared = Effect.gen(function* verifyMigrationPrepared() {
    const { appendedRequiredVersion, cms, entry } = yield* verifyRequiredSlugRejection,
      manifestCatalog = yield* cms.appendMigrationManifest({
        expectedCatalogVersion: appendedRequiredVersion,
        manifest: noteSlugMigrationManifest,
      }),
      preparation = yield* cms.prepareDefinitionMigration({
        expectedCatalogVersion: manifestCatalog.version,
        manifestId: noteSlugMigrationManifest.id,
        snapshot: {
          definitionSpaceId: "definition-lifecycle",
          definitions: [requiredSlugDefinition],
          snapshotId: "required-slug",
        },
      }),
      preparedCatalog = yield* cms.readDefinitionCatalog();
    return { cms, entry, preparation, preparedCatalog };
  }),
  verifyNoteEntryCreated = Effect.gen(function* verifyNoteEntryCreated() {
    const cms = yield* Cms.Service,
      created = yield* cms.createEntry({
        contentTypeId: "note",
        values: { title: "A durable note" },
      });
    if (!("entry" in created)) {
      return yield* Effect.die("Expected entry on create");
    }
    return { cms, entry: created.entry };
  }),
  verifyOptionalSummaryActivated = Effect.gen(function* verifyOptionalSummaryActivated() {
    const { cms, entry } = yield* verifyNoteEntryCreated,
      appended = yield* cms.appendDefinitionRevision({
        definition: optionalSummaryDefinition,
        expectedCatalogVersion: 1,
        source: "integration test",
      }),
      compatible = yield* cms.activateDefinitionSnapshot({
        expectedCatalogVersion: 2,
        snapshot: {
          definitionSpaceId: "definition-lifecycle",
          definitions: [optionalSummaryDefinition],
          snapshotId: "optional-summary",
        },
        source: "integration test",
      });
    expect(appended.version).toBe(secondCatalogVersion);
    expect(compatible.migratedEntryCount).toBe(0);
    expect((yield* cms.getEntry({ contentTypeId: "note", entryId: entry.id })).values).toEqual({
      title: "A durable note",
    });
    return { cms, entry };
  }),
  verifyRatedNoteActivation = Effect.gen(function* verifyRatedNoteActivation() {
    const { appended, cms } = yield* verifyRatedNoteRevisionAppended,
      activated = yield* cms.activateDefinitionSnapshot({
        expectedCatalogVersion: appended.version,
        snapshot: {
          definitionSpaceId: "definition-lifecycle",
          definitions: [ratedNoteDefinition],
          snapshotId: "rated-notes",
        },
      });
    expect(activated.snapshot.snapshotId).toBe("rated-notes");
    yield* cms.createEntry({ contentTypeId: "note", values: { rating: 5, title: "Excellent" } });
  }),
  verifyRatedNoteRevisionAppended = Cms.Service.pipe(
    Effect.flatMap((cms) =>
      cms
        .appendDefinitionRevision({ definition: ratedNoteDefinition, expectedCatalogVersion: 1 })
        .pipe(Effect.map((appended) => ({ appended, cms }))),
    ),
  ),
  verifyRequiredSlugRejection = Effect.gen(function* verifyRequiredSlugRejection() {
    const { cms, entry } = yield* verifyOptionalSummaryActivated,
      appendedRequired = yield* cms.appendDefinitionRevision({
        definition: requiredSlugDefinition,
        expectedCatalogVersion: 3,
        source: "integration test",
      }),
      rejected = yield* Effect.exit(
        cms.activateDefinitionSnapshot({
          expectedCatalogVersion: appendedRequired.version,
          snapshot: {
            definitionSpaceId: "definition-lifecycle",
            definitions: [requiredSlugDefinition],
            snapshotId: "required-slug",
          },
          source: "integration test",
        }),
      );
    expect(Exit.isFailure(rejected)).toBeTrue();
    expect((yield* cms.activeDefinitionSnapshot()).snapshotId).toBe("optional-summary");
    return { appendedRequiredVersion: appendedRequired.version, cms, entry };
  });

describe("runtime Content Definition lifecycle", () => {
  test("activates compatible revisions and atomically migrates incompatible Entries", () =>
    runNoteSlugMigration(verifyCatalogEvents));

  test("retains composition-time Custom Field registrations during activation", () =>
    runRatedNotes(verifyInvalidRatingRejected));

  test("rejects activation that breaks a composed operation contract", () =>
    runOperationContracts(verifyIncompatibleActivationRejected));
});
