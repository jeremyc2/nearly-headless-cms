import type { Context } from "effect";
import type { Management, Metadata } from "../../asset.ts";
import type { CompileOptions, CompiledSnapshot } from "../../content-definition.ts";
import type {
  CatalogState,
  DefinitionCatalog,
  DefinitionSnapshotRecord,
  EntryPersistence,
  EntryRecord,
} from "../../persistence.ts";

export const defaultAssetMaximumByteLength = 25_000_000,
  defaultEntryMaximumByteLength = 50_000_000,
  defaultMetadataMaximumByteLength = 16_384,
  emptyLength = 0,
  generationFilenameWidth = 16,
  initialGeneration = 0,
  initialVersion = 1,
  lockProbeSignal = 0,
  stagingPrefix = ".nhcms-stage-",
  storageFormat = "nearly-headless-cms/filesystem",
  storageFormatVersion = 1;

/** Root path, acknowledgement, and resource bounds for one filesystem Adapter. */
export interface Configuration {
  readonly root: string;
  readonly acknowledgement: "atomic" | "durable";
  readonly maximumEntryEncodingByteLength?: number;
  readonly maximumAssetByteLength?: number;
  readonly maximumMetadataByteLength?: number;
}

/** Filesystem configuration plus the initial Definition Snapshot. */
export interface CmsConfiguration extends Configuration {
  readonly definitionSnapshot: CompiledSnapshot;
  readonly compileOptions?: CompileOptions;
}

export interface DiskAsset {
  readonly id: string;
  readonly metadata: Metadata;
}

export interface DiskGeneration {
  readonly format: typeof storageFormat;
  readonly version: typeof storageFormatVersion;
  readonly generation: number;
  readonly entryGeneration?: number;
  readonly records: readonly (readonly [string, EntryRecord])[];
  readonly assets: readonly DiskAsset[];
  readonly catalog?: DiskCatalog;
}

export interface DiskCatalog {
  readonly active: Omit<DefinitionSnapshotRecord, "compiled">;
  readonly events: CatalogState["events"];
  readonly migrationManifests: CatalogState["migrationManifests"];
  readonly migrationPreparations: CatalogState["migrationPreparations"];
  readonly retiredDefinitionIds: readonly string[];
  readonly revisions: CatalogState["revisions"];
  readonly snapshots: readonly Omit<DefinitionSnapshotRecord, "compiled">[];
  readonly version: number;
}

export interface DiskManifest {
  readonly format: typeof storageFormat;
  readonly version: typeof storageFormatVersion;
  readonly generation: number;
  readonly generationFile: string;
  readonly generationDigest: string;
}

export interface State {
  readonly assets: ReadonlyMap<string, DiskAsset>;
  readonly catalog?: CatalogState;
  readonly entryGeneration: number;
  readonly generation: number;
  readonly records: ReadonlyMap<string, EntryRecord>;
}

export interface Acquired {
  readonly context: Context.Context<DefinitionCatalog | EntryPersistence | Management>;
  readonly lockPath: string;
  readonly lockToken: string;
}

export interface WriterLock {
  readonly processId: number;
  readonly token?: string;
}
