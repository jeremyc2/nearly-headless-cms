import { Layer, ManagedRuntime } from "effect";
import { Cms } from "nearly-headless-cms";
import {
  AllowAllAuthorization,
  AnonymousIdentity,
  CryptoIdentifierGenerator,
  MemoryDefinitionCatalog,
} from "nearly-headless-cms/adapters";
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem";
import { HttpTransport } from "nearly-headless-cms/http";
import { makeDeliveryOperations } from "./delivery.ts";
import { makeManagementOperations } from "./management.ts";
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

export const createExampleSystem = async (
  options: ExampleSystemOptions = {},
): Promise<ExampleSystem> => {
  const identifierLayer = CryptoIdentifierGenerator.layer,
    filesystemLayer = BunFilesystemPersistence.layer({
      acknowledgement: "durable",
      root: options.storageRoot ?? ".data/example-cms",
    }).pipe(Layer.provide(identifierLayer)),
    dependencies = Layer.mergeAll(
      AllowAllAuthorization.layer,
      AnonymousIdentity.layer,
      identifierLayer,
      MemoryDefinitionCatalog.layer({ snapshot: definitionSnapshot }),
      filesystemLayer,
    ),
    runtime = ManagedRuntime.make(Cms.layer.pipe(Layer.provide(dependencies))),
    seedResult = options.seed ? await runtime.runPromise(seed) : undefined,
    handler = await runtime.runPromise(
      HttpTransport.makeHandler({
        cors: {
          headers: ["content-type", "idempotency-key"],
          methods: ["GET", "POST", "HEAD", "OPTIONS"],
          origins: ["http://localhost:4321"],
        },
        deliveryOperations: makeDeliveryOperations(),
        managementOperations: makeManagementOperations(),
      }),
    );
  return {
    handler,
    ...(seedResult === undefined ? {} : { seed: seedResult }),
    dispose: async () => runtime.dispose(),
  };
};
