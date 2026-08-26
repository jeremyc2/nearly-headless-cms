// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-211] Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
import { join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-211] Path joining is host-path setup for this filesystem integration test, outside the Effect service graph.
import { pathToFileURL } from "node:url";
// oxlint-disable-next-line eslint/sort-imports -- [EH-296] child spawn imports follow bun, node, and support dependency order.
import { expect } from "bun:test";
import { killSignal } from "./filesystem-persistence-support.ts";

const commitStartMarker = "commit-start",
  firstEntryIdentifier = "entry-1",
  // oxlint-disable-next-line eslint/max-lines-per-function -- [EH-293] child spawn script must stay in one function for eval readability.
  spawnCommittingWriterChild = (root: string): Promise<void> => {
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
        await Effect.runPromise(
          Effect.scoped(
            Effect.gen(function* commitDuringCrash() {
              const entries = yield* Persistence.EntryPersistence;
              const initialGeneration = yield* entries.readGeneration();
              console.log(${JSON.stringify(commitStartMarker)});
              yield* entries.commitGeneration(
                initialGeneration.generation,
                new Map([
                  [
                    ${JSON.stringify(firstEntryIdentifier)},
                    {
                      entry: {
                        contentTypeId: "note",
                        id: ${JSON.stringify(firstEntryIdentifier)},
                        values: { title: "Committed" },
                      },
                      revisions: [],
                    },
                  ],
                ]),
              );
              yield* Effect.never;
            }).pipe(Effect.provide(filesystemLayer)),
          ),
        );
      `,
        ],
        {
          cwd: join(import.meta.dir, "../.."),
          stderr: "pipe",
          stdout: "pipe",
        },
      );
    return writerProcess.stdout.getReader().read().then((firstOutput) => {
      if (firstOutput.done) {
        return new Response(writerProcess.stderr).text().then((standardError) => {
          throw new Error(`Commit child exited before startup: ${standardError}`);
        });
      }
      expect(new TextDecoder().decode(firstOutput.value)).toContain(commitStartMarker);
      writerProcess.kill(killSignal);
      return writerProcess.exited.then(() => {});
    });
  };

export { spawnCommittingWriterChild };
