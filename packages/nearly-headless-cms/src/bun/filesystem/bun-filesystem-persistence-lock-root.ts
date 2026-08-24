// oxlint-disable-next-line effecttsgo/node-builtin-import -- Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { basename, join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { type CompileOptions, type CompiledSnapshot } from "../../content-definition.ts";
import type { CatalogState } from "../../persistence.ts";
import { DateTime } from "effect";
import {
  type Configuration,
  type DiskCatalog,
  type DiskGeneration,
  type DiskManifest,
  type State,
  emptyLength,
  initialGeneration,
  stagingPrefix,
  storageFormat,
  storageFormatVersion,
} from "./bun-filesystem-persistence-types.ts";
import filesystemLockIo from "./bun-filesystem-persistence-lock-io.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const {
    acquireWriterLock,
    decodeCatalog,
    initialCatalog,
    persistState,
    removeOwnedWriterLock,
  } = filesystemLockIo,
  { digest, encode, writeAtomic } = filesystemSupport,
  assertDefinitionSpace = (
    definitionSnapshot: CompiledSnapshot,
    catalog: CatalogState | undefined,
  ): void => {
    if (catalog === undefined) {
      throw new Error("Filesystem Persistence root has no durable Definition Catalog");
    }
    if (catalog.active.compiled.definitionSpaceId !== definitionSnapshot.definitionSpaceId) {
      throw new Error("Filesystem Persistence Definition Space does not match configuration");
    }
  },
  decodeGenerationCatalog = (
    generation: DiskGeneration,
    compileOptions: CompileOptions,
  ): CatalogState | undefined => {
    if (generation.catalog === undefined) {
      return undefined;
    }
    return decodeCatalog(generation.catalog, compileOptions);
  },
  diskCatalogFromGeneration = (catalog: unknown): DiskCatalog | undefined => {
    if (catalog === undefined) {
      return undefined;
    }
    if (typeof catalog !== "object" || catalog === null) {
      throw new Error("Committed generation is corrupt");
    }
    return catalog as DiskCatalog;
  },
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
  entryGenerationFromDisk = (entryGeneration: unknown): number | undefined => {
    if (entryGeneration === undefined) {
      return undefined;
    }
    if (typeof entryGeneration !== "number") {
      throw new TypeError("Committed generation is corrupt");
    }
    return entryGeneration;
  },
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
      manifestPath = join(root, "manifest.json"),
      marker = await readJson(formatPath),
      manifest = validateManifest(await readJson(manifestPath)),
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
  loadedStateFromGeneration = (
    generation: DiskGeneration,
    catalog: CatalogState | undefined,
  ): State => {
    const loadedState: State = {
      assets: new Map(generation.assets.map((asset) => [asset.id, asset])),
      entryGeneration: generation.entryGeneration ?? generation.generation,
      generation: generation.generation,
      records: new Map(generation.records),
    };
    if (catalog === undefined) {
      return loadedState;
    }
    return { ...loadedState, catalog };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Root initialization coordinates ordered filesystem operations.
  loadExistingRoot = async (
    configuration: Configuration,
    definitionSnapshot: CompiledSnapshot | undefined,
    compileOptions: CompileOptions,
  ): Promise<State> => {
    const formatPath = join(configuration.root, "format.json"),
      manifestPath = join(configuration.root, "manifest.json"),
      manifest = validateManifest(await readJson(manifestPath)),
      generationPath = join(configuration.root, manifest.generationFile),
      generationBytes = new Uint8Array(await Bun.file(generationPath).arrayBuffer());
    validateFormatMarker(await readJson(formatPath));
    validateRootEntries(await readdir(configuration.root), [
      "blobs",
      "format.json",
      "generations",
      "manifest.json",
      "writer.lock",
    ]);
    if (digest(generationBytes) !== manifest.generationDigest) {
      throw new Error("Committed generation digest mismatch");
    }
    const generation = validateDiskGeneration(
        JSON.parse(new TextDecoder().decode(generationBytes)),
        manifest,
      ),
      catalog = decodeGenerationCatalog(generation, compileOptions),
      loadedState = loadedStateFromGeneration(generation, catalog);
    if (definitionSnapshot !== undefined) {
      assertDefinitionSpace(definitionSnapshot, catalog);
    }
    return loadedState;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- JSON loading uses Bun's asynchronous file API.
  readJson = async (path: string): Promise<unknown> => {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`Missing committed file ${basename(path)}`);
    }
    return file.json();
  },
  mergeValidatedGeneration = (
    decoded: DiskGeneration,
    decodedCatalog: DiskCatalog | undefined,
    decodedEntryGeneration: number | undefined,
  ): DiskGeneration => {
    if (decodedCatalog === undefined && decodedEntryGeneration === undefined) {
      return decoded;
    }
    if (decodedCatalog === undefined) {
      return { ...decoded, entryGeneration: decodedEntryGeneration };
    }
    if (decodedEntryGeneration === undefined) {
      return { ...decoded, catalog: decodedCatalog };
    }
    return {
      ...decoded,
      catalog: decodedCatalog,
      entryGeneration: decodedEntryGeneration,
    };
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
  },
  validateDiskGeneration = (generation: unknown, manifest: DiskManifest): DiskGeneration => {
    if (typeof generation !== "object" || generation === null) {
      throw new Error("Committed generation is corrupt");
    }
    const assets: unknown = Reflect.get(generation, "assets"),
      catalog: unknown = Reflect.get(generation, "catalog"),
      decodedCatalog = diskCatalogFromGeneration(catalog),
      decodedEntryGeneration = entryGenerationFromDisk(
        Reflect.get(generation, "entryGeneration"),
      ),
      format: unknown = Reflect.get(generation, "format"),
      generationNumber: unknown = Reflect.get(generation, "generation"),
      records: unknown = Reflect.get(generation, "records"),
      version: unknown = Reflect.get(generation, "version");
    if (
      format !== storageFormat ||
      version !== storageFormatVersion ||
      typeof generationNumber !== "number" ||
      generationNumber !== manifest.generation ||
      !Array.isArray(records) ||
      !Array.isArray(assets)
    ) {
      throw new Error("Committed generation is corrupt");
    }
    return mergeValidatedGeneration(
      {
        assets,
        format: storageFormat,
        generation: generationNumber,
        records,
        version: storageFormatVersion,
      },
      decodedCatalog,
      decodedEntryGeneration,
    );
  },
  validateFormatMarker = (marker: unknown): void => {
    if (
      typeof marker !== "object" ||
      marker === null ||
      Reflect.get(marker, "format") !== storageFormat ||
      Reflect.get(marker, "version") !== storageFormatVersion
    ) {
      throw new Error("Filesystem Persistence format is incompatible");
    }
  },
  validateManifest = (manifest: unknown): DiskManifest => {
    if (typeof manifest !== "object" || manifest === null) {
      throw new Error("Filesystem Persistence manifest is corrupt");
    }
    const format: unknown = Reflect.get(manifest, "format"),
      generation: unknown = Reflect.get(manifest, "generation"),
      generationDigest: unknown = Reflect.get(manifest, "generationDigest"),
      generationFile: unknown = Reflect.get(manifest, "generationFile"),
      version: unknown = Reflect.get(manifest, "version");
    if (
      format !== storageFormat ||
      version !== storageFormatVersion ||
      typeof generation !== "number" ||
      typeof generationFile !== "string" ||
      !/^generations\/generation-\d{16}\.json$/u.test(generationFile)
    ) {
      throw new Error("Filesystem Persistence manifest is corrupt");
    }
    if (typeof generationDigest !== "string") {
      throw new TypeError("Filesystem Persistence manifest is corrupt");
    }
    return {
      format: storageFormat,
      generation,
      generationDigest,
      generationFile,
      version: storageFormatVersion,
    };
  },
  validateRootEntries = (rootEntries: readonly string[], allowed: readonly string[]): void => {
    const unexpected = rootEntries.filter((name) => !allowed.includes(name));
    if (unexpected.length > emptyLength) {
      throw new Error("Filesystem Persistence root contains unexpected data");
    }
  };

export default {
  acquireWriterLock,
  initializeRoot,
  inspectRoot,
  persistState,
  removeOwnedWriterLock,
};
