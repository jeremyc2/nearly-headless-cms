import {
  type CatalogState,
  type CompileOptions,
  type DiskGeneration,
  type State,
  join,
} from "./bun-filesystem-persistence-lock-root-load-imports.ts";
import filesystemLockIo from "./bun-filesystem-persistence-lock-io.ts";
import filesystemLockRootValidation from "./bun-filesystem-persistence-lock-root-validation.ts";

const { decodeCatalog } = filesystemLockIo,
  { validateDiskGeneration, validateManifest } = filesystemLockRootValidation,
  decodeGenerationCatalog = (
    generation: DiskGeneration,
    compileOptions: CompileOptions,
  ): CatalogState | undefined => {
    if (generation.catalog === undefined) {
      return undefined;
    }
    return decodeCatalog(generation.catalog, compileOptions);
  },
  generationStateFromBytes = <
    Bytes extends Uint8Array,
    Manifest extends ReturnType<typeof validateManifest>,
  >(
    generationBytes: Readonly<Bytes>,
    manifest: Readonly<Manifest>,
    compileOptions: CompileOptions,
  ): { readonly catalog: CatalogState | undefined; readonly loadedState: State } =>
    generationStateFromValidatedGeneration(
      validateDiskGeneration(parseGenerationJson(generationBytes), manifest),
      compileOptions,
    ),
  generationStateFromValidatedGeneration = (
    validatedGeneration: DiskGeneration,
    compileOptions: CompileOptions,
  ): { readonly catalog: CatalogState | undefined; readonly loadedState: State } => {
    const catalog = decodeGenerationCatalog(validatedGeneration, compileOptions),
      loadedState = loadedStateFromGeneration(validatedGeneration, catalog);
    return { catalog, loadedState };
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
  parseGenerationJson = <Bytes extends Uint8Array>(generationBytes: Readonly<Bytes>): unknown =>
    JSON.parse(new TextDecoder().decode(generationBytes)) as unknown,
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-066] Root initialization coordinates ordered filesystem operations.
  readCommittedGeneration = async (
    root: string,
    readJson: (path: string) => Promise<unknown>,
  ): Promise<{
    readonly generationBytes: Uint8Array;
    readonly manifest: ReturnType<typeof validateManifest>;
  }> => {
    const manifest = await readManifestFile(root, readJson);
    return {
      generationBytes: await readGenerationBytes(root, manifest),
      manifest,
    };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-066] Root initialization coordinates ordered filesystem operations.
  readGenerationBytes = async (
    root: string,
    manifest: ReturnType<typeof validateManifest>,
  ): Promise<Uint8Array> => {
    const generationPath = join(root, manifest.generationFile);
    return new Uint8Array(await Bun.file(generationPath).arrayBuffer());
  },
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-066] Root initialization coordinates ordered filesystem operations.
  readManifestFile = async (
    root: string,
    readJson: (path: string) => Promise<unknown>,
  ): Promise<ReturnType<typeof validateManifest>> => {
    const manifestPath = join(root, "manifest.json");
    return validateManifest(await readJson(manifestPath));
  };

export default {
  generationStateFromBytes,
  readCommittedGeneration,
};
