import { Effect, Exit, Layer } from "effect";
import {
  atomicFilesystemLayer,
  durableFilesystemLayer,
  initialGeneration,
  killSignal,
  readEntryGeneration,
} from "./filesystem-persistence-support.ts";
import { expect } from "bun:test";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-211] Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
import { join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-212] The test exercises the Bun filesystem adapter's on-disk behavior; these helpers have no Bun equivalent.
import { mkdtemp } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";

const runWithLayer = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Value> =>
    Effect.runPromise(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
      effect.pipe(Effect.provide(layer)),
    ),
  runWithLayerExit = <Value, EffectError, Requirements>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-179] Layer values are provided to runPromise without mutation.
    layer: Layer.Layer<Requirements, EffectError>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    effect: Readonly<Effect.Effect<Value, EffectError, Requirements>>,
  ): Promise<Exit.Exit<Value, EffectError>> =>
    Effect.runPromise(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
      effect.pipe(Effect.provide(layer), Effect.exit),
    ),
  spawnWriterChild = (root: string): Promise<void> => {
    const adaptersSourceUrl = pathToFileURL(
        join(import.meta.dir, "../../src/adapters/index.ts"),
      ).href,
      filesystemSourceUrl = pathToFileURL(
        join(import.meta.dir, "../../src/bun/filesystem/index.ts"),
      ).href,
      packageSourceUrl = pathToFileURL(join(import.meta.dir, "../../src/index.ts")).href,
      writerProcess = Bun.spawn(
        [
          process.execPath,
          "--eval",
          `
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
        ],
        {
          cwd: join(import.meta.dir, "../.."),
          stderr: "pipe",
          stdout: "pipe",
        },
      );
    return writerProcess.stdout
      .getReader()
      .read()
      .then((firstOutput) => {
        if (firstOutput.done) {
          return new Response(writerProcess.stderr).text().then((standardError) => {
            throw new Error(`Writer process exited before startup: ${standardError}`);
          });
        }
        expect(new TextDecoder().decode(firstOutput.value)).toContain("writer-ready");
        writerProcess.kill(killSignal);
        return writerProcess.exited.then(() => {});
      });
  },
  verifyAbandonedStagingCleaned = (root: string): Promise<void> => {
    const filesystemLayer = durableFilesystemLayer(root);
    return Bun.write(join(root, ".nhcms-stage-abandoned"), "incomplete")
      .then(() => Bun.write(join(root, "blobs", ".nhcms-stage-abandoned"), "incomplete"))
      .then(() => runWithLayer(filesystemLayer, readEntryGeneration))
      .then(() => Bun.file(join(root, ".nhcms-stage-abandoned")).exists())
      .then((rootStagingRemoved) => {
        expect(rootStagingRemoved).toBeFalse();
        return Bun.file(join(root, "blobs", ".nhcms-stage-abandoned")).exists();
      })
      .then((blobStagingRemoved) => {
        expect(blobStagingRemoved).toBeFalse();
      });
  },
  verifyCompetingWriterRejected = (root: string): Promise<void> => {
    const filesystemLayer = durableFilesystemLayer(root);
    return Effect.runPromise(
      Effect.scoped(
        Effect.gen(function* rejectCompetingWriter() {
          yield* Layer.build(filesystemLayer);
          return yield* Effect.exit(Layer.build(filesystemLayer));
        }),
      ),
    ).then((competingWriter) => {
      expect(Exit.isFailure(competingWriter)).toBeTrue();
    });
  },
  verifyUnexpectedStagingPreserved = (root: string): Promise<void> => {
    const evidencePath = join(
        root,
        ".nhcms-stage-evidence.preserved".replace(".nhcms-stage-", ".nhcms-staging-"),
      ),
      filesystemLayer = durableFilesystemLayer(root);
    return Bun.write(evidencePath, "do not remove")
      .then(() => runWithLayerExit(filesystemLayer, readEntryGeneration))
      .then((unexpectedRoot) => {
        expect(Exit.isFailure(unexpectedRoot)).toBeTrue();
        return Bun.file(evidencePath).exists();
      })
      .then((evidencePreserved) => {
        expect(evidencePreserved).toBeTrue();
        return Bun.file(join(root, "writer.lock")).exists();
      })
      .then((writerLockRemoved) => {
        expect(writerLockRemoved).toBeFalse();
      });
  },
  verifyWriterEnforcement = (): Promise<void> => {
    const writerPrefix = join(tmpdir(), "nearly-headless-cms-writer-");
    return mkdtemp(writerPrefix).then((root) =>
      verifyCompetingWriterRejected(root)
        .then(() => verifyAbandonedStagingCleaned(root))
        .then(() => verifyUnexpectedStagingPreserved(root)),
    );
  },
  verifyWriterLockRecovery = (): Promise<void> => {
    const crashPrefix = join(tmpdir(), "nearly-headless-cms-writer-crash-");
    return mkdtemp(crashPrefix).then((root) => {
      const filesystemLayer = atomicFilesystemLayer(root);
      return spawnWriterChild(root)
        .then(() => runWithLayer(filesystemLayer, readEntryGeneration))
        .then((recoveredGeneration) => {
          expect(recoveredGeneration.generation).toBe(initialGeneration);
        });
    });
  };

export { verifyWriterEnforcement, verifyWriterLockRecovery };
