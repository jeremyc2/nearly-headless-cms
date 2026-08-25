// oxlint-disable-next-line effecttsgo/node-builtin-import -- This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
import { readdir } from "node:fs/promises";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { basename, join } from "node:path";
import { type CompileOptions, type CompiledSnapshot } from "../../content-definition.ts";
import {
  type Configuration,
  type DiskGeneration,
  type State,
} from "./bun-filesystem-persistence-types.ts";
import type { CatalogState } from "../../persistence.ts";
import filesystemLockIo from "./bun-filesystem-persistence-lock-io.ts";
import filesystemLockRootValidation from "./bun-filesystem-persistence-lock-root-validation.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const { decodeCatalog } = filesystemLockIo,
  { validateDiskGeneration, validateFormatMarker, validateManifest, validateRootEntries } =
    filesystemLockRootValidation,
  { digest } = filesystemSupport,
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
    const catalog = decodeGenerationCatalog(
        validateDiskGeneration(JSON.parse(new TextDecoder().decode(generationBytes)), manifest),
        compileOptions,
      ),
      generation = validateDiskGeneration(
        JSON.parse(new TextDecoder().decode(generationBytes)),
        manifest,
      ),
      loadedState = loadedStateFromGeneration(generation, catalog);
    if (definitionSnapshot !== undefined) {
      assertDefinitionSpace(definitionSnapshot, catalog);
    }
    return loadedState;
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
  // oxlint-disable-next-line effecttsgo/async-function -- JSON loading uses Bun's asynchronous file API.
  readJson = async (path: string): Promise<unknown> => {
    const file = Bun.file(path);
    if (!(await file.exists())) {
      throw new Error(`Missing committed file ${basename(path)}`);
    }
    return file.json();
  };

export default {
  loadExistingRoot,
  readJson,
};
