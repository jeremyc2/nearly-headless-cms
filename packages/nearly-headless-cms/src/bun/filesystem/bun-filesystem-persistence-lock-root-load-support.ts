import {
  type CatalogState,
  type CompileOptions,
  type CompiledSnapshot,
  type Configuration,
  type State,
  basename,
  join,
  readdir,
} from "./bun-filesystem-persistence-lock-root-load-imports.ts";
import filesystemLockRootGenerationSupport from "./bun-filesystem-persistence-lock-root-load-generation-support.ts";
import filesystemLockRootValidation from "./bun-filesystem-persistence-lock-root-validation.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const { generationStateFromBytes, readCommittedGeneration } = filesystemLockRootGenerationSupport,
  { validateFormatMarker, validateRootEntries } = filesystemLockRootValidation,
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-066] Root initialization coordinates ordered filesystem operations.
  loadExistingRoot = async (
    configuration: Configuration,
    definitionSnapshot: CompiledSnapshot | undefined,
    compileOptions: CompileOptions,
  ): Promise<State> => {
    const formatPath = join(configuration.root, "format.json"),
      { generationBytes, manifest } = await readCommittedGeneration(configuration.root, readJson),
      { catalog, loadedState } = generationStateFromBytes(
        generationBytes,
        manifest,
        compileOptions,
      );
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
    if (definitionSnapshot !== undefined) {
      assertDefinitionSpace(definitionSnapshot, catalog);
    }
    return loadedState;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-044] JSON loading uses Bun's asynchronous file API.
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
