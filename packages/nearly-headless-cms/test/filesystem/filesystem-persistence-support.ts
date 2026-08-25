import { Effect, Layer } from "effect";
import { BunFilesystemPersistence } from "../../src/bun/filesystem/index.ts";
import { CryptoIdentifierGenerator } from "../../src/adapters/index.ts";
import { Persistence } from "../../src/index.ts";

export const atomicFilesystemLayer = (root: string) =>
    BunFilesystemPersistence.layer({ acknowledgement: "atomic", root }).pipe(
      Layer.provide(CryptoIdentifierGenerator.layer),
    ),
  boundedFilesystemLayer = (root: string) =>
    BunFilesystemPersistence.layer({
      acknowledgement: "atomic",
      maximumAssetByteLength: fifthByte,
      root,
    }).pipe(Layer.provide(CryptoIdentifierGenerator.layer)),
  cancellationPollAttempts = 50,
  cancellationPollDelayMilliseconds = 10,
  durableFilesystemLayer = (root: string) =>
    BunFilesystemPersistence.layer({ acknowledgement: "durable", root }).pipe(
      Layer.provide(CryptoIdentifierGenerator.layer),
    ),
  fifthByte = 5,
  firstByte = 1,
  fourthByte = 4,
  initialGeneration = 0,
  killSignal = 9,
  readEntryGeneration = Persistence.EntryPersistence.pipe(
    Effect.flatMap((entries) => entries.readGeneration()),
  ),
  secondByte = 2,
  seventhByte = 7,
  sixthByte = 6,
  thirdByte = 3;
