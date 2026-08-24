import type { Management as AssetManagement } from "./asset.ts";
import type { Service as AuthorizationService } from "./authorization.ts";
import { type CmsError, Forbidden } from "./cms-error.ts";
import { type CompileOptions, type CompiledSnapshot } from "./content-definition.ts";
import type { Handler } from "./definition-migration.ts";
import type { Generator } from "./identifier.ts";
import type { CurrentIdentity } from "./identity.ts";
import {
  type Action,
  type DefinitionContract,
  type Resource,
  validateDefinitionContracts,
} from "./operation.ts";
import type { DefinitionCatalog, EntryPersistence } from "./persistence.ts";
import { Effect } from "effect";
import cmsSupport from "./cms-support.ts";

const { attempt } = cmsSupport;

export interface CmsServiceOperationContext {
  readonly assets: typeof AssetManagement.Service;
  readonly authorization: typeof AuthorizationService.Service;
  readonly authorize: (action: Action, resource: Resource) => Effect.Effect<void, CmsError>;
  readonly catalog: typeof DefinitionCatalog.Service;
  readonly compileOptions: CompileOptions;
  readonly currentDefinitionSnapshot: Effect.Effect<CompiledSnapshot, CmsError>;
  readonly currentIdentity: typeof CurrentIdentity.Service;
  readonly identifiers: typeof Generator.Service;
  readonly migrationHandlers: Map<string, Handler>;
  readonly operationContracts: readonly DefinitionContract[];
  readonly persistence: typeof EntryPersistence.Service;
}

const createAuthorize = (
    authorization: typeof AuthorizationService.Service,
    currentIdentity: typeof CurrentIdentity.Service,
  ): CmsServiceOperationContext["authorize"] =>
    (action, resource) =>
      Effect.gen(function* authorizeAction() {
        const allowed = yield* authorization.authorize(yield* currentIdentity.current, action, resource);
        if (!allowed) {
          return yield* Forbidden.make({ message: "The operation is forbidden" });
        }
        return yield* Effect.void;
      }),
  createCurrentDefinitionSnapshot = (
    catalog: typeof DefinitionCatalog.Service,
    operationContracts: readonly DefinitionContract[],
  ): Effect.Effect<CompiledSnapshot, CmsError> =>
    catalog.read.pipe(
      Effect.flatMap((state) =>
        attempt(() => {
          validateDefinitionContracts({
            contracts: operationContracts,
            snapshot: state.active.compiled,
          });
        }).pipe(Effect.as(state.active.compiled)),
      ),
    );

export const createCmsServiceOperationContext = (input: {
  readonly assets: typeof AssetManagement.Service;
  readonly authorization: typeof AuthorizationService.Service;
  readonly catalog: typeof DefinitionCatalog.Service;
  readonly compileOptions: CompileOptions;
  readonly currentIdentity: typeof CurrentIdentity.Service;
  readonly identifiers: typeof Generator.Service;
  readonly migrationHandlers: Map<string, Handler>;
  readonly operationContracts: readonly DefinitionContract[];
  readonly persistence: typeof EntryPersistence.Service;
}): CmsServiceOperationContext => ({
  assets: input.assets,
  authorization: input.authorization,
  authorize: createAuthorize(input.authorization, input.currentIdentity),
  catalog: input.catalog,
  compileOptions: input.compileOptions,
  currentDefinitionSnapshot: createCurrentDefinitionSnapshot(
    input.catalog,
    input.operationContracts,
  ),
  currentIdentity: input.currentIdentity,
  identifiers: input.identifiers,
  migrationHandlers: input.migrationHandlers,
  operationContracts: input.operationContracts,
  persistence: input.persistence,
});
