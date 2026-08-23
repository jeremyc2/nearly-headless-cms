import { Layer } from "effect";
import type { Management } from "../Asset.ts";
import type { Service as AuthorizationService } from "../Authorization.ts";
import type { Service as CmsService } from "../Cms.ts";
import { makeLayer as makeCmsLayer } from "../Cms.ts";
import type { CompiledSnapshot, CompileOptions } from "../ContentDefinition.ts";
import type { Handler } from "../DefinitionMigration.ts";
import type { Generator } from "../Identifier.ts";
import type { CurrentIdentity } from "../Identity.ts";
import type { DefinitionCatalog, EntryPersistence } from "../Persistence.ts";
import { layer as allowAllAuthorizationLayer } from "../adapters/AllowAllAuthorization.ts";
import { layer as anonymousIdentityLayer } from "../adapters/AnonymousIdentity.ts";
import { layer as identifierLayer } from "../adapters/CryptoIdentifierGenerator.ts";
import { layer as memoryAssetLayer } from "../adapters/MemoryAssetManagement.ts";
import { layer as memoryCatalogLayer } from "../adapters/MemoryDefinitionCatalog.ts";
import { layer as memoryEntryLayer } from "../adapters/MemoryEntryPersistence.ts";

export interface Options {
  readonly snapshot: CompiledSnapshot;
  readonly compileOptions?: CompileOptions;
  readonly migrationHandlers?: readonly Handler[];
}

export const layer = ({
  compileOptions,
  migrationHandlers,
  snapshot,
}: Options): Layer.Layer<CmsService> => {
  const assetLayer = memoryAssetLayer().pipe(Layer.provide(identifierLayer)),
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
      memoryCatalogLayer({ snapshot }),
      memoryEntryLayer,
      assetLayer,
    );
  return makeCmsLayer({
    ...compileOptions,
    ...(migrationHandlers === undefined ? {} : { migrationHandlers }),
  }).pipe(Layer.provide(dependencies));
};
