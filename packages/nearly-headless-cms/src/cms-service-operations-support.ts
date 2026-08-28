import {
  type CmsLayerOptions,
  type Handler,
  cmsServiceOperationsModules,
} from "./cms-service-operations-modules.ts";
import { DefinitionCatalog, EntryPersistence, EntryReader, EntryWriter } from "./persistence.ts";
import { Effect, Layer, Semaphore } from "effect";
import {
  Catalog as AssetCatalog,
  Management as AssetManagement,
  Transfer as AssetTransfer,
} from "./asset.ts";
import { Service as AuthorizationService } from "./authorization.ts";
import { CurrentIdentity } from "./identity.ts";
import { Generator } from "./identifier.ts";
import { Service } from "./cms-service.ts";
import { createCmsServiceOperationContext } from "./cms-service-operation-context.ts";
import {
  persistenceFromCapabilities,
  readerFromPersistence,
} from "./adapters/entry-persistence-capabilities.ts";
import {
  catalogFromManagement,
  managementFromCapabilities,
  transferFromManagement,
} from "./adapters/asset-management-capabilities.ts";

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
      prepareAssetDownload: (input) => withOperationGate(asset.prepareAssetDownload(context)(input)),
      prepareAssetUpload: (input) => withOperationGate(asset.prepareAssetUpload(context)(input)),
      prepareDefinitionMigration: (input) => withOperationGate(definition.prepareDefinitionMigration(context)(input)),
      queryEntries: (input) => withOperationGate(entries.queryEntries(context)(input)),
      readAsset: (input) => withOperationGate(asset.readAsset(context)(input)),
      readConsistentSnapshot: (_void: void) => withOperationGate(definition.readConsistentSnapshot(context)),
      readDefinitionCatalog: (_void: void) => withOperationGate(definition.readDefinitionCatalog(context)),
      restoreEntryRevision: (input) => withOperationGate(entryHistory.restoreEntryRevision(context)(input)),
      retireDefinition: (input) => withOperationGate(definition.retireDefinition(context)(input)),
      updateEntry: (input) => withOperationGate(entries.updateEntry(context)(input)),
    });
  },
  createCmsServiceWithPersistence = <Options extends CmsLayerOptions>(input: {
    readonly assetCatalog: typeof AssetCatalog.Service;
    readonly assetTransfer: typeof AssetTransfer.Service;
    readonly assets: typeof AssetManagement.Service;
    readonly entryReader: typeof EntryReader.Service;
    readonly options: Readonly<Options>;
    readonly persistence: typeof EntryPersistence.Service;
  }) =>
    Effect.gen(function* createCmsServiceWithPersistenceEffect() {
      const authorization = yield* AuthorizationService,
        catalog = yield* DefinitionCatalog,
        currentIdentity = yield* CurrentIdentity,
        identifiers = yield* Generator,
        migrationHandlers = new Map<string, Handler>(
          (input.options.migrationHandlers ?? []).map((handler) => [
            `${handler.identifier}@${handler.version}`,
            handler,
          ]),
        ),
        operationGate = yield* Semaphore.make(1),
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
          assetCatalog: input.assetCatalog,
          assetTransfer: input.assetTransfer,
          assets: input.assets,
          authorization,
          catalog,
          compileOptions: {
            customFieldKinds: input.options.customFieldKinds,
            richTextExtensions: input.options.richTextExtensions,
          },
          currentIdentity,
          entryReader: input.entryReader,
          identifiers,
          migrationHandlers,
          operationContracts: input.options.operationContracts ?? [],
          persistence: input.persistence,
        }),
        withOperationGate,
      );
    }),
  createCmsService = <Options extends CmsLayerOptions>(options: Readonly<Options>) =>
    Effect.gen(function* createCmsServiceEffect() {
      const assets = yield* AssetManagement,
        persistence = yield* EntryPersistence;
      return yield* createCmsServiceWithPersistence({
        assetCatalog: catalogFromManagement(assets),
        assetTransfer: transferFromManagement(assets),
        assets,
        entryReader: readerFromPersistence(persistence),
        options,
        persistence,
      });
    }),
  createCapabilityCmsService = <Options extends CmsLayerOptions>(options: Readonly<Options>) =>
    Effect.gen(function* createCapabilityCmsServiceEffect() {
      const assetCatalog = yield* AssetCatalog,
        assetTransfer = yield* AssetTransfer,
        entryReader = yield* EntryReader,
        entryWriter = yield* EntryWriter;
      return yield* createCmsServiceWithPersistence({
        assetCatalog,
        assetTransfer,
        assets: managementFromCapabilities(assetTransfer)(assetCatalog),
        entryReader,
        options,
        persistence: persistenceFromCapabilities(entryWriter)(entryReader),
      });
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
  > => Layer.effect(Service, createCmsService(options)),
  makeCapabilityLayerImpl = (
    options: CmsLayerOptions = {},
  ): Layer.Layer<
    Service,
    never,
    | AuthorizationService
    | CurrentIdentity
    | DefinitionCatalog
    | EntryReader
    | EntryWriter
    | AssetCatalog
    | AssetTransfer
    | Generator
  > => Layer.effect(Service, createCapabilityCmsService(options));

export default {
  capabilityLayer: makeCapabilityLayerImpl(),
  layer: makeLayerImpl(),
  makeCapabilityLayer: makeCapabilityLayerImpl,
  makeLayer: makeLayerImpl,
};
