import type { Cms, Operation } from "nearly-headless-cms";
import { Cms as CmsModule, type CmsError } from "nearly-headless-cms";
import { AllowAllAuthorization, AnonymousIdentity } from "nearly-headless-cms/adapters";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import { HttpTransport } from "nearly-headless-cms/http";
import { Filesystem } from "nearly-headless-cms/layers";
import type { Layer } from "effect";
import { Effect, Layer as LayerModule, ManagedRuntime, Option } from "effect";
import { makeDeliveryOperations } from "./api/delivery/index.ts";
import { makeManagementOperations } from "./api/management/index.ts";
import { filesystemCommandReceiptStore } from "./api/shared/command-receipt-store.ts";
import { definitionSnapshot } from "./content/definitions.ts";
import { type SeedResult, seed } from "./content/seed.ts";
import { forStorageRoot } from "./identifiers.ts";

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

const defaultStorageDirectory = ".data/example-cms";

const makeCmsLayer = ({
  operationContracts,
  storageRoot,
}: {
  readonly operationContracts: readonly Operation.DefinitionContract[];
  readonly storageRoot: string | undefined;
}): Layer.Layer<Cms.Service, CmsError.InfrastructureFailure> => {
  const storageDirectory = storageRoot ?? defaultStorageDirectory,
    persistenceRoot = `${storageDirectory}/persistence`;

  if (storageRoot === undefined) {
    return Filesystem.cms({
      definitionSnapshot,
      operationContracts,
      root: persistenceRoot,
    });
  }

  const persistence = BunFilesystemPersistence.cmsLayer({
      acknowledgement: "durable",
      definitionSnapshot,
      root: persistenceRoot,
    }).pipe(LayerModule.provide(forStorageRoot(storageRoot))),
    dependencies = LayerModule.mergeAll(
      AllowAllAuthorization.layer,
      AnonymousIdentity.layer,
      forStorageRoot(storageRoot),
      persistence,
    );

  return CmsModule.makeLayer({ operationContracts }).pipe(LayerModule.provide(dependencies));
};

const makeExampleCompositionInternal = (options: ExampleSystemOptions = {}): ExampleComposition => {
  const commandReceiptStore = filesystemCommandReceiptStore(
      `${options.storageRoot ?? defaultStorageDirectory}/command-receipts`,
    ),
    deliveryOperations = makeDeliveryOperations({ commandReceiptStore }),
    managementOperations = makeManagementOperations({ commandReceiptStore }),
    exampleCmsLayer = makeCmsLayer({
      operationContracts: [...deliveryOperations, ...managementOperations],
      storageRoot: options.storageRoot,
    }),
    transportOptions: HttpTransport.Options = {
      cors: {
        headers: ["content-type", "idempotency-key"],
        methods: ["GET", "POST", "HEAD", "OPTIONS"],
        origins: ["http://localhost:4321"],
      },
      deliveryOperations,
      managementOperations,
    };

  return {
    cmsLayer: exampleCmsLayer,
    transportOptions,
  };
};

/** Builds the reusable CMS layer and HTTP operation declarations for this application. */
export const makeExampleComposition = makeExampleCompositionInternal;

/** Builds the example composition using optional environment overrides. */
export const makeSeededExampleCompositionFromEnvironment = (): ExampleComposition => {
  const storageRoot = Bun.env["EXAMPLE_CMS_STORAGE_ROOT"];
  if (storageRoot === undefined) {
    return makeExampleCompositionInternal({ seed: true });
  }
  return makeExampleCompositionInternal({ seed: true, storageRoot });
};

/** Starts the example CMS runtime and optionally seeds reference content. */
export const createExampleSystem = (options: ExampleSystemOptions = {}): Promise<ExampleSystem> => {
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
