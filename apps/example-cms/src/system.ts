import {
  AllowAllAuthorization,
  AnonymousIdentity,
  CryptoIdentifierGenerator,
} from "nearly-headless-cms/adapters";
import { Cms, type CmsError } from "nearly-headless-cms";
import { Effect, Layer, ManagedRuntime, Option } from "effect";
import { type SeedResult, seed } from "./domain/seed.ts";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import { HttpTransport } from "nearly-headless-cms/http";
import { definitionSnapshot } from "./domain/definitions.ts";
import { filesystemCommandReceiptStore } from "./command-receipt-store.ts";
import { makeDeliveryOperations } from "./delivery.ts";
import { makeManagementOperations } from "./management.ts";

export interface ExampleSystem {
  readonly dispose: () => Promise<void>;
  readonly handler: HttpTransport.Handler;
  readonly seed?: SeedResult;
}

export interface ExampleSystemOptions {
  readonly seed?: boolean;
  readonly storageRoot?: string;
}

export interface ExampleComposition {
  readonly cmsLayer: Layer.Layer<Cms.Service, CmsError.InfrastructureFailure>;
  readonly transportOptions: HttpTransport.Options;
}

const makeExampleCompositionInternal = (options: ExampleSystemOptions = {}): ExampleComposition => {
    const storageRoot = options.storageRoot ?? ".data/example-cms",
      storageRootBaseIdentifierLayer = CryptoIdentifierGenerator.layer,
      storageRootCommandReceiptStore = filesystemCommandReceiptStore(
        `${storageRoot}/command-receipts`,
      ),
      storageRootDeliveryOperations = makeDeliveryOperations({
        commandReceiptStore: storageRootCommandReceiptStore,
      }),
      storageRootFilesystemLayer = BunFilesystemPersistence.cmsLayer({
        acknowledgement: "durable",
        definitionSnapshot,
        root: `${storageRoot}/persistence`,
      }).pipe(Layer.provide(storageRootBaseIdentifierLayer)),
      storageRootManagementOperations = makeManagementOperations({
        commandReceiptStore: storageRootCommandReceiptStore,
      }),
      storageRootMergedDependencies = Layer.mergeAll(
        AllowAllAuthorization.layer,
        AnonymousIdentity.layer,
        storageRootBaseIdentifierLayer,
        storageRootFilesystemLayer,
      ),
      storageRootServiceLayer = Cms.makeLayer({
        operationContracts: [...storageRootDeliveryOperations, ...storageRootManagementOperations],
      }).pipe(Layer.provide(storageRootMergedDependencies)),
      storageRootTransportOptions: HttpTransport.Options = {
        cors: {
          headers: ["content-type", "idempotency-key"],
          methods: ["GET", "POST", "HEAD", "OPTIONS"],
          origins: ["http://localhost:4321"],
        },
        deliveryOperations: storageRootDeliveryOperations,
        managementOperations: storageRootManagementOperations,
      };
    return {
      cmsLayer: storageRootServiceLayer,
      transportOptions: storageRootTransportOptions,
    };
  },
  makeSeededExampleCompositionFromEnvironment = (): ExampleComposition => {
    const storageRoot = Bun.env["EXAMPLE_CMS_STORAGE_ROOT"];
    if (storageRoot === undefined) {
      return makeExampleCompositionInternal({ seed: true });
    }
    return makeExampleCompositionInternal({ seed: true, storageRoot });
  },
  zCreateExampleSystem = (options: ExampleSystemOptions = {}): Promise<ExampleSystem> => {
    const composition = makeExampleCompositionInternal(options),
      runtime = ManagedRuntime.make(composition.cmsLayer);
    return runtime.runPromise(
      Effect.gen(function* createExampleSystemEffect() {
        const seedResult = yield* Effect.when(seed, Effect.succeed(options.seed === true)),
          systemHandler = yield* HttpTransport.makeHandler(composition.transportOptions),
          systemWithoutSeed: ExampleSystem = {
            dispose: () => runtime.dispose(),
            handler: systemHandler,
          };
        if (Option.isNone(seedResult)) {
          return systemWithoutSeed;
        }
        return { ...systemWithoutSeed, seed: seedResult.value };
      }),
    );
  };

/** Builds the reusable CMS Layer and HTTP operation declarations for this application. */
export {
  zCreateExampleSystem as createExampleSystem,
  makeExampleCompositionInternal as makeExampleComposition,
  makeSeededExampleCompositionFromEnvironment,
};
