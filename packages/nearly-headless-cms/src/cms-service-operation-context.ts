import {
  type Action,
  type DefinitionContract,
  type Resource,
  validateDefinitionContracts,
} from "./operation.ts";
import { type CmsError, Forbidden } from "./cms-error.ts";
import { type CompileOptions, type CompiledSnapshot } from "./content-definition.ts";
import type { DefinitionCatalog, EntryPersistence, EntryReader } from "./persistence.ts";
import type {
  Catalog as AssetCatalog,
  Management as AssetManagement,
  Transfer as AssetTransfer,
} from "./asset.ts";
import type { Service as AuthorizationService } from "./authorization.ts";
import type { CurrentIdentity } from "./identity.ts";
import { Effect } from "effect";
import type { Generator } from "./identifier.ts";
import type { Handler } from "./definition-migration.ts";
import cmsSupport from "./cms-support.ts";

const { attempt } = cmsSupport,
  createAuthorize =
    (
      authorization: typeof AuthorizationService.Service,
      currentIdentity: typeof CurrentIdentity.Service,
    ): CmsServiceOperationContext["authorize"] =>
    (action, resource) =>
      Effect.gen(function* authorizeAction() {
        const allowed = yield* authorization.authorize(
          yield* currentIdentity.current(),
          action,
          resource,
        );
        if (!allowed) {
          return yield* Forbidden.make({ message: "The operation is forbidden" });
        }
        return yield* Effect.void;
      }),
  createCmsServiceOperationContext = (input: {
    readonly assetCatalog: typeof AssetCatalog.Service;
    readonly assetTransfer: typeof AssetTransfer.Service;
    readonly assets: typeof AssetManagement.Service;
    readonly authorization: typeof AuthorizationService.Service;
    readonly catalog: typeof DefinitionCatalog.Service;
    readonly compileOptions: Readonly<CompileOptions>;
    readonly currentIdentity: typeof CurrentIdentity.Service;
    readonly entryReader: typeof EntryReader.Service;
    readonly identifiers: typeof Generator.Service;
    readonly migrationHandlers: Map<string, Handler>;
    readonly operationContracts: readonly DefinitionContract[];
    readonly persistence: typeof EntryPersistence.Service;
  }): CmsServiceOperationContext => ({
    assetCatalog: input.assetCatalog,
    assetTransfer: input.assetTransfer,
    assets: input.assets,
    authorization: input.authorization,
    authorize: createAuthorize(input.authorization, input.currentIdentity),
    catalog: input.catalog,
    compileOptions: input.compileOptions,
    currentIdentity: input.currentIdentity,
    entryReader: input.entryReader,
    identifiers: input.identifiers,
    migrationHandlers: input.migrationHandlers,
    operationContracts: input.operationContracts,
    persistence: input.persistence,
    readCurrentDefinitionSnapshot: (_void: void) =>
      createCurrentDefinitionSnapshot(input.catalog, input.operationContracts),
  }),
  createCurrentDefinitionSnapshot = (
    catalog: typeof DefinitionCatalog.Service,
    operationContracts: readonly DefinitionContract[],
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    catalog.read().pipe(
      Effect.flatMap((state) =>
        attempt(() => {
          validateDefinitionContracts({
            contracts: operationContracts,
            snapshot: state.active.compiled,
          });
        }).pipe(Effect.as(state.active.compiled)),
      ),
    );

export interface CmsServiceOperationContext {
  readonly assetCatalog: typeof AssetCatalog.Service;
  readonly assetTransfer: typeof AssetTransfer.Service;
  readonly assets: typeof AssetManagement.Service;
  readonly authorization: typeof AuthorizationService.Service;
  readonly authorize: (
    action: Readonly<Action>,
    resource: Readonly<Resource>,
  ) => Effect.Effect<void, CmsError>;
  readonly catalog: typeof DefinitionCatalog.Service;
  readonly compileOptions: Readonly<CompileOptions>;
  readonly readCurrentDefinitionSnapshot: (
    _void: void,
  ) => Effect.Effect<CompiledSnapshot, CmsError>;
  readonly currentIdentity: typeof CurrentIdentity.Service;
  readonly entryReader: typeof EntryReader.Service;
  readonly identifiers: typeof Generator.Service;
  readonly migrationHandlers: Map<string, Handler>;
  readonly operationContracts: readonly DefinitionContract[];
  readonly persistence: typeof EntryPersistence.Service;
}

export { createCmsServiceOperationContext };
