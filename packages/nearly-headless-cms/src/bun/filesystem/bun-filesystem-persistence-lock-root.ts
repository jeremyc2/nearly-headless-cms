// oxlint-disable-next-line effecttsgo/node-builtin-import -- This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
import { mkdir, readdir, rm, stat } from "node:fs/promises";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { join } from "node:path";
import { type CompileOptions, type CompiledSnapshot } from "../../content-definition.ts";
import {
  type Configuration,
  type State,
  emptyLength,
  initialGeneration,
  stagingPrefix,
  storageFormat,
  storageFormatVersion,
} from "./bun-filesystem-persistence-types.ts";
import { DateTime } from "effect";
import filesystemLockIo from "./bun-filesystem-persistence-lock-io.ts";
import filesystemLockRootLoadSupport from "./bun-filesystem-persistence-lock-root-load-support.ts";
import filesystemLockRootValidation from "./bun-filesystem-persistence-lock-root-validation.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const {
    acquireWriterLock,
    initialCatalog,
    persistState,
    removeOwnedWriterLock,
  } = filesystemLockIo,
  { loadExistingRoot, readJson } = filesystemLockRootLoadSupport,
  { validateManifest } = filesystemLockRootValidation,
  { encode, writeAtomic } = filesystemSupport,
  emptyRootState = (definitionSnapshot: CompiledSnapshot | undefined): State => {
    const state: State = {
      assets: new Map(),
      entryGeneration: initialGeneration,
      generation: initialGeneration,
      records: new Map(),
    };
    if (definitionSnapshot === undefined) {
      return state;
    }
    return {
      ...state,
      catalog: initialCatalog(definitionSnapshot, DateTime.formatIso(DateTime.nowUnsafe())),
    };
  },
  ensureRootDirectory = (configuration: Configuration): Promise<void> =>
    mkdir(configuration.root, { recursive: true }).then(() => {}),
  // oxlint-disable-next-line effecttsgo/async-function -- Root initialization coordinates ordered filesystem operations.
  initializeEmptyRoot = async (
    configuration: Configuration,
    definitionSnapshot: CompiledSnapshot | undefined,
  ): Promise<State> => {
    const rootEntries = await readdir(configuration.root),
      state = emptyRootState(definitionSnapshot),
      unexpected = rootEntries.filter(
        (name) => !["blobs", "generations", "writer.lock"].includes(name),
      );
    if (unexpected.length > emptyLength) {
      throw new Error("Filesystem Persistence root is not empty");
    }
    await writeAtomic(
      join(configuration.root, "format.json"),
      encode({ format: storageFormat, version: storageFormatVersion }),
      configuration.acknowledgement,
    );
    await persistState(configuration, state);
    return state;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Root initialization coordinates ordered filesystem operations.
  initializeRoot = async (
    configuration: Configuration,
    definitionSnapshot?: CompiledSnapshot,
    compileOptions: CompileOptions = {},
  ): Promise<State> => {
    await mkdir(configuration.root, { recursive: true });
    await mkdir(join(configuration.root, "generations"), { recursive: true });
    await mkdir(join(configuration.root, "blobs"), { recursive: true });
    await removeAbandonedStaging(configuration.root);
    const formatPath = join(configuration.root, "format.json");
    if (!(await Bun.file(formatPath).exists())) {
      return initializeEmptyRoot(configuration, definitionSnapshot);
    }
    return loadExistingRoot(configuration, definitionSnapshot, compileOptions);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Diagnostic inspection is a read-only filesystem boundary.
  inspectRoot = async (
    root: string,
  ): Promise<{ readonly format: string; readonly generation: number }> => {
    const formatPath = join(root, "format.json"),
      manifest = validateManifest(await readJson(join(root, "manifest.json"))),
      marker = await readJson(formatPath),
      rootStats = await stat(root);
    if (
      !rootStats.isDirectory() ||
      typeof marker !== "object" ||
      marker === null ||
      Reflect.get(marker, "format") !== storageFormat ||
      Reflect.get(marker, "version") !== storageFormatVersion
    ) {
      throw new Error("Invalid Filesystem Persistence root");
    }
    return { format: storageFormat, generation: manifest.generation };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Cleanup intentionally preserves sequential filesystem ordering.
  removeAbandonedStaging = async (directory: string): Promise<void> => {
    for (const entry of await readdir(directory, { withFileTypes: true })) {
      const path = join(directory, entry.name);
      if (entry.name.startsWith(stagingPrefix)) {
        // Preserve deterministic cleanup ordering while removing abandoned staging entries.
        // oxlint-disable-next-line no-await-in-loop -- cleanup must remain sequential.
        await rm(path, { force: true, recursive: entry.isDirectory() });
      } else if (entry.isDirectory() && ["blobs", "generations"].includes(entry.name)) {
        // Preserve recursive cleanup ordering for nested staging directories.
        // oxlint-disable-next-line no-await-in-loop -- recursive cleanup must remain sequential.
        await removeAbandonedStaging(path);
      }
    }
  };

export default {
  acquireWriterLock,
  ensureRootDirectory,
  initializeRoot,
  inspectRoot,
  persistState,
  removeOwnedWriterLock,
};
