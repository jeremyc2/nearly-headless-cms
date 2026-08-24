import { describe, expect, test } from "bun:test";
// The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
// oxlint-disable-next-line effecttsgo/node-builtin-import
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
// Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
// oxlint-disable-next-line effecttsgo/node-builtin-import
import { join } from "node:path";
import { pathToFileURL } from "node:url";
import { DateTime, Deferred, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { Asset, ContentDefinition, Persistence } from "../../src/index.ts";
import { CryptoIdentifierGenerator } from "../../src/adapters/index.ts";
import { BunFilesystemPersistence } from "../../src/bun/filesystem/index.ts";

const cancellationPollAttempts = 50,
  cancellationPollDelayMilliseconds = 10,
  fifthByte = 5,
  firstByte = 1,
  fourthByte = 4,
  initialGeneration = 0,
  killSignal = 9,
  secondByte = 2,
  seventhByte = 7,
  sixthByte = 6,
  thirdByte = 3,

 waitForStage = (root: string, attempt = 0): Promise<boolean> =>
  readdir(join(root, "blobs")).then((blobNames) => {
    if (blobNames.some((name) => name.startsWith(".nhcms-stage-"))) {return true;}
    if (attempt >= cancellationPollAttempts - firstByte) {return false;}
    return Bun.sleep(cancellationPollDelayMilliseconds).then(() => waitForStage(root, attempt + firstByte));
  }),

 waitForNoStage = (root: string, attempt = 0): Promise<string[]> =>
  readdir(join(root, "blobs")).then((blobNames) => {
    const staging = blobNames.filter((name) => name.startsWith(".nhcms-stage-"));
    if (staging.length === 0 || attempt >= cancellationPollAttempts - firstByte) {return staging;}
    return Bun.sleep(cancellationPollDelayMilliseconds).then(() => waitForNoStage(root, attempt + firstByte));
  });

describe("BunFilesystemPersistence", () => {
  // Bun's test runner requires async callbacks for assertions over filesystem promises.
  // oxlint-disable-next-line effecttsgo/async-function -- Bun test callback intentionally awaits native filesystem APIs.
  test("durably commits the Definition Catalog and Entry generation in one cutover", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-cutover-")),
      initialSnapshot = ContentDefinition.compile({
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
      targetSnapshot = ContentDefinition.compile({
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
      makeLayer = () =>
        BunFilesystemPersistence.cmsLayer({
          acknowledgement: "durable",
          definitionSnapshot: initialSnapshot,
          root,
        }).pipe(Layer.provide(CryptoIdentifierGenerator.layer));

    await Effect.runPromise(
      Effect.gen(function* commitCutover() {
        const entries = yield* Persistence.EntryPersistence,
          catalog = yield* Persistence.DefinitionCatalog,
          sourceGeneration = yield* entries.readGeneration,
          generationWithEntry = yield* entries.commitGeneration(
            sourceGeneration.generation,
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
          catalogState = yield* catalog.read,
          activatedAt = DateTime.formatIso(yield* DateTime.now),
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
      }).pipe(
        // This test invocation is the application entry point and owns the isolated CMS layer.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
        Effect.provide(makeLayer()),
      ),
    );

    const recovered = await Effect.runPromise(
      Effect.gen(function* recoverCutover() {
        const entries = yield* Persistence.EntryPersistence,
          catalog = yield* Persistence.DefinitionCatalog;
        return { catalog: yield* catalog.read, entries: yield* entries.readGeneration };
      }).pipe(
        // This test invocation is the application entry point and owns the isolated CMS layer.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
        Effect.provide(makeLayer()),
      ),
    );
    expect(recovered.catalog.active.compiled.snapshotId).toBe("with-slug");
    expect(recovered.entries.records.get("note-1")?.entry.values["slug"]).toBe("durable");
  });

  // Bun's test runner requires async callbacks for assertions over filesystem promises.
  // oxlint-disable-next-line effecttsgo/async-function -- Bun test callback intentionally awaits native filesystem APIs.
  test("recovers committed Entry generations and digest-verified Assets after restart", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-")),
      filesystemLayer = BunFilesystemPersistence.layer({ acknowledgement: "atomic", root }).pipe(
        Layer.provide(CryptoIdentifierGenerator.layer),
      ),
      assetId = await Effect.runPromise(
        Effect.gen(function* assetId() {
          const entries = yield* Persistence.EntryPersistence,
            assets = yield* Asset.Management,
            generation = yield* entries.readGeneration;
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
          const asset = yield* assets.ingest({
            content: new TextEncoder().encode("asset bytes"),
            filename: "pixel.txt",
            mediaType: "text/plain",
          });
          return asset.id;
        }).pipe(
          // This test invocation is the application entry point and owns the isolated filesystem layer.
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(filesystemLayer),
        ),
      ),
      recovered = await Effect.runPromise(
        Effect.gen(function* recovered() {
          const entries = yield* Persistence.EntryPersistence,
            assets = yield* Asset.Management;
          return {
            asset: yield* assets.read(assetId),
            generation: yield* entries.readGeneration,
          };
        }).pipe(
          // This test invocation is the application entry point and owns the isolated filesystem layer.
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(
            BunFilesystemPersistence.layer({ acknowledgement: "atomic", root }).pipe(
              Layer.provide(CryptoIdentifierGenerator.layer),
            ),
          ),
        ),
      );

    expect(recovered.generation.records.get("entry-1")?.entry.values["title"]).toBe("Persisted");
    expect(new TextDecoder().decode(recovered.asset.bytes)).toBe("asset bytes");
  });

  // Bun's test runner requires async callbacks for assertions over filesystem promises.
  // oxlint-disable-next-line effecttsgo/async-function -- Bun test callback intentionally awaits native filesystem APIs.
  test("interrupts an oversized Asset stream at the configured bound", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-bounded-stream-")),
      filesystemLayer = BunFilesystemPersistence.layer({
        acknowledgement: "atomic",
        maximumAssetByteLength: fifthByte,
        root,
      }).pipe(Layer.provide(CryptoIdentifierGenerator.layer));
    let pulledChunks = 0;
    const content = Stream.fromIterable([
        new Uint8Array([firstByte, secondByte, thirdByte]),
        new Uint8Array([fourthByte, fifthByte, sixthByte]),
        new Uint8Array([seventhByte]),
      ]).pipe(
        Stream.tap(() =>
          Effect.sync(() => {
            pulledChunks += 1;
          }),
        ),
      ),
      result = await Effect.runPromise(
        Effect.gen(function* result() {
          const assets = yield* Asset.Management;
          return yield* Effect.exit(
            assets.ingest({
              content,
              filename: "too-large.bin",
              mediaType: "application/octet-stream",
            }),
          );
        }).pipe(
          // This test invocation is the application entry point and owns the isolated filesystem layer.
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(filesystemLayer),
        ),
      );
    expect(Exit.isFailure(result)).toBeTrue();
    expect(pulledChunks).toBe(secondByte);
  });

  // Bun's test runner requires async callbacks for assertions over filesystem promises.
  // oxlint-disable-next-line effecttsgo/async-function -- Bun test callback intentionally awaits native filesystem APIs.
  test("stages Asset chunks before the source completes and removes the stage on cancellation", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-stream-stage-")),
      filesystemLayer = BunFilesystemPersistence.layer({ acknowledgement: "atomic", root }).pipe(
        Layer.provide(CryptoIdentifierGenerator.layer),
      ),
      observed = await Effect.runPromise(
        Effect.gen(function* observeStreamingStage() {
          const assets = yield* Asset.Management,
            firstChunkPulled = yield* Deferred.make<boolean>(),
            content = Stream.make(new Uint8Array([firstByte, secondByte, thirdByte])).pipe(
              Stream.tap(() => Deferred.succeed(firstChunkPulled, true)),
              Stream.concat(Stream.never),
            ),
            ingestion = yield* assets
              .ingest({
                content,
                filename: "cancelled.bin",
                mediaType: "application/octet-stream",
              })
              .pipe(Effect.forkChild);
          yield* Deferred.await(firstChunkPulled);
          const stageExistedWhilePending = yield* Effect.promise(() => waitForStage(root));
          yield* Fiber.interrupt(ingestion);
          const stagingAfterCancellation = yield* Effect.promise(() => waitForNoStage(root));
          return { stageExistedWhilePending, stagingAfterCancellation };
        }).pipe(
          // This test invocation is the application entry point and owns the isolated filesystem layer.
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(filesystemLayer),
        ),
      );

    expect(observed.stageExistedWhilePending).toBeTrue();
    expect(observed.stagingAfterCancellation).toEqual([]);
  });

  // Bun's test runner requires async callbacks for assertions over filesystem promises.
  // oxlint-disable-next-line effecttsgo/async-function -- Bun test callback intentionally awaits native filesystem APIs.
  test("enforces one writer and only cleans the exact abandoned-staging convention", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-writer-")),
      makeFilesystemLayer = () =>
        BunFilesystemPersistence.layer({ acknowledgement: "durable", root }).pipe(
          Layer.provide(CryptoIdentifierGenerator.layer),
        ),
      competingWriter = await Effect.runPromise(
        Effect.scoped(
          Effect.gen(function* competingWriter() {
            yield* Layer.build(makeFilesystemLayer());
            return yield* Effect.exit(Layer.build(makeFilesystemLayer()));
          }),
        ),
      );
    expect(Exit.isFailure(competingWriter)).toBeTrue();

    await Bun.write(join(root, ".nhcms-stage-abandoned"), "incomplete");
    await Bun.write(join(root, "blobs", ".nhcms-stage-abandoned"), "incomplete");
    await Effect.runPromise(
      Persistence.EntryPersistence.pipe(
        Effect.flatMap((entries) => entries.readGeneration),
        // This test invocation is the application entry point and owns the isolated filesystem layer.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
        Effect.provide(makeFilesystemLayer()),
      ),
    );
    expect(await Bun.file(join(root, ".nhcms-stage-abandoned")).exists()).toBeFalse();
    expect(await Bun.file(join(root, "blobs", ".nhcms-stage-abandoned")).exists()).toBeFalse();

    const evidencePath = join(
      root,
      ".nhcms-stage-evidence.preserved".replace(".nhcms-stage-", ".nhcms-staging-"),
    );
    await Bun.write(evidencePath, "do not remove");
    const unexpectedRoot = await Effect.runPromise(
      Effect.exit(
        Persistence.EntryPersistence.pipe(
          Effect.flatMap((entries) => entries.readGeneration),
          // This test invocation is the application entry point and owns the isolated filesystem layer.
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(makeFilesystemLayer()),
        ),
      ),
    );
    expect(Exit.isFailure(unexpectedRoot)).toBeTrue();
    expect(await Bun.file(evidencePath).exists()).toBeTrue();
    expect(await Bun.file(join(root, "writer.lock")).exists()).toBeFalse();
  });

  // Bun's test runner requires async callbacks for assertions over filesystem promises.
  // oxlint-disable-next-line effecttsgo/async-function -- Bun test callback intentionally awaits native filesystem APIs.
  test("recovers the writer lock after its owning process terminates", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-writer-crash-")),
      packageSourceUrl = pathToFileURL(join(import.meta.dir, "../../src/index.ts")).href,
      adaptersSourceUrl = pathToFileURL(join(import.meta.dir, "../../src/adapters/index.ts")).href,
      filesystemSourceUrl = pathToFileURL(
        join(import.meta.dir, "../../src/bun/filesystem/index.ts"),
      ).href,
      childScript = `
        import { Effect, Layer } from "effect";
        import { Persistence } from ${JSON.stringify(packageSourceUrl)};
        import { CryptoIdentifierGenerator } from ${JSON.stringify(adaptersSourceUrl)};
        import { BunFilesystemPersistence } from ${JSON.stringify(filesystemSourceUrl)};
        const filesystemLayer = BunFilesystemPersistence.layer({
          acknowledgement: "atomic",
          root: ${JSON.stringify(root)},
        }).pipe(Layer.provide(CryptoIdentifierGenerator.layer));
        await Effect.runPromise(Effect.scoped(Effect.gen(function* holdWriterLock() {
          yield* Layer.build(filesystemLayer);
          console.log("writer-ready");
          yield* Effect.never;
        })));
      `,
      child = Bun.spawn([process.execPath, "--eval", childScript], {
        cwd: join(import.meta.dir, "../.."),
        stderr: "pipe",
        stdout: "pipe",
      }),
      standardOutputReader = child.stdout.getReader(),
      firstOutput = await standardOutputReader.read();
    if (firstOutput.done) {
      throw new Error(
        `Writer child exited before startup: ${await new Response(child.stderr).text()}`,
      );
    }
    expect(new TextDecoder().decode(firstOutput.value)).toContain("writer-ready");
    child.kill(killSignal);
    await child.exited;

    const recoveredGeneration = await Effect.runPromise(
      Persistence.EntryPersistence.pipe(
        Effect.flatMap((entries) => entries.readGeneration),
        // This test invocation is the application entry point and owns the isolated filesystem layer.
        // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
        Effect.provide(
          BunFilesystemPersistence.layer({ acknowledgement: "atomic", root }).pipe(
            Layer.provide(CryptoIdentifierGenerator.layer),
          ),
        ),
      ),
    );
    expect(recoveredGeneration.generation).toBe(initialGeneration);
  });
});
