import {
  type DiskCatalog,
  type DiskGeneration,
  type DiskManifest,
  emptyLength,
  storageFormat,
  storageFormatVersion,
} from "./bun-filesystem-persistence-types.ts";
import type { SnapshotInput } from "../../content-definition.ts";

const diskCatalogFromGeneration = (catalog: unknown): DiskCatalog | undefined => {
    if (catalog === undefined) {
      return undefined;
    }
    if (typeof catalog !== "object" || catalog === null) {
      throw new Error("Committed generation is corrupt");
    }
    const active: unknown = Reflect.get(catalog, "active"),
      events: unknown = Reflect.get(catalog, "events"),
      migrationManifests: unknown = Reflect.get(catalog, "migrationManifests"),
      migrationPreparations: unknown = Reflect.get(catalog, "migrationPreparations"),
      retiredDefinitionIds: unknown = Reflect.get(catalog, "retiredDefinitionIds"),
      revisions: unknown = Reflect.get(catalog, "revisions"),
      snapshots: unknown = Reflect.get(catalog, "snapshots"),
      version: unknown = Reflect.get(catalog, "version");
    if (
      typeof active !== "object" ||
      active === null ||
      !Array.isArray(events) ||
      !Array.isArray(migrationManifests) ||
      !Array.isArray(migrationPreparations) ||
      !Array.isArray(retiredDefinitionIds) ||
      !Array.isArray(revisions) ||
      !Array.isArray(snapshots) ||
      typeof version !== "number"
    ) {
      throw new Error("Committed generation is corrupt");
    }
    return {
      active: readActiveSnapshot(active),
      events,
      migrationManifests,
      migrationPreparations,
      retiredDefinitionIds,
      revisions,
      snapshots,
      version,
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
  isSnapshotInput = (value: object): value is SnapshotInput => {
    const compilerFormatVersion: unknown = Reflect.get(value, "compilerFormatVersion"),
      definitionSpaceId: unknown = Reflect.get(value, "definitionSpaceId"),
      definitions: unknown = Reflect.get(value, "definitions"),
      snapshotId: unknown = Reflect.get(value, "snapshotId");
    return (
      typeof definitionSpaceId === "string" &&
      typeof snapshotId === "string" &&
      Array.isArray(definitions) &&
      (compilerFormatVersion === undefined || typeof compilerFormatVersion === "number")
    );
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
  readActiveSnapshot = (
    active: object,
  ): { readonly activatedAt: string; readonly input: SnapshotInput } => {
    const activatedAt: unknown = Reflect.get(active, "activatedAt"),
      input: unknown = Reflect.get(active, "input");
    if (typeof activatedAt !== "string" || typeof input !== "object" || input === null) {
      throw new Error("Committed generation is corrupt");
    }
    if (!isSnapshotInput(input)) {
      throw new Error("Committed generation is corrupt");
    }
    return { activatedAt, input };
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
  validateDiskGeneration,
  validateFormatMarker,
  validateManifest,
  validateRootEntries,
};
