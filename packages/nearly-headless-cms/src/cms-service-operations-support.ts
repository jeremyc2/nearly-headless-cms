import {
  type CmsLayerOptions,
  type Handler,
  cmsServiceOperationsModules,
} from "./cms-service-operations-modules.ts";
import { DefinitionCatalog, EntryPersistence } from "./persistence.ts";
import { Effect, Layer, Semaphore } from "effect";
import { Management as AssetManagement } from "./asset.ts";
import { Service as AuthorizationService } from "./authorization.ts";
import { CurrentIdentity } from "./identity.ts";
import { Generator } from "./identifier.ts";
import { Service } from "./cms-service.ts";
import { createCmsServiceOperationContext } from "./cms-service-operation-context.ts";

const assembleService = <Context extends ReturnType<typeof createCmsServiceOperationContext>>(
    context: Readonly<Context>,
    withOperationGate: <
      Success,
      Failure,
      Requirements,
      Operation extends Effect.Effect<Success, Failure, Requirements>,
    >(
      operation: Readonly<Operation>,
    ) => Effect.Effect<Success, Failure, Requirements>,
  ) => {
    const { asset, definition, definitionActivation, entries, entryBatch, entryHistory } =
      cmsServiceOperationsModules;
    return Service.of({
      activateDefinitionSnapshot: (input) =>
        withOperationGate(definitionActivation.activateDefinitionSnapshot(context)(input)),
      activeDefinitionSnapshot: (_void: void) =>
        withOperationGate(definition.activeDefinitionSnapshot(context)),
      appendDefinitionRevision: (input) =>
        withOperationGate(definition.appendDefinitionRevision(context)(input)),
      appendMigrationManifest: (input) =>
        withOperationGate(definition.appendMigrationManifest(context)(input)),
      createEntry: (input) => withOperationGate(entries.createEntry(context)(input)),
      deleteAsset: (input) => withOperationGate(asset.deleteAsset(context)(input)),
      deleteEntry: (input) => withOperationGate(entries.deleteEntry(context)(input)),
      getAsset: (input) => withOperationGate(asset.getAsset(context)(input)),
      getCurrentEntryState: (input) => withOperationGate(entryHistory.getCurrentEntryState(context)(input)),
      getEntry: (input) => withOperationGate(entries.getEntry(context)(input)),
      ingestAsset: (input) => withOperationGate(asset.ingestAsset(context)(input)),
      inspectEntryRevision: (input) => withOperationGate(entryHistory.inspectEntryRevision(context)(input)),
      listAssets: (_void: void) => withOperationGate(asset.listAssets(context)),
      listEntryRevisions: (input) => withOperationGate(entryHistory.listEntryRevisions(context)(input)),
      mutateEntriesAtomically: (input) => withOperationGate(entryBatch.mutateEntriesAtomically(context)(input)),
      permanentlyPurgeEntry: (input) => withOperationGate(entryHistory.permanentlyPurgeEntry(context)(input)),
      prepareDefinitionMigration: (input) => withOperationGate(definition.prepareDefinitionMigration(context)(input)),
      queryEntries: (input) => withOperationGate(entries.queryEntries(context)(input)),
      readAsset: (input) => withOperationGate(asset.readAsset(context)(input)),
      readConsistentSnapshot: (_void: void) =>
        withOperationGate(definition.readConsistentSnapshot(context)),
      readDefinitionCatalog: (_void: void) =>
        withOperationGate(definition.readDefinitionCatalog(context)),
      restoreEntryRevision: (input) => withOperationGate(entryHistory.restoreEntryRevision(context)(input)),
      retireDefinition: (input) => withOperationGate(definition.retireDefinition(context)(input)),
      updateEntry: (input) => withOperationGate(entries.updateEntry(context)(input)),
    });
  },
  createCmsService = <Options extends CmsLayerOptions>(options: Readonly<Options>) =>
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
        withOperationGate = <
          Success,
          Failure,
          Requirements,
          Operation extends Effect.Effect<Success, Failure, Requirements>,
        >(
          operation: Readonly<Operation>,
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
  makeLayerImpl = (
    options: CmsLayerOptions = {},
  ): Layer.Layer<
    Service,
    never,
    | AuthorizationService
    | CurrentIdentity
    | DefinitionCatalog
    | EntryPersistence
    | AssetManagement
    | Generator
  > => Layer.effect(Service, createCmsService(options));

export default { layer: makeLayerImpl(), makeLayer: makeLayerImpl };
