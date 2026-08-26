import {
  AllowAllAuthorization,
  AnonymousIdentity,
  BunFilesystemPersistence,
  CmsService,
  CryptoIdentifierGenerator,
  Effect,
  Exit,
  Layer,
  expect,
  initialSnapshot,
  join,
  makeCmsLayer,
  mkdtemp,
  noteSlugMigrationHandler,
  noteSlugMigrationManifest,
  optionalSummaryDefinition,
  requiredSlugDefinition,
  tmpdir,
} from "./definition-migration-journey-scenarios-imports.ts";

const expectOldOrNewVisibility = (
    consistentSnapshot: Readonly<{
      readonly entries: readonly { readonly values: Readonly<Record<string, unknown>> }[];
    }>,
    migratedEntry: Readonly<{ readonly values: Readonly<Record<string, unknown>> }>,
  ): void => {
    expect(migratedEntry.values["slug"]).toBe("a-durable-note");
    expect(migratedEntry.values["title"]).toBe("Concurrent write");
    for (const snapshotEntry of consistentSnapshot.entries) {
      const hasOnlyLegacyFields =
          typeof snapshotEntry.values["title"] === "string" &&
          (snapshotEntry.values["summary"] === undefined ||
            typeof snapshotEntry.values["summary"] === "string"),
        hasSlug = typeof snapshotEntry.values["slug"] === "string";
      expect(hasSlug || hasOnlyLegacyFields).toBeTrue();
      if (hasSlug) {
        expect(snapshotEntry.values["slug"]).toBe("a-durable-note");
      }
    }
  },
  filesystemNoteSlugMigrationLayer = (root: string) => {
    const filesystemLayer = BunFilesystemPersistence.cmsLayer({
        acknowledgement: "durable",
        definitionSnapshot: initialSnapshot,
        root,
      }).pipe(Layer.provide(CryptoIdentifierGenerator.layer)),
      mergedDependencies = Layer.mergeAll(
        AllowAllAuthorization.layer,
        AnonymousIdentity.layer,
        CryptoIdentifierGenerator.layer,
        filesystemLayer,
      );
    return makeCmsLayer({ migrationHandlers: [noteSlugMigrationHandler] }).pipe(
      Layer.provide(mergedDependencies),
    );
  },
  journeySource = "complete-system journey",
  requiredSlugSnapshot = {
    definitionSpaceId: "definition-lifecycle",
    definitions: [requiredSlugDefinition],
    snapshotId: "required-slug",
  },
  runWithLayer = <Value, Failure>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<CmsService, Failure>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, Failure, CmsService>>,
  ): Promise<Value> =>
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-285] acceptance journey entry point needs a fresh isolated layer.
    Effect.runPromise(effect.pipe(Effect.provide(layer))),
  secondCatalogVersion = 2,
  verifyDefinitionMigrationJourney = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-journey-definition-migration-")).then((root) =>
      runWithLayer(filesystemNoteSlugMigrationLayer(root), verifyJourneyFreshMigrationCutover),
    ),
  verifyJourneyCompatibleActivation = Effect.gen(function* verifyJourneyCompatibleActivation() {
    const { cms, entry } = yield* verifyJourneyNoteEntryCreated,
      appendedCompatible = yield* cms.appendDefinitionRevision({
        definition: optionalSummaryDefinition,
        expectedCatalogVersion: 1,
        source: journeySource,
      }),
      compatible = yield* cms.activateDefinitionSnapshot({
        expectedCatalogVersion: secondCatalogVersion,
        snapshot: {
          definitionSpaceId: "definition-lifecycle",
          definitions: [optionalSummaryDefinition],
          snapshotId: "optional-summary",
        },
        source: journeySource,
      });
    expect(appendedCompatible.version).toBe(secondCatalogVersion);
    expect(compatible.migratedEntryCount).toBe(0);
    return { cms, entry };
  }),
  verifyJourneyFreshMigrationCutover = Effect.gen(function* verifyJourneyFreshMigrationCutover() {
    const { cms, entry } = yield* verifyJourneyStaleMigrationPreparation,
      step1CatalogBeforeFreshPrepare = yield* cms.readDefinitionCatalog(),
      step2FreshPreparation = yield* cms.prepareDefinitionMigration({
        expectedCatalogVersion: step1CatalogBeforeFreshPrepare.version,
        manifestId: noteSlugMigrationManifest.id,
        snapshot: requiredSlugSnapshot,
      }),
      step3CatalogAfterFreshPrepare = yield* cms.readDefinitionCatalog(),
      step4Migrated = yield* cms.activateDefinitionSnapshot({
        expectedCatalogVersion: step3CatalogAfterFreshPrepare.version,
        migration: { manifest: noteSlugMigrationManifest, preparationId: step2FreshPreparation.id },
        snapshot: requiredSlugSnapshot,
        source: journeySource,
      }),
      step5ConsistentSnapshot = yield* cms.readConsistentSnapshot(),
      step6MigratedEntry = yield* cms.getEntry({ contentTypeId: "note", entryId: entry.id });
    expect(step4Migrated.migratedEntryCount).toBe(1);
    expectOldOrNewVisibility(step5ConsistentSnapshot, step6MigratedEntry);
    expect((yield* cms.activeDefinitionSnapshot()).snapshotId).toBe("required-slug");
  }),
  verifyJourneyMigrationPrepared = Effect.gen(function* verifyJourneyMigrationPrepared() {
    const { appendedRequiredVersion, cms, entry } = yield* verifyJourneyRequiredSlugRejection,
      step1ManifestCatalog = yield* cms.appendMigrationManifest({
        expectedCatalogVersion: appendedRequiredVersion,
        manifest: noteSlugMigrationManifest,
      }),
      step2StalePreparation = yield* cms.prepareDefinitionMigration({
        expectedCatalogVersion: step1ManifestCatalog.version,
        manifestId: noteSlugMigrationManifest.id,
        snapshot: requiredSlugSnapshot,
      }),
      step3CatalogAfterStalePrepare = yield* cms.readDefinitionCatalog();
    return {
      catalogAfterStalePrepare: step3CatalogAfterStalePrepare,
      cms,
      entry,
      stalePreparation: step2StalePreparation,
    };
  }),
  verifyJourneyNoteEntryCreated = Effect.gen(function* verifyJourneyNoteEntryCreated() {
    const cms = yield* CmsService,
      created = yield* cms.createEntry({
        contentTypeId: "note",
        values: { title: "A durable note" },
      });
    if (!("entry" in created)) {
      return yield* Effect.die("Expected entry on create");
    }
    return { cms, entry: created.entry };
  }),
  verifyJourneyRequiredSlugRejection = Effect.gen(function* verifyJourneyRequiredSlugRejection() {
    const { cms, entry } = yield* verifyJourneyCompatibleActivation,
      appendedRequired = yield* cms.appendDefinitionRevision({
        definition: requiredSlugDefinition,
        expectedCatalogVersion: 3,
        source: journeySource,
      }),
      rejectedDirectActivation = yield* Effect.exit(
        cms.activateDefinitionSnapshot({
          expectedCatalogVersion: appendedRequired.version,
          snapshot: requiredSlugSnapshot,
          source: journeySource,
        }),
      );
    expect(Exit.isFailure(rejectedDirectActivation)).toBeTrue();
    expect((yield* cms.activeDefinitionSnapshot()).snapshotId).toBe("optional-summary");
    return { appendedRequiredVersion: appendedRequired.version, cms, entry };
  }),
  verifyJourneyStaleMigrationPreparation = Effect.gen(
    function* verifyJourneyStaleMigrationPreparation() {
      const { catalogAfterStalePrepare, cms, entry, stalePreparation } =
          yield* verifyJourneyMigrationPrepared,
        step1CurrentState = yield* cms.getCurrentEntryState({
          contentTypeId: "note",
          entryId: entry.id,
        }),
        step2ConcurrentWrite = yield* cms.updateEntry({
          contentTypeId: "note",
          entryId: entry.id,
          values: { title: "Concurrent write" },
          writeToken: step1CurrentState.writeToken,
        }),
        step3StaleActivation = yield* Effect.exit(
          cms.activateDefinitionSnapshot({
            expectedCatalogVersion: catalogAfterStalePrepare.version,
            migration: {
              manifest: noteSlugMigrationManifest,
              preparationId: stalePreparation.id,
            },
            snapshot: requiredSlugSnapshot,
            source: journeySource,
          }),
        );
      if (!("entry" in step2ConcurrentWrite)) {
        return yield* Effect.die("Expected entry on concurrent write");
      }
      expect(step2ConcurrentWrite.entry.values["title"]).toBe("Concurrent write");
      expect(Exit.isFailure(step3StaleActivation)).toBeTrue();
      return { cms, entry };
    },
  );

export { verifyDefinitionMigrationJourney };
