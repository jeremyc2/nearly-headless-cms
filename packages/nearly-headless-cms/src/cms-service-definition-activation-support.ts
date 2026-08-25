import {
  type ActivateDefinitionSnapshotInput,
  type ActivateDefinitionSnapshotResult,
  type CatalogState,
  type CmsError,
  type CmsServiceOperationContext,
  type CompiledSnapshot,
  DateTime,
  type DefinitionSnapshotRecord,
  Effect,
  type EntryRecord,
  InvalidInput,
  type Manifest,
  cmsSupport,
  compileSnapshot,
  validateDefinitionContracts,
} from "./cms-service-definition-activation-imports.ts";
import type { ActivationContext } from "./cms-service-definition-activation-types.ts";
import definitionActivationMigrationSupport from "./cms-service-definition-activation-migration-support.ts";
import definitionActivationValidationSupport from "./cms-service-definition-activation-validation-support.ts";

interface ActivationTarget {
  readonly compatibility: ActivationContext["compatibility"];
  readonly source: CompiledSnapshot;
  readonly target: CompiledSnapshot;
}

const { attempt, snapshotDefinitionValidationMessage, sourceProperty } = cmsSupport,
  { resolveActivationPreparation, resolveMigrationManifest, snapshotCompatibility } =
    definitionActivationMigrationSupport,
  { validateActivationCatalogState, validateActivationPreparation } =
    definitionActivationValidationSupport,
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
    if (
      !migrationPreparations.some((candidate) => candidate.id === input.activation.preparation.id)
    ) {
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
    context: Readonly<CmsServiceOperationContext>,
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
    context: Readonly<CmsServiceOperationContext>,
    snapshot: ActivateDefinitionSnapshotInput["snapshot"],
    state: CatalogState,
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    Effect.gen(function* compileActivationTargetEffect() {
      const definitionValidationMessage = snapshotDefinitionValidationMessage(state, snapshot),
        target = yield* attempt(
          (): CompiledSnapshot => compileSnapshot(snapshot, context.compileOptions),
        );
      yield* attempt(() => {
        validateDefinitionContracts({ contracts: context.operationContracts, snapshot: target });
      });
      if (definitionValidationMessage !== undefined) {
        return yield* InvalidInput.make({ message: definitionValidationMessage });
      }
      return target;
    }),
  persistActivatedCatalog = (
    context: Readonly<CmsServiceOperationContext>,
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
      return (yield* context.catalog.commitCutover({
        catalogState: replacement,
        entryRecords: input.records,
        expectedCatalogVersion: input.expectedCatalogVersion,
        expectedEntryGeneration: input.activation.generation.generation,
      })).catalog;
    }),
  prepareActivationRecords = (
    context: Readonly<CmsServiceOperationContext>,
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
    context: Readonly<CmsServiceOperationContext>,
    input: { readonly input: ActivateDefinitionSnapshotInput; readonly state: CatalogState },
  ): Effect.Effect<ActivationContext, CmsError> =>
    Effect.gen(function* prepareDefinitionActivationEffect() {
      const activationTarget = yield* resolveActivationTarget(context, input),
        generation = yield* context.persistence.readGeneration(),
        manifest: Manifest = yield* resolveMigrationManifest({
          compatibility: activationTarget.compatibility,
          migrationManifest: input.input.migration?.manifest,
          source: activationTarget.source,
          target: activationTarget.target,
        }),
        preparation = yield* resolveActivationPreparation(context, {
          generation,
          input: input.input,
          manifest,
          source: activationTarget.source,
          state: input.state,
          target: activationTarget.target,
        });
      if (
        activationTarget.compatibility === "migrationRequired" &&
        input.input.migration === undefined
      ) {
        return yield* InvalidInput.make({
          message: "This Definition change requires an explicit Migration Manifest and Handler",
        });
      }
      yield* validateActivationPreparation(preparation, {
        generation,
        manifest,
        source: activationTarget.source,
        target: activationTarget.target,
      });
      return {
        compatibility: activationTarget.compatibility,
        generation,
        manifest,
        preparation,
        source: activationTarget.source,
        target: activationTarget.target,
      };
    }),
  readValidatedCatalogState = (
    context: Readonly<CmsServiceOperationContext>,
    input: ActivateDefinitionSnapshotInput,
  ): Effect.Effect<CatalogState, CmsError> =>
    Effect.gen(function* readValidatedCatalogStateEffect() {
      const state = yield* context.catalog.read();
      yield* validateActivationCatalogState(state, input);
      return state;
    }),
  resolveActivationTarget = (
    context: Readonly<CmsServiceOperationContext>,
    input: { readonly input: ActivateDefinitionSnapshotInput; readonly state: CatalogState },
  ): Effect.Effect<ActivationTarget, CmsError> =>
    Effect.gen(function* resolveActivationTargetEffect() {
      const source: CompiledSnapshot = input.state.active.compiled,
        target = yield* compileActivationTarget(context, input.input.snapshot, input.state);
      return {
        compatibility: snapshotCompatibility(source, target),
        source,
        target,
      };
    });

export default {
  applyMigrationRecords: definitionActivationMigrationSupport.applyMigrationRecords,
  commitDefinitionActivation,
  prepareActivationRecords,
};
