import type { CompiledSnapshot, JsonObject } from "./content-definition.ts";
import type {
  Handler,
  Manifest,
  Preparation,
  PreparationInput,
} from "./definition-migration-types.ts";
import { InvalidInput, type ValidationIssue } from "./cms-error.ts";
import type { Representation } from "./entry.ts";
import { Schema } from "effect";

interface PathCountInput {
  readonly manifests: readonly Manifest[];
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly visited: ReadonlySet<string>;
}

const NO_PATHS = 0,
  SINGLE_PATH = 1,
  appendMigrationIssue = <Issues extends ValidationIssue[]>(
    issues: Issues,
    entry: Readonly<Representation>,
    error: unknown,
  ): Issues => {
    if (Schema.is(InvalidInput)(error) && error.issues !== undefined) {
      issues.push(
        ...error.issues.map((validationIssue) => ({
          ...validationIssue,
          path: ["entries", entry.id, ...validationIssue.path],
        })),
      );
      return issues;
    }
    let message = "Migration Handler failed";
    if (error instanceof Error) {
      ({ message } = error);
    }
    issues.push({
      message,
      path: ["entries", entry.id],
      reason: "migrationHandlerFailure",
    });
    return issues;
  },
  countPathsFromSnapshot = ({
    manifests,
    sourceSnapshotId,
    targetSnapshotId,
    visited,
  }: Readonly<PathCountInput>): number => {
    const nextVisited = new Set(visited).add(sourceSnapshotId),
      outgoingManifests = manifests.filter(
        (candidate) => candidate.sourceSnapshotId === sourceSnapshotId,
      );
    let count = NO_PATHS;
    for (const manifest of outgoingManifests) {
      count += pathCount({
        manifests,
        sourceSnapshotId: manifest.targetSnapshotId,
        targetSnapshotId,
        visited: nextVisited,
      });
      if (count > SINGLE_PATH) {
        return count;
      }
    }
    return count;
  },
  finalizePreparation = <Input extends PreparationInput, Issues extends ValidationIssue[]>(
    input: Readonly<Input>,
    transformedEntries: readonly Representation[],
    issues: Readonly<Issues>,
  ): Preparation => {
    let entries: readonly Representation[] = [],
      report: Preparation["report"] = { issues, status: "failed" };
    if (issues.length === NO_PATHS) {
      entries = transformedEntries;
      report = { status: "ready", transformedEntryCount: transformedEntries.length };
    }
    return {
      entries,
      id: `${input.manifest.id}@${input.sourceGeneration}`,
      manifest: input.manifest,
      report,
      sourceGeneration: input.sourceGeneration,
      sourceSnapshotId: input.source.snapshotId,
      targetSnapshotId: input.target.snapshotId,
    };
  },
  findMigrationHandler = (
    handlers: PreparationInput["handlers"],
    manifest: Manifest,
  ): Handler | undefined =>
    handlers.find(
      (candidate) =>
        candidate.identifier === manifest.handlerIdentifier &&
        candidate.version === manifest.handlerVersion,
    ),
  migrateEntryValues = (
    entry: Representation,
    handler: Handler | undefined,
    input: PreparationInput,
  ): JsonObject => {
    let validatedValues = entry.values;
    if (input.manifest.compatible !== true) {
      if (handler === undefined) {
        throw new Error("Migration handler is missing");
      }
      validatedValues = handler.transform({
        contentTypeId: entry.contentTypeId,
        entryId: entry.id,
        manifest: input.manifest,
        values: structuredClone(entry.values),
      });
    }
    return input.target.validateEntry(entry.contentTypeId, validatedValues, {
      applyDefaults: false,
    });
  },
  missingHandlerPreparation = (input: Readonly<PreparationInput>): Preparation => ({
    entries: [],
    id: `${input.manifest.id}@${input.sourceGeneration}`,
    manifest: input.manifest,
    report: {
      issues: [
        {
          message: `Migration Handler ${input.manifest.handlerIdentifier}@${input.manifest.handlerVersion} is not registered`,
          path: ["entries", "*"],
          reason: "missingMigrationHandler",
        },
      ],
      status: "failed",
    },
    sourceGeneration: input.sourceGeneration,
    sourceSnapshotId: input.source.snapshotId,
    targetSnapshotId: input.target.snapshotId,
  }),
  pathCount = ({
    manifests,
    sourceSnapshotId,
    targetSnapshotId,
    visited,
  }: Readonly<PathCountInput>): number => {
    if (sourceSnapshotId === targetSnapshotId) {
      return SINGLE_PATH;
    }
    if (visited.has(sourceSnapshotId)) {
      return NO_PATHS;
    }
    return countPathsFromSnapshot({
      manifests,
      sourceSnapshotId,
      targetSnapshotId,
      visited,
    });
  },
  searchMigrationPath = (
    manifests: readonly Manifest[],
    sourceSnapshotId: string,
    targetSnapshotId: string,
  ): readonly Manifest[] | undefined => {
    const search = (
      currentSnapshotId: string,
      visited: ReadonlySet<string>,
    ): readonly Manifest[] | undefined => {
      if (currentSnapshotId === targetSnapshotId) {
        return [];
      }
      if (visited.has(currentSnapshotId)) {
        return undefined;
      }
      const nextVisited = new Set(visited).add(currentSnapshotId),
        outgoingManifests = manifests.filter(
          (candidate) => candidate.sourceSnapshotId === currentSnapshotId,
        );
      for (const manifest of outgoingManifests) {
        const remainder = search(manifest.targetSnapshotId, nextVisited);
        if (remainder !== undefined) {
          return [manifest, ...remainder];
        }
      }
      return undefined;
    };
    return search(sourceSnapshotId, new Set());
  },
  validateGraph = (manifests: readonly Manifest[]): void => {
    const manifestIds = new Set<string>(),
      snapshots = new Set(
        manifests.flatMap((manifest) => [manifest.sourceSnapshotId, manifest.targetSnapshotId]),
      );
    for (const manifest of manifests) {
      if (manifestIds.has(manifest.id)) {
        throw InvalidInput.make({ message: `Migration Manifest ${manifest.id} is duplicated` });
      }
      manifestIds.add(manifest.id);
      if (manifest.sourceSnapshotId === manifest.targetSnapshotId) {
        throw InvalidInput.make({ message: "Migration graph cannot contain self edges" });
      }
    }
    validateSnapshotPairs(manifests, snapshots);
  },
  validateManifestSnapshots = (
    manifest: Manifest,
    source: CompiledSnapshot,
    target: CompiledSnapshot,
  ): void => {
    if (
      manifest.sourceSnapshotId !== source.snapshotId ||
      manifest.targetSnapshotId !== target.snapshotId
    ) {
      throw InvalidInput.make({
        message: "Migration Manifest does not match the source and target Definition Snapshots",
      });
    }
  },
  validateSnapshotPairs = (
    manifests: readonly Manifest[],
    snapshots: ReadonlySet<string>,
  ): void => {
    for (const sourceSnapshotId of snapshots) {
      for (const targetSnapshotId of snapshots) {
        if (
          sourceSnapshotId !== targetSnapshotId &&
          pathCount({
            manifests,
            sourceSnapshotId,
            targetSnapshotId,
            visited: new Set(),
          }) > SINGLE_PATH
        ) {
          throw InvalidInput.make({
            message: `Migration graph is ambiguous between ${sourceSnapshotId} and ${targetSnapshotId}`,
          });
        }
      }
    }
  };

export default {
  NO_PATHS,
  SINGLE_PATH,
  appendMigrationIssue,
  finalizePreparation,
  findMigrationHandler,
  migrateEntryValues,
  missingHandlerPreparation,
  pathCount,
  searchMigrationPath,
  validateGraph,
  validateManifestSnapshots,
  validateSnapshotPairs,
};
