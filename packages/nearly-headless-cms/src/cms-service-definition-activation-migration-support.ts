import {
  type ActivateDefinitionSnapshotInput,
  type CatalogState,
  type CmsError,
  type CmsServiceOperationContext,
  type Compatibility,
  type CompiledSnapshot,
  Conflict,
  Effect,
  type EntryGeneration,
  type EntryRecord,
  InvalidInput,
  type Manifest,
  NotFound,
  type Preparation,
  classifyCompatibility,
  cmsSupport,
  prepare,
} from "./cms-service-definition-activation-imports.ts";
import type { ActivationContext } from "./cms-service-definition-activation-types.ts";

const {
    attempt,
    collectReferences,
    compatibleManifest,
    ensureReferences,
    ensureUniqueValues,
    liveRecords,
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
  findStoredPreparation = (
    state: CatalogState,
    preparationId: string | undefined,
  ): Preparation | undefined => {
    if (preparationId === undefined) {
      return undefined;
    }
    return state.migrationPreparations.find((candidate) => candidate.id === preparationId);
  },
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
      );
      if (input.input.migration?.preparationId !== undefined && storedPreparation === undefined) {
        return yield* NotFound.make({
          message: `Migration Preparation ${input.input.migration.preparationId} was not found`,
        });
      }
      return (
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
        ))
      );
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
  resolveActivationPreparation,
  resolveMigrationManifest,
  snapshotCompatibility,
};
