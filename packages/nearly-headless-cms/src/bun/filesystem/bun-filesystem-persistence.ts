import type {
  Acquired,
  CmsConfiguration,
  Configuration,
} from "./bun-filesystem-persistence-types.ts";
import type { CompileOptions, CompiledSnapshot } from "../../content-definition.ts";
import type { DefinitionCatalog, EntryPersistence } from "../../persistence.ts";
import { Effect, Layer } from "effect";
import { Generator } from "../../identifier.ts";
import type { InfrastructureFailure } from "../../cms-error.ts";
import type { Management } from "../../asset.ts";
import filesystemLockRoot from "./bun-filesystem-persistence-lock-root.ts";
import filesystemServices from "./bun-filesystem-persistence-services.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

export type { CmsConfiguration, Configuration } from "./bun-filesystem-persistence-types.ts";

const { makeServices } = filesystemServices,
  { acquireWriterLock, ensureRootDirectory, initializeRoot, inspectRoot, removeOwnedWriterLock } =
    filesystemLockRoot,
  { failure, fromPromise } = filesystemSupport,
  acquire = (
    configuration: Configuration,
    definitionSnapshot?: CompiledSnapshot,
    compileOptions: CompileOptions = {},
  ): Effect.Effect<Acquired, InfrastructureFailure, Generator> =>
    Effect.gen(function* acquireFilesystemRoot() {
      if (configuration.root.length === 0) {
        return yield* failure("Filesystem Persistence root is required", new Error("empty root"));
      }
      const acquiredLock = yield* fromPromise(
          () => ensureRootDirectory(configuration),
          "Filesystem Persistence root creation failed",
        ).pipe(
          Effect.flatMap(() =>
            fromPromise(
              () => acquireWriterLock(configuration),
              "Filesystem Persistence root already has an initialized writer",
            ),
          ),
        ),
        identifiers = yield* Generator;
      return yield* Effect.gen(function* initializeFilesystemRoot() {
        const context = yield* makeServices(
          configuration,
          identifiers,
          yield* fromPromise(
            () => initializeRoot(configuration, definitionSnapshot, compileOptions),
            "Filesystem Persistence initialization failed",
          ),
        );
        return { context, ...acquiredLock };
      }).pipe(
        Effect.onError(() =>
          fromPromise(
            () => removeOwnedWriterLock(acquiredLock.lockPath, acquiredLock.lockToken),
            "Filesystem Persistence writer lock cleanup failed",
          ).pipe(Effect.ignore),
        ),
      );
    }),
  /** Creates the complete filesystem persistence Layer used by a CMS composition. */
  cmsLayer = (
    configuration: CmsConfiguration,
  ): Layer.Layer<
    DefinitionCatalog | EntryPersistence | Management,
    InfrastructureFailure,
    Generator
  > =>
    Layer.effectContext(
      Effect.acquireRelease(
        acquire(
          configuration,
          configuration.definitionSnapshot,
          configuration.compileOptions ?? {},
        ),
        (acquired) =>
          fromPromise(
            () => removeOwnedWriterLock(acquired.lockPath, acquired.lockToken),
            "Filesystem Persistence writer lock cleanup failed",
          ).pipe(Effect.ignore),
      ).pipe(Effect.map((acquired) => acquired.context)),
    ),
  /** Reads a bounded diagnostic snapshot of a filesystem root without mutating it. */
  inspect = (
    root: string,
  ): Effect.Effect<
    { readonly format: string; readonly generation: number },
    InfrastructureFailure
  > => fromPromise(() => inspectRoot(root), "Filesystem Persistence inspection failed"),
  /**
   * Creates Bun-only Entry, Asset, and Definition persistence services for one root.
   * Exactly one writer process may own a root; startup recovers staged generations.
   */
  layer = (
    configuration: Configuration,
  ): Layer.Layer<EntryPersistence | Management, InfrastructureFailure, Generator> =>
    Layer.effectContext(
      Effect.acquireRelease(acquire(configuration), (acquired) =>
        fromPromise(
          () => removeOwnedWriterLock(acquired.lockPath, acquired.lockToken),
          "Filesystem Persistence writer lock cleanup failed",
        ).pipe(Effect.ignore),
      ).pipe(Effect.map((acquired) => acquired.context)),
    );

export { cmsLayer, inspect, layer };
