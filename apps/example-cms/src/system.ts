import type { Cms} from "nearly-headless-cms";
import { type CmsError } from "nearly-headless-cms";
import { HttpTransport } from "nearly-headless-cms/http";
import type { Layer} from "effect";
import { Effect, ManagedRuntime, Option } from "effect";
import { makeDeliveryOperations } from "./api/delivery/index.ts";
import { makeManagementOperations } from "./api/management/index.ts";
import { filesystemCommandReceiptStore } from "./api/shared/command-receipt-store.ts";
import { type SeedResult, seed } from "./content/seed.ts";
import { layer as cmsLayer } from "./layers/cms.ts";

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
  const commandReceiptStore = filesystemCommandReceiptStore(
      `${options.storageRoot ?? ".data/example-cms"}/command-receipts`,
    ),
    deliveryOperations = makeDeliveryOperations({ commandReceiptStore }),
    managementOperations = makeManagementOperations({ commandReceiptStore }),
    exampleCmsLayer = cmsLayer({
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
