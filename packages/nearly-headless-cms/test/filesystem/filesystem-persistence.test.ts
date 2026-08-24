import { describe, expect, test } from "bun:test";
import { mkdtemp, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Deferred, Effect, Exit, Fiber, Layer, Stream } from "effect";
import { Asset, ContentDefinition, Persistence } from "../../src/index.ts";
import { CryptoIdentifierGenerator } from "../../src/adapters/index.ts";
import { BunFilesystemPersistence } from "../../src/bun/filesystem/index.ts";

describe("BunFilesystemPersistence", () => {
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
          activatedAt = new Date().toISOString(),
          snapshotRecord = {
            activatedAt,
            compiled: targetSnapshot,
            input: targetSnapshot.input,
          };
        expect(catalog.commitCutover).toBeDefined();
        yield* catalog.commitCutover(
          catalogState.version,
          {
            ...catalogState,
            active: snapshotRecord,
            snapshots: [...catalogState.snapshots, snapshotRecord],
          },
          generationWithEntry.generation,
          generationWithEntry.records,
        );
      }).pipe(Effect.provide(makeLayer())),
    );

    const recovered = await Effect.runPromise(
      Effect.gen(function* recoverCutover() {
        const entries = yield* Persistence.EntryPersistence,
          catalog = yield* Persistence.DefinitionCatalog;
        return { catalog: yield* catalog.read, entries: yield* entries.readGeneration };
      }).pipe(Effect.provide(makeLayer())),
    );
    expect(recovered.catalog.active.compiled.snapshotId).toBe("with-slug");
    expect(recovered.entries.records.get("note-1")?.entry.values["slug"]).toBe("durable");
  });

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
        }).pipe(Effect.provide(filesystemLayer)),
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

  test("interrupts an oversized Asset stream at the configured bound", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-bounded-stream-")),
      filesystemLayer = BunFilesystemPersistence.layer({
        acknowledgement: "atomic",
        maximumAssetByteLength: 5,
        root,
      }).pipe(Layer.provide(CryptoIdentifierGenerator.layer));
    let pulledChunks = 0;
    const content = Stream.fromIterable([
        new Uint8Array([1, 2, 3]),
        new Uint8Array([4, 5, 6]),
        new Uint8Array([7]),
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
        }).pipe(Effect.provide(filesystemLayer)),
      );
    expect(Exit.isFailure(result)).toBeTrue();
    expect(pulledChunks).toBe(2);
  });

  test("stages Asset chunks before the source completes and removes the stage on cancellation", async () => {
    const root = await mkdtemp(join(tmpdir(), "nearly-headless-cms-stream-stage-")),
      filesystemLayer = BunFilesystemPersistence.layer({ acknowledgement: "atomic", root }).pipe(
        Layer.provide(CryptoIdentifierGenerator.layer),
      ),
      observed = await Effect.runPromise(
        Effect.gen(function* observeStreamingStage() {
          const assets = yield* Asset.Management,
            firstChunkPulled = yield* Deferred.make<void>(),
            content = Stream.make(new Uint8Array([1, 2, 3])).pipe(
              Stream.tap(() => Deferred.succeed(firstChunkPulled, undefined)),
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
          const stageExistedWhilePending = yield* Effect.promise(async () => {
            for (let attempt = 0; attempt < 50; attempt += 1) {
              if (
                (await readdir(join(root, "blobs"))).some((name) =>
                  name.startsWith(".nhcms-stage-"),
                )
              )
                return true;
              await Bun.sleep(10);
            }
            return false;
          });
          yield* Fiber.interrupt(ingestion);
          const stagingAfterCancellation = yield* Effect.promise(async () => {
            for (let attempt = 0; attempt < 50; attempt += 1) {
              const staging = (await readdir(join(root, "blobs"))).filter((name) =>
                name.startsWith(".nhcms-stage-"),
              );
              if (staging.length === 0) return staging;
              await Bun.sleep(10);
            }
            return (await readdir(join(root, "blobs"))).filter((name) =>
              name.startsWith(".nhcms-stage-"),
            );
          });
          return { stageExistedWhilePending, stagingAfterCancellation };
        }).pipe(Effect.provide(filesystemLayer)),
      );

    expect(observed.stageExistedWhilePending).toBeTrue();
    expect(observed.stagingAfterCancellation).toEqual([]);
  });

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
          Effect.provide(makeFilesystemLayer()),
        ),
      ),
    );
    expect(Exit.isFailure(unexpectedRoot)).toBeTrue();
    expect(await Bun.file(evidencePath).exists()).toBeTrue();
  });
});
