import { DefinitionCatalog, EntryPersistence } from "./persistence.ts";
import { Effect, Layer, Semaphore } from "effect";
import { Management as AssetManagement } from "./asset.ts";
import { Service as AuthorizationService } from "./authorization.ts";
import { Generator } from "./identifier.ts";
import { CurrentIdentity } from "./identity.ts";
import type { CmsLayerOptions } from "./cms-types.ts";
import type { Handler } from "./definition-migration.ts";
import entryOperations from "./cms-service-entry-operations.ts";
import definitionOperations from "./cms-service-definition-operations.ts";
import entryHistoryOperations from "./cms-service-entry-history-operations.ts";
import definitionActivationOperations from "./cms-service-definition-activation-operations.ts";
import assetOperations from "./cms-service-asset-operations.ts";
import entryBatchOperations from "./cms-service-entry-batch-operations.ts";
import { createCmsServiceOperationContext } from "./cms-service-operation-context.ts";
import { Service } from "./cms-service.ts";

const assembleService = (
  context: ReturnType<typeof createCmsServiceOperationContext>,
  withOperationGate: <Success, Failure, Requirements>(
    operation: Effect.Effect<Success, Failure, Requirements>,
  ) => Effect.Effect<Success, Failure, Requirements>,
) => {
  const asset = assetOperations,
    definition = definitionOperations,
    definitionActivation = definitionActivationOperations,
    entries = entryOperations,
    entryBatch = entryBatchOperations,
    entryHistory = entryHistoryOperations;
  return Service.of({
    activateDefinitionSnapshot: (input) =>
      withOperationGate(definitionActivation.activateDefinitionSnapshot(context)(input)),
    activeDefinitionSnapshot: withOperationGate(definition.activeDefinitionSnapshot(context)),
    appendDefinitionRevision: (input) =>
      withOperationGate(definition.appendDefinitionRevision(context)(input)),
    appendMigrationManifest: (input) =>
      withOperationGate(definition.appendMigrationManifest(context)(input)),
    createEntry: (input) => withOperationGate(entries.createEntry(context)(input)),
    deleteAsset: (input) => withOperationGate(asset.deleteAsset(context)(input)),
    deleteEntry: (input) => withOperationGate(entries.deleteEntry(context)(input)),
    getAsset: (input) => withOperationGate(asset.getAsset(context)(input)),
    getCurrentEntryState: (input) =>
      withOperationGate(entryHistory.getCurrentEntryState(context)(input)),
    getEntry: (input) => withOperationGate(entries.getEntry(context)(input)),
    ingestAsset: (input) => withOperationGate(asset.ingestAsset(context)(input)),
    inspectEntryRevision: (input) =>
      withOperationGate(entryHistory.inspectEntryRevision(context)(input)),
    listAssets: withOperationGate(asset.listAssets(context)),
    listEntryRevisions: (input) =>
      withOperationGate(entryHistory.listEntryRevisions(context)(input)),
    mutateEntriesAtomically: (input) =>
      withOperationGate(entryBatch.mutateEntriesAtomically(context)(input)),
    permanentlyPurgeEntry: (input) =>
      withOperationGate(entryHistory.permanentlyPurgeEntry(context)(input)),
    prepareDefinitionMigration: (input) =>
      withOperationGate(definition.prepareDefinitionMigration(context)(input)),
    queryEntries: (input) => withOperationGate(entries.queryEntries(context)(input)),
    readAsset: (input) => withOperationGate(asset.readAsset(context)(input)),
    readConsistentSnapshot: withOperationGate(definition.readConsistentSnapshot(context)),
    readDefinitionCatalog: withOperationGate(definition.readDefinitionCatalog(context)),
    restoreEntryRevision: (input) =>
      withOperationGate(entryHistory.restoreEntryRevision(context)(input)),
    retireDefinition: (input) => withOperationGate(definition.retireDefinition(context)(input)),
    updateEntry: (input) => withOperationGate(entries.updateEntry(context)(input)),
  });
},
  createCmsService = (options: CmsLayerOptions) =>
    Effect.gen(function* createCmsServiceEffect() {
      const assets = yield* AssetManagement,
        authorization = yield* AuthorizationService,
        catalog = yield* DefinitionCatalog,
        currentIdentity = yield* CurrentIdentity,
        identifiers = yield* Generator,
        migrationHandlers = new Map<string, Handler>(
          (options.migrationHandlers ?? []).map((handler) => [
            `${handler.identifier}@${handler.version}`,
            handler,
          ]),
        ),
        operationGate = yield* Semaphore.make(1),
        persistence = yield* EntryPersistence,
        withOperationGate = <Success, Failure, Requirements>(
          operation: Effect.Effect<Success, Failure, Requirements>,
        ) => operationGate.withPermit(operation);
      return assembleService(
        createCmsServiceOperationContext({
          assets,
          authorization,
          catalog,
          compileOptions: {
            customFieldKinds: options.customFieldKinds,
            richTextExtensions: options.richTextExtensions,
          },
          currentIdentity,
          identifiers,
          migrationHandlers,
          operationContracts: options.operationContracts ?? [],
          persistence,
        }),
        withOperationGate,
      );
    }),
  layer = makeLayerImpl(),
  makeLayer = makeLayerImpl,
  makeLayerImpl = (options: CmsLayerOptions = {}): Layer.Layer<
    Service,
    never,
    | AuthorizationService
    | CurrentIdentity
    | DefinitionCatalog
    | EntryPersistence
    | AssetManagement
    | Generator
  > => Layer.effect(Service, createCmsService(options));

export default { layer, makeLayer };
