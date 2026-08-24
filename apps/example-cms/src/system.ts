import { Layer, ManagedRuntime } from "effect";
import { Cms } from "nearly-headless-cms";
import {
  AllowAllAuthorization,
  AnonymousIdentity,
  CryptoIdentifierGenerator,
} from "nearly-headless-cms/adapters";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import { HttpTransport } from "nearly-headless-cms/http";
import { makeDeliveryOperations } from "./delivery.ts";
import { makeManagementOperations } from "./management.ts";
import { filesystemCommandReceiptStore } from "./command-receipt-store.ts";
import { definitionSnapshot } from "./domain/definitions.ts";
import { type SeedResult, seed } from "./domain/seed.ts";

export interface ExampleSystem {
  readonly handler: HttpTransport.Handler;
  readonly seed?: SeedResult;
  readonly dispose: () => Promise<void>;
}

export interface ExampleSystemOptions {
  readonly seed?: boolean;
  readonly storageRoot?: string;
}

/** Builds the reusable CMS Layer and HTTP operation declarations for this application. */
export const makeExampleComposition = (options: ExampleSystemOptions = {}) => {
  const storageRoot = options.storageRoot ?? ".data/example-cms",
    commandReceiptStore = filesystemCommandReceiptStore(`${storageRoot}/command-receipts`),
    deliveryOperations = makeDeliveryOperations({ commandReceiptStore }),
    managementOperations = makeManagementOperations({ commandReceiptStore }),
    identifierLayer = CryptoIdentifierGenerator.layer,
    filesystemLayer = BunFilesystemPersistence.cmsLayer({
      acknowledgement: "durable",
      definitionSnapshot,
      root: `${storageRoot}/persistence`,
    }).pipe(Layer.provide(identifierLayer)),
    dependencies = Layer.mergeAll(
      AllowAllAuthorization.layer,
      AnonymousIdentity.layer,
      identifierLayer,
      filesystemLayer,
    ),
    cmsLayer = Cms.makeLayer({
      operationContracts: [...deliveryOperations, ...managementOperations],
    }).pipe(Layer.provide(dependencies)),
    transportOptions: HttpTransport.Options = {
      cors: {
        headers: ["content-type", "idempotency-key"],
        methods: ["GET", "POST", "HEAD", "OPTIONS"],
        origins: ["http://localhost:4321"],
      },
      deliveryOperations,
      managementOperations,
    };
  return { cmsLayer, transportOptions };
};

export const createExampleSystem = async (
  options: ExampleSystemOptions = {},
): Promise<ExampleSystem> => {
  const composition = makeExampleComposition(options),
    runtime = ManagedRuntime.make(composition.cmsLayer),
    seedResult = options.seed ? await runtime.runPromise(seed) : undefined,
    handler = await runtime.runPromise(HttpTransport.makeHandler(composition.transportOptions));
  return {
    handler,
    ...(seedResult === undefined ? {} : { seed: seedResult }),
    dispose: async () => runtime.dispose(),
  };
};
