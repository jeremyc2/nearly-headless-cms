import { Cms, type Identifier, type Operation } from "../../src/index.ts";
import {
  CryptoIdentifierGenerator,
  MemoryAssetManagement,
  MemoryDefinitionCatalog,
  MemoryEntryPersistence,
} from "../../src/adapters/index.ts";
import { CurrentIdentity, anonymous } from "../../src/identity.ts";
import type { DefinitionCatalog, EntryPersistence } from "../../src/persistence.ts";
import { Effect, Layer } from "effect";
import type { Management as AssetManagement } from "../../src/asset.ts";
import { Service as AuthorizationService } from "../../src/authorization.ts";
import { authorizationContractSnapshot } from "./authorization-expansion-fixture.ts";

const makeLayer = <Actions extends Operation.Action[]>(
  actions: Actions,
  deniedAction: Readonly<{ current?: Actions[number] }>,
) => {
  const anonymousIdentity = CurrentIdentity.of({
      current: (_void: void) => Effect.succeed(anonymous),
    }),
    assetsLayer = MemoryAssetManagement.layer().pipe(
      Layer.provide(CryptoIdentifierGenerator.layer),
    ),
    authorizationLayer = Layer.succeed(
      AuthorizationService,
      AuthorizationService.of({
        authorize: (_identity, action) =>
          Effect.sync(() => {
            actions.push(action);
            return action !== deniedAction.current;
          }),
      }),
    ),
    catalogLayer = MemoryDefinitionCatalog.layer({
      snapshot: authorizationContractSnapshot,
    }).pipe(Layer.provide(MemoryEntryPersistence.layer)),
    dependencies: Layer.Layer<
      | AuthorizationService
      | CurrentIdentity
      | DefinitionCatalog
      | EntryPersistence
      | AssetManagement
      | Identifier.Generator
    > = Layer.mergeAll(
      assetsLayer,
      authorizationLayer,
      catalogLayer,
      CryptoIdentifierGenerator.layer,
      MemoryEntryPersistence.layer,
      Layer.succeed(CurrentIdentity, anonymousIdentity),
    );
  return Cms.layer.pipe(Layer.provide(dependencies));
},

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- test helper is not a pipeable Effect API.
 runAuthorizationExpansion = <Value, Failure>(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Effect programs are executed by runPromise without mutation.
  effect: Readonly<Effect.Effect<Value, Failure, Cms.Service>>,
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- action log must remain mutable for assertions.
  actions: Operation.Action[],
  deniedAction: Readonly<{ current?: Operation.Action }>,
): Promise<Value> => {
  const layer = makeLayer(actions, deniedAction),
    // This test helper is the application entry point for each isolated test run.
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer per run.
    providedEffect = effect.pipe(Effect.provide(layer));
  return Effect.runPromise(providedEffect);
};

export { runAuthorizationExpansion };
