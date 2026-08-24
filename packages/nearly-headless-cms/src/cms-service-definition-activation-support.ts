import { type CmsError, Conflict, InvalidInput, NotFound } from "./cms-error.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import type { ActivateDefinitionSnapshotInput, ActivateDefinitionSnapshotResult } from "./cms-types.ts";
import {
  type Compatibility,
  type CompiledSnapshot,
  classifyCompatibility,
  compile,
} from "./content-definition.ts";
import { type Manifest, type Preparation, assertFresh, prepare } from "./definition-migration.ts";
import { validateDefinitionContracts } from "./operation.ts";
import {
  type CatalogState,
  type DefinitionSnapshotRecord,
  type EntryGeneration,
  type EntryRecord,
} from "./persistence.ts";
import { DateTime, Effect } from "effect";
import cmsSupport from "./cms-support.ts";

interface ActivationContext {
  readonly compatibility: Compatibility;
  readonly generation: EntryGeneration;
  readonly manifest: Manifest;
  readonly preparation: Preparation;
  readonly source: CompiledSnapshot;
  readonly target: CompiledSnapshot;
}

const {
  attempt,
  collectReferences,
  compatibleManifest,
  ensureReferences,
  ensureUniqueValues,
  liveRecords,
  snapshotDefinitionValidationMessage,
  sourceProperty,
  writeTokenProperty,
} = cmsSupport,
  applyMigrationRecords = (
    context: CmsServiceOperationContext,
    input: Pick<ActivationContext, "generation" | "preparation" | "target"> & {
      readonly records: Map<string, EntryRecord>;
    },
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* applyMigrationRecordsEffect() {
      for (const entry of input.preparation.entries) {
        const current = input.records.get(entry.id);
        if (current === undefined) {
          return yield* Conflict.make({
            message: "Migration Preparation no longer matches the Entry generation",
          });
        }
        if (current.writeToken === undefined) {
          input.records.set(entry.id, { ...current, entry });
        } else {
          const writeToken = yield* context.identifiers.generate("write-token");
          input.records.set(entry.id, { ...current, entry, ...writeTokenProperty(writeToken) });
        }
      }
      yield* validateMigratedRecords(context, input);
      return yield* Effect.void;
    }),
  buildActivatedCatalogReplacement = (input: {
    readonly activatedAt: string;
    readonly activation: ActivationContext;
    readonly input: ActivateDefinitionSnapshotInput;
    readonly state: CatalogState;
  }): CatalogState => {
    const nextRetiredDefinitionIds = input.input.snapshot.definitions.reduce(
        (retiredDefinitionIds, definition) => {
          retiredDefinitionIds.delete(definition.id);
          return retiredDefinitionIds;
        },
        new Set(input.state.retiredDefinitionIds),
      ),
      snapshotRecord: DefinitionSnapshotRecord = {
        activatedAt: input.activatedAt,
        compiled: input.activation.target,
        input: structuredClone(input.input.snapshot),
      };
    let { migrationManifests, migrationPreparations } = input.state;
    if (!migrationManifests.some((candidate) => candidate.id === input.activation.manifest.id)) {
      migrationManifests = [...migrationManifests, input.activation.manifest];
    }
    if (!migrationPreparations.some((candidate) => candidate.id === input.activation.preparation.id)) {
      migrationPreparations = [...migrationPreparations, input.activation.preparation];
    }
    return {
      ...input.state,
      active: snapshotRecord,
      events: [
        ...input.state.events,
        {
          eventType: "snapshotActivated",
          recordedAt: input.activatedAt,
          snapshotId: input.activation.target.snapshotId,
          ...sourceProperty(input.input.source),
        },
      ],
      migrationManifests,
      migrationPreparations,
      retiredDefinitionIds: nextRetiredDefinitionIds,
      snapshots: [...input.state.snapshots, snapshotRecord],
    };
  },
  commitDefinitionActivation = (
    context: CmsServiceOperationContext,
    input: {
      readonly activation: ActivationContext;
      readonly expectedCatalogVersion: number;
      readonly input: ActivateDefinitionSnapshotInput;
      readonly records: Map<string, EntryRecord>;
      readonly state: CatalogState;
    },
  ): Effect.Effect<ActivateDefinitionSnapshotResult, CmsError> =>
    Effect.gen(function* commitDefinitionActivationEffect() {
      const activatedAt = DateTime.formatIso(yield* DateTime.now),
        committedCatalog = yield* persistActivatedCatalog(context, {
          activatedAt,
          activation: input.activation,
          expectedCatalogVersion: input.expectedCatalogVersion,
          input: input.input,
          records: input.records,
          state: input.state,
        });
      for (const handler of input.input.migration?.handlers ?? []) {
        context.migrationHandlers.set(`${handler.identifier}@${handler.version}`, handler);
      }
      let migratedEntryCount = input.activation.preparation.entries.length;
      if (input.activation.compatibility === "compatible") {
        migratedEntryCount = 0;
      }
      return {
        catalogVersion: committedCatalog.version,
        migratedEntryCount,
        snapshot: input.activation.target,
      };
    }),
  compileActivationTarget = (
    context: CmsServiceOperationContext,
    snapshot: ActivateDefinitionSnapshotInput["snapshot"],
    state: CatalogState,
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    Effect.gen(function* compileActivationTargetEffect() {
      const definitionValidationMessage = snapshotDefinitionValidationMessage(state, snapshot),
        target: CompiledSnapshot = yield* attempt((): CompiledSnapshot =>
          compile(snapshot, context.compileOptions),
        );
      yield* attempt(() => {
        validateDefinitionContracts({ contracts: context.operationContracts, snapshot: target });
      });
      if (definitionValidationMessage !== undefined) {
        return yield* InvalidInput.make({ message: definitionValidationMessage });
      }
      return target;
    }),
  findStoredPreparation = (
    state: CatalogState,
    preparationId: string | undefined,
  ): Preparation | undefined => {
    if (preparationId === undefined) {
      return undefined;
    }
    return state.migrationPreparations.find((candidate) => candidate.id === preparationId);
  },
  persistActivatedCatalog = (
    context: CmsServiceOperationContext,
    input: {
      readonly activatedAt: string;
      readonly activation: ActivationContext;
      readonly expectedCatalogVersion: number;
      readonly input: ActivateDefinitionSnapshotInput;
      readonly records: Map<string, EntryRecord>;
      readonly state: CatalogState;
    },
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* persistActivatedCatalogEffect() {
      const replacement = buildActivatedCatalogReplacement({
        activatedAt: input.activatedAt,
        activation: input.activation,
        input: input.input,
        state: input.state,
      });
      if (input.activation.compatibility === "compatible") {
        return yield* context.catalog.replace(input.expectedCatalogVersion, replacement);
      }
      return (
        yield* context.catalog.commitCutover({
          catalogState: replacement,
          entryRecords: input.records,
          expectedCatalogVersion: input.expectedCatalogVersion,
          expectedEntryGeneration: input.activation.generation.generation,
        })
      ).catalog;
    }),
  prepareActivationRecords = (
    context: CmsServiceOperationContext,
    input: ActivateDefinitionSnapshotInput,
  ): Effect.Effect<
    {
      readonly activation: ActivationContext;
      readonly records: Map<string, EntryRecord>;
      readonly state: CatalogState;
    },
    CmsError
  > =>
    readValidatedCatalogState(context, input).pipe(
      Effect.flatMap((state) =>
        prepareDefinitionActivation(context, { input, state }).pipe(
          Effect.map((activation) => ({
            activation,
            records: new Map(activation.generation.records),
            state,
          })),
        ),
      ),
    ),
  prepareDefinitionActivation = (
    context: CmsServiceOperationContext,
    input: { readonly input: ActivateDefinitionSnapshotInput; readonly state: CatalogState },
  ): Effect.Effect<ActivationContext, CmsError> =>
    Effect.gen(function* prepareDefinitionActivationEffect() {
      const source: CompiledSnapshot = input.state.active.compiled,
        target = yield* compileActivationTarget(context, input.input.snapshot, input.state),
        compatibility = snapshotCompatibility(source, target),
        generation = yield* context.persistence.readGeneration,
        manifest: Manifest = yield* resolveMigrationManifest({
          compatibility,
          migrationManifest: input.input.migration?.manifest,
          source,
          target,
        }),
        preparation = yield* resolveActivationPreparation(context, {
          generation,
          input: input.input,
          manifest,
          source,
          state: input.state,
          target,
        });
      if (compatibility === "migrationRequired" && input.input.migration === undefined) {
        return yield* InvalidInput.make({
          message: "This Definition change requires an explicit Migration Manifest and Handler",
        });
      }
      yield* validateActivationPreparation(preparation, { generation, manifest, source, target });
      return { compatibility, generation, manifest, preparation, source, target };
    }),
  readValidatedCatalogState = (
    context: CmsServiceOperationContext,
    input: ActivateDefinitionSnapshotInput,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* readValidatedCatalogStateEffect() {
      const state = yield* context.catalog.read;
      yield* validateActivationCatalogState(state, input);
      return state;
    }),
  resolveActivationPreparation = (
    context: CmsServiceOperationContext,
    input: {
      readonly generation: EntryGeneration;
      readonly input: ActivateDefinitionSnapshotInput;
      readonly manifest: Manifest;
      readonly source: CompiledSnapshot;
      readonly state: CatalogState;
      readonly target: CompiledSnapshot;
    },
  ): Effect.Effect<Preparation, CmsError> =>
    Effect.gen(function* resolveActivationPreparationEffect() {
      const storedPreparation = findStoredPreparation(
          input.state,
          input.input.migration?.preparationId,
        ),
        preparation =
          storedPreparation ??
          (yield* attempt(() =>
            prepare({
              entries: liveRecords(input.generation).map((record) => record.entry),
              handlers: input.input.migration?.handlers ?? [...context.migrationHandlers.values()],
              manifest: input.manifest,
              source: input.source,
              sourceGeneration: input.generation.generation,
              target: input.target,
            }),
          ));
      if (input.input.migration?.preparationId !== undefined && storedPreparation === undefined) {
        return yield* NotFound.make({
          message: `Migration Preparation ${input.input.migration.preparationId} was not found`,
        });
      }
      return preparation;
    }),
  resolveMigrationManifest = (input: {
    readonly compatibility: Compatibility;
    readonly migrationManifest: Manifest | undefined;
    readonly source: CompiledSnapshot;
    readonly target: CompiledSnapshot;
  }): Effect.Effect<Manifest, CmsError> => {
    if (input.compatibility === "compatible") {
      return Effect.succeed(compatibleManifest(input.source, input.target));
    }
    if (input.migrationManifest === undefined) {
      return Effect.fail(
        InvalidInput.make({ message: "A migration manifest is required for this Definition change" }),
      );
    }
    return Effect.succeed(input.migrationManifest);
  },
  snapshotCompatibility = (
    source: CompiledSnapshot,
    target: CompiledSnapshot,
  ): Compatibility => {
    if (classifyCompatibility(source, target) === "compatible") {
      return "compatible";
    }
    return "migrationRequired";
  },
  validateActivationCatalogState = (
    state: CatalogState,
    input: ActivateDefinitionSnapshotInput,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* validateActivationCatalogStateEffect() {
      if (state.version !== input.expectedCatalogVersion) {
        return yield* Conflict.make({ message: "Definition Catalog version is stale" });
      }
      if (input.snapshot.definitionSpaceId !== state.active.compiled.definitionSpaceId) {
        return yield* InvalidInput.make({
          message: "A Definition Snapshot cannot cross Definition Spaces",
        });
      }
      if (
        state.snapshots.some(
          (snapshotRecord) => snapshotRecord.compiled.snapshotId === input.snapshot.snapshotId,
        )
      ) {
        return yield* Conflict.make({
          message: `Definition Snapshot ${input.snapshot.snapshotId} already exists`,
        });
      }
      return yield* Effect.void;
    }),
  validateActivationPreparation = (
    preparation: Preparation,
    input: Pick<ActivationContext, "generation" | "manifest" | "source" | "target">,
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* validateActivationPreparationEffect() {
      if (
        preparation.sourceSnapshotId !== input.source.snapshotId ||
        preparation.targetSnapshotId !== input.target.snapshotId ||
        preparation.manifest.id !== input.manifest.id
      ) {
        return yield* InvalidInput.make({
          message: "Migration Preparation does not match this Definition Cutover",
        });
      }
      yield* attempt(() => {
        assertFresh(preparation, input.generation.generation);
      });
      if (preparation.report.status !== "ready") {
        return yield* InvalidInput.make({
          issues: preparation.report.issues,
          message: "Definition Migration preparation failed",
        });
      }
      return yield* Effect.void;
    }),
  validateMigratedRecords = (
    context: CmsServiceOperationContext,
    input: Pick<ActivationContext, "generation" | "target"> & {
      readonly records: Map<string, EntryRecord>;
    },
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* validateMigratedRecordsEffect() {
      const preparedGeneration: EntryGeneration = {
        generation: input.generation.generation,
        records: input.records,
      };
      for (const record of liveRecords(preparedGeneration)) {
        const contentType = input.target.contentTypes.get(record.entry.contentTypeId);
        if (contentType === undefined) {
          return yield* InvalidInput.make({
            message: `Migration retained Entry ${record.entry.id} in a removed Content Type`,
          });
        }
        yield* attempt(() => {
          ensureUniqueValues({
            contentType,
            ignoredEntryId: record.entry.id,
            records: input.records.values(),
            values: record.entry.values,
          });
        });
        yield* ensureReferences(
          yield* attempt(() => collectReferences(contentType, record.entry.values)),
          preparedGeneration,
          context.assets,
        );
      }
      return yield* Effect.void;
    });

export default {
  applyMigrationRecords,
  commitDefinitionActivation,
  prepareActivationRecords,
};
