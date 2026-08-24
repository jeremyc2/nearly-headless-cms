import { Layer } from "effect";
import type { Management } from "../asset.ts";
import type { Service as AuthorizationService } from "../authorization.ts";
import type { Service as CmsService } from "../cms.ts";
import { makeLayer as makeCmsLayer } from "../cms.ts";
import type { CompileOptions, CompiledSnapshot } from "../content-definition.ts";
import type { Handler } from "../definition-migration.ts";
import type { Generator } from "../identifier.ts";
import type { CurrentIdentity } from "../identity.ts";
import type { DefinitionContract } from "../operation.ts";
import type { DefinitionCatalog, EntryPersistence } from "../persistence.ts";
import { layer as allowAllAuthorizationLayer } from "../adapters/allow-all-authorization.ts";
import { layer as anonymousIdentityLayer } from "../adapters/anonymous-identity.ts";
import { layer as identifierLayer } from "../adapters/crypto-identifier-generator.ts";
import { layer as memoryAssetLayer } from "../adapters/memory-asset-management.ts";
import { layer as memoryCatalogLayer } from "../adapters/memory-definition-catalog.ts";
import { layer as memoryEntryLayer } from "../adapters/memory-entry-persistence.ts";

/** Definition snapshot and registrations for a fully in-memory development CMS. */
export interface Options {
  readonly snapshot: CompiledSnapshot;
  readonly compileOptions?: CompileOptions;
  readonly migrationHandlers?: readonly Handler[];
  readonly operationContracts?: readonly DefinitionContract[];
}

/** Composes all development Adapters into one ready-to-use CMS Layer. */
export const layer = ({
  compileOptions,
  migrationHandlers,
  operationContracts,
  snapshot,
}: Options): Layer.Layer<CmsService> => {
  const assetLayer = memoryAssetLayer().pipe(Layer.provide(identifierLayer)),
    catalogLayer = memoryCatalogLayer({ snapshot }).pipe(Layer.provide(memoryEntryLayer)),
    dependencies: Layer.Layer<
      | AuthorizationService
      | CurrentIdentity
      | DefinitionCatalog
      | EntryPersistence
      | Management
      | Generator
    > = Layer.mergeAll(
      allowAllAuthorizationLayer,
      anonymousIdentityLayer,
      identifierLayer,
      catalogLayer,
      memoryEntryLayer,
      assetLayer,
    );
  return makeCmsLayer({
    ...compileOptions,
    ...(migrationHandlers === undefined ? {} : { migrationHandlers }),
    ...(operationContracts === undefined ? {} : { operationContracts }),
  }).pipe(Layer.provide(dependencies));
};
