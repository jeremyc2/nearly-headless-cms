import type { Cms, Operation } from "nearly-headless-cms";
import { Cms as CmsModule, type CmsError } from "nearly-headless-cms";
import { AllowAllAuthorization, AnonymousIdentity, CryptoIdentifierGenerator } from "nearly-headless-cms/adapters";
import { HttpTransport } from "nearly-headless-cms/http";
import type { Layer } from "effect";
import { Effect, Layer as LayerModule, ManagedRuntime, Option } from "effect";
import { groupBasedAuthorizationLayer } from "./auth/auth-authorization.ts";
import { requestScopedIdentityLayer } from "./auth/auth-request-identity.ts";
import { makeDeliveryOperations } from "./api/delivery/index.ts";
import { makeManagementOperations } from "./api/management/index.ts";
import { filesystemCommandReceiptStore } from "./api/shared/command-receipt-store.ts";
import { definitionSnapshot } from "./content/definitions.ts";
import { type SeedResult, seed } from "./content/seed.ts";
import { sqlCmsPersistenceLayer } from "./persistence/sql-persistence-layer.ts";

export interface ExampleBlogCmsSystem {
  readonly dispose: () => Promise<void>;
  readonly handler: HttpTransport.Handler;
  readonly seed?: SeedResult;
}

export interface ExampleBlogCmsSystemOptions {
  readonly seed?: boolean;
  readonly connectionString?: string;
  readonly assetBlobRoot?: string;
  /** Compatibility alias for copied integration tests that used filesystem roots. */
  readonly storageRoot?: string;
}

export interface ExampleBlogCmsComposition {
  readonly cmsLayer: Layer.Layer<Cms.Service, CmsError.InfrastructureFailure>;
  readonly transportOptions: HttpTransport.Options;
}

const makeCmsLayer = ({
  assetBlobRoot,
  connectionString,
  operationContracts,
  useOpenAuthorization,
}: {
  readonly assetBlobRoot: string;
  readonly connectionString: string;
  readonly operationContracts: readonly Operation.DefinitionContract[];
  readonly useOpenAuthorization: boolean;
}): Layer.Layer<Cms.Service, CmsError.InfrastructureFailure> => {
  const persistenceLayer = sqlCmsPersistenceLayer({
    assetBlobRoot,
    connectionString,
    definitionSnapshot,
  }).pipe(LayerModule.provide(CryptoIdentifierGenerator.layer)),
    dependencies = useOpenAuthorization
      ? LayerModule.mergeAll(
          AllowAllAuthorization.layer,
          AnonymousIdentity.layer,
          CryptoIdentifierGenerator.layer,
          persistenceLayer,
        )
      : LayerModule.mergeAll(
          groupBasedAuthorizationLayer,
          requestScopedIdentityLayer,
          CryptoIdentifierGenerator.layer,
          persistenceLayer,
        );

  return CmsModule.makeLayer({ operationContracts }).pipe(LayerModule.provide(dependencies));
};

const makeExampleBlogCmsCompositionInternal = (
  options: ExampleBlogCmsSystemOptions = {},
  useOpenAuthorization = false,
): ExampleBlogCmsComposition => {
  const storageRoot = options.storageRoot ?? ".data/example-blog-cms",
    commandReceiptStore = filesystemCommandReceiptStore(`${storageRoot}/command-receipts`),
    deliveryOperations = makeDeliveryOperations({ commandReceiptStore }),
    managementOperations = makeManagementOperations({ commandReceiptStore }),
    exampleCmsLayer = makeCmsLayer({
      assetBlobRoot: options.assetBlobRoot ?? `${storageRoot}/assets`,
      connectionString: options.connectionString ?? `file:${storageRoot}/cms.sqlite`,
      operationContracts: [...deliveryOperations, ...managementOperations],
      useOpenAuthorization,
    }),
    transportOptions: HttpTransport.Options = {
      cors: {
        headers: ["authorization", "content-type", "idempotency-key"],
        methods: ["GET", "POST", "HEAD", "OPTIONS"],
        origins: ["http://localhost:4322"],
      },
      deliveryOperations,
      managementOperations,
    };

  return {
    cmsLayer: exampleCmsLayer,
    transportOptions,
  };
};

/** Builds the reusable CMS layer and HTTP operation declarations for Example Blog CMS. */
export const makeExampleBlogCmsComposition = (
  options: ExampleBlogCmsSystemOptions = {},
): ExampleBlogCmsComposition => makeExampleBlogCmsCompositionInternal(options);

/** Builds the composition using optional environment overrides. */
export const makeSeededExampleBlogCmsCompositionFromEnvironment = (): ExampleBlogCmsComposition => {
  const connectionString = Bun.env["DATABASE_URL"],
    assetBlobRoot = Bun.env["EXAMPLE_BLOG_CMS_ASSET_ROOT"];
  return makeExampleBlogCmsCompositionInternal({
    assetBlobRoot,
    connectionString,
    seed: true,
  });
};

/** Starts the Example Blog CMS runtime and optionally seeds reference content. */
export const createExampleBlogCmsSystem = (
  options: ExampleBlogCmsSystemOptions = {},
): Promise<ExampleBlogCmsSystem> => {
  const composition = makeExampleBlogCmsCompositionInternal(options, true),
    runtime = ManagedRuntime.make(composition.cmsLayer);

  return runtime.runPromise(
    Effect.gen(function* createExampleBlogCmsSystemEffect() {
      const seedResult = yield* Effect.when(seed, Effect.succeed(options.seed === true)),
        systemHandler = yield* HttpTransport.makeHandler(composition.transportOptions),
        systemWithoutSeed: ExampleBlogCmsSystem = {
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

/** Compatibility aliases for copied integration tests. */
export type ExampleSystem = ExampleBlogCmsSystem;
export const createExampleSystem = createExampleBlogCmsSystem;
