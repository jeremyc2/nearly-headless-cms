import {
  Asset,
  BunFilesystemPersistence,
  type CatalogState,
  type CompiledSnapshot,
  CryptoIdentifierGenerator,
  DateTime,
  Deferred,
  Effect,
  type EntryGeneration,
  Exit,
  Fiber,
  Layer,
  Persistence,
  type StoredAsset,
  Stream,
  compileSnapshot,
} from "./filesystem-persistence-scenarios-imports.ts";
import {
  atomicFilesystemLayer,
  boundedFilesystemLayer,
  cancellationPollAttempts,
  cancellationPollDelayMilliseconds,
  fifthByte,
  firstByte,
  fourthByte,
  secondByte,
  seventhByte,
  sixthByte,
  thirdByte,
} from "./filesystem-persistence-support.ts";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-154] The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
import { mkdtemp, readdir } from "node:fs/promises";
import { expect } from "bun:test";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-149] Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
import { join } from "node:path";
import { tmpdir } from "node:os";

const commitDurableCatalogCutoverEffect = (targetSnapshot: CompiledSnapshot) =>
    Effect.gen(function* commitDurableCatalogCutoverStep() {
      const activatedAt = DateTime.formatIso(yield* DateTime.now),
        catalog = yield* Persistence.DefinitionCatalog,
        catalogState = yield* catalog.read(),
        entries = yield* Persistence.EntryPersistence,
        generationWithEntry = yield* entries.commitGeneration(
          (yield* entries.readGeneration()).generation,
          new Map([
            [
              "note-1",
              {
                entry: {
                  contentTypeId: "note",
                  id: "note-1",
                  values: { slug: "durable", title: "Durable" },
                },
                revisions: [],
              },
            ],
          ]),
        ),
        snapshotRecord = {
          activatedAt,
          compiled: targetSnapshot,
          input: targetSnapshot.input,
        };
      expect(catalog.commitCutover).toBeDefined();
      yield* catalog.commitCutover({
        catalogState: {
          ...catalogState,
          active: snapshotRecord,
          snapshots: [...catalogState.snapshots, snapshotRecord],
        },
        entryRecords: generationWithEntry.records,
        expectedCatalogVersion: catalogState.version,
        expectedEntryGeneration: generationWithEntry.generation,
      });
    }),
  durableCatalogInitialSnapshot: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "durable-catalog",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        id: "note",
        kind: "contentType",
        name: "Note",
      },
    ],
    snapshotId: "initial",
  }),
  durableCatalogLayer = (root: string) =>
    BunFilesystemPersistence.cmsLayer({
      acknowledgement: "durable",
      definitionSnapshot: durableCatalogInitialSnapshot,
      root,
    }).pipe(Layer.provide(CryptoIdentifierGenerator.layer)),
  durableCatalogTargetSnapshot: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "durable-catalog",
    definitions: [
      {
        fields: [
          { key: "title", kind: { kind: "text" }, label: "Title", required: true },
          { key: "slug", kind: { kind: "text" }, label: "Slug", required: true },
        ],
        id: "note",
        kind: "contentType",
        name: "Note",
      },
    ],
    snapshotId: "with-slug",
  }),
  expectRecoveredAsset = <
    Recovered extends {
      readonly asset: Omit<StoredAsset, "content">;
      readonly bytes: Uint8Array;
      readonly generation: EntryGeneration;
      readonly repeatedReadExit: Exit.Exit<Uint8Array, unknown>;
    },
  >(
    recovered: Readonly<Recovered>,
  ): void => {
    expect(recovered.generation.records.get("entry-1")?.entry.values["title"]).toBe("Persisted");
    expect(new TextDecoder().decode(recovered.bytes)).toBe("asset bytes");
    expect(Exit.isFailure(recovered.repeatedReadExit)).toBeTrue();
  },
  expectRecoveredCatalog = <
    Recovered extends { readonly catalog: CatalogState; readonly entries: EntryGeneration },
  >(
    recovered: Readonly<Recovered>,
  ): void => {
    expect(recovered.catalog.active.compiled.snapshotId).toBe("with-slug");
    expect(recovered.entries.records.get("note-1")?.entry.values["slug"]).toBe("durable");
  },
  ingestAssetEffect = Effect.gen(function* ingestAssetEffect() {
    const assets = yield* Asset.Management,
      entries = yield* Persistence.EntryPersistence,
      generation = yield* entries.readGeneration();
    yield* entries.commitGeneration(
      generation.generation,
      new Map([
        [
          "entry-1",
          {
            entry: { contentTypeId: "post", id: "entry-1", values: { title: "Persisted" } },
            revisions: [],
          },
        ],
      ]),
    );
    return yield* assets.ingest({
      content: new TextEncoder().encode("asset bytes"),
      filename: "pixel.txt",
      mediaType: "text/plain",
    });
  }),
  observeStreamingStageEffect = (root: string) =>
    Effect.gen(function* observeStreamingStageStep() {
      const assets = yield* Asset.Management,
        chunkDeferred = yield* Deferred.make<boolean>(),
        content = Stream.make(new Uint8Array([firstByte, secondByte, thirdByte])).pipe(
          Stream.tap(() => Deferred.succeed(chunkDeferred, true)),
          Stream.concat(Stream.never),
        ),
        ingestion = yield* assets
          .ingest({
            content,
            filename: "cancelled.bin",
            mediaType: "application/octet-stream",
          })
          .pipe(Effect.forkChild);
      yield* Deferred.await(chunkDeferred);
      return yield* Effect.promise(() => waitForStage(root)).pipe(
        Effect.flatMap((stageExistedWhilePending) =>
          Effect.gen(function* finalizeCancellationObservation() {
            yield* Fiber.interrupt(ingestion);
            const stagingAfterCancellation = yield* Effect.promise(() => waitForNoStage(root));
            return { stageExistedWhilePending, stagingAfterCancellation };
          }),
        ),
      );
    }),
  readRecoveredAssetEffect = (assetId: string) =>
    Effect.gen(function* readRecoveredAssetStep() {
      const assets = yield* Asset.Management,
        { content, ...asset } = yield* assets.read(assetId),
        bytes = yield* Stream.mkUint8Array(content),
        entries = yield* Persistence.EntryPersistence,
        repeatedReadExit = yield* Effect.exit(Stream.mkUint8Array(content));
      return {
        asset,
        bytes,
        generation: yield* entries.readGeneration(),
        repeatedReadExit,
      };
    }),
  recoverDurableCatalogCutoverEffect = Effect.gen(function* recoverDurableCatalogCutoverEffect() {
    const catalog = yield* Persistence.DefinitionCatalog,
      entries = yield* Persistence.EntryPersistence;
    return { catalog: yield* catalog.read(), entries: yield* entries.readGeneration() };
  }),
  runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-244] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-237] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> =>
    Effect.runPromise(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
      effect.pipe(Effect.provide(layer)),
    ),
  verifyBoundedAssetStream = (): Promise<void> => {
    let pulledChunks = 0;
    const boundedStreamPrefix = join(tmpdir(), "nearly-headless-cms-bounded-stream-"),
      contentChunks = [
        new Uint8Array([firstByte, secondByte, thirdByte]),
        new Uint8Array([fourthByte, fifthByte, sixthByte]),
        new Uint8Array([seventhByte]),
      ],
      ingestExit = Effect.gen(function* ingestExit() {
        const assets = yield* Asset.Management,
          content = Stream.fromIterable(contentChunks).pipe(
            Stream.tap(() =>
              Effect.sync(() => {
                pulledChunks += 1;
              }),
            ),
          );
        return yield* Effect.exit(
          assets.ingest({
            content,
            filename: "too-large.bin",
            mediaType: "application/octet-stream",
          }),
        );
      });
    return mkdtemp(boundedStreamPrefix)
      .then((root) => runWithLayer(boundedFilesystemLayer(root), ingestExit))
      .then((result) => {
        expect(Exit.isFailure(result)).toBeTrue();
        expect(pulledChunks).toBe(secondByte);
      });
  },
  verifyDurableCatalogCutover = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-cutover-")).then((root) => {
      const layer = durableCatalogLayer(root);
      return runWithLayer(layer, commitDurableCatalogCutoverEffect(durableCatalogTargetSnapshot))
        .then(() => runWithLayer(layer, recoverDurableCatalogCutoverEffect))
        .then(expectRecoveredCatalog);
    }),
  verifyEntryAndAssetRecovery = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-")).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return runWithLayer(filesystemLayer, ingestAssetEffect)
        .then((asset) => runWithLayer(filesystemLayer, readRecoveredAssetEffect(asset.id)))
        .then(expectRecoveredAsset);
    }),
  verifyStreamingStageCancellation = (): Promise<void> =>
    mkdtemp(join(tmpdir(), "nearly-headless-cms-stream-stage-")).then((root) =>
      runWithLayer(atomicFilesystemLayer(root), observeStreamingStageEffect(root)).then(
        (observed) => {
          expect(observed.stageExistedWhilePending).toBeTrue();
          expect(observed.stagingAfterCancellation).toEqual([]);
        },
      ),
    ),
  waitForNoStage = (root: string, attempt = 0): Promise<string[]> =>
    readdir(join(root, "blobs")).then((blobNames) => {
      const staging = blobNames.filter((name) => name.startsWith(".nhcms-stage-"));
      if (staging.length === 0 || attempt >= cancellationPollAttempts - firstByte) {
        return staging;
      }
      return Bun.sleep(cancellationPollDelayMilliseconds).then(() =>
        waitForNoStage(root, attempt + firstByte),
      );
    }),
  waitForStage = (root: string, attempt = 0): Promise<boolean> =>
    readdir(join(root, "blobs")).then((blobNames) => {
      if (blobNames.some((name) => name.startsWith(".nhcms-stage-"))) {
        return true;
      }
      if (attempt >= cancellationPollAttempts - firstByte) {
        return false;
      }
      return Bun.sleep(cancellationPollDelayMilliseconds).then(() =>
        waitForStage(root, attempt + firstByte),
      );
    });

export {
  verifyBoundedAssetStream,
  verifyDurableCatalogCutover,
  verifyEntryAndAssetRecovery,
  verifyStreamingStageCancellation,
};

export {
  verifyWriterEnforcement,
  verifyWriterLockRecovery,
} from "./filesystem-persistence-writer-scenarios.ts";

export { verifyCorruptAssetClassification } from "./filesystem-persistence-corruption-scenarios.ts";
