import { Conflict, InvalidInput, type ValidationIssue } from "./CmsError.ts";
import type { CompiledSnapshot } from "./ContentDefinition.ts";
import type { Representation } from "./Entry.ts";
import type { JsonObject, JsonValue } from "./internal/json.ts";

export interface Manifest {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly handlerIdentifier: string;
  readonly handlerVersion: number;
  readonly compatible?: boolean;
}

export interface HandlerInput {
  readonly entryId: string;
  readonly contentTypeId: string;
  readonly values: JsonObject;
  readonly manifest: Manifest;
}

export interface Handler {
  readonly identifier: string;
  readonly version: number;
  readonly transform: (input: HandlerInput) => JsonObject;
}

export interface PreparationInput {
  readonly source: CompiledSnapshot;
  readonly target: CompiledSnapshot;
  readonly sourceGeneration: number;
  readonly entries: readonly Representation[];
  readonly manifest: Manifest;
  readonly handlers: readonly Handler[];
}

export type PreparationReport =
  | { readonly status: "ready"; readonly transformedEntryCount: number }
  | { readonly status: "failed"; readonly issues: readonly ValidationIssue[] };

export interface Preparation {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly sourceGeneration: number;
  readonly manifest: Manifest;
  readonly entries: readonly Representation[];
  readonly report: PreparationReport;
}

const migrationIssue = (entryId: string, reason: string, message: string): ValidationIssue => ({
  message,
  path: ["entries", entryId],
  reason,
});

export const prepare = (input: PreparationInput): Preparation => {
  if (
    input.manifest.sourceSnapshotId !== input.source.snapshotId ||
    input.manifest.targetSnapshotId !== input.target.snapshotId
  ) {
    throw InvalidInput.make({
      message: "Migration Manifest does not match the source and target Definition Snapshots",
    });
  }
  const handler = input.handlers.find(
    (candidate) =>
      candidate.identifier === input.manifest.handlerIdentifier &&
      candidate.version === input.manifest.handlerVersion,
  );
  if (handler === undefined && !input.manifest.compatible) {
    return {
      entries: [],
      id: `${input.manifest.id}@${input.sourceGeneration}`,
      manifest: input.manifest,
      report: {
        issues: [
          migrationIssue(
            "*",
            "missingMigrationHandler",
            `Migration Handler ${input.manifest.handlerIdentifier}@${input.manifest.handlerVersion} is not registered`,
          ),
        ],
        status: "failed",
      },
      sourceGeneration: input.sourceGeneration,
      sourceSnapshotId: input.source.snapshotId,
      targetSnapshotId: input.target.snapshotId,
    };
  }
  const transformedEntries: Representation[] = [],
    issues: ValidationIssue[] = [];
  for (const entry of input.entries) {
    try {
      const transformedValues = input.manifest.compatible
          ? entry.values
          : handler!.transform({
              contentTypeId: entry.contentTypeId,
              entryId: entry.id,
              manifest: input.manifest,
              values: structuredClone(entry.values),
            }),
        validatedValues = input.target.validateEntry(entry.contentTypeId, transformedValues, {
          applyDefaults: false,
        });
      transformedEntries.push({
        contentTypeId: entry.contentTypeId,
        id: entry.id,
        values: validatedValues,
      });
    } catch (error) {
      if (error instanceof InvalidInput && error.issues !== undefined) {
        issues.push(
          ...error.issues.map((validationIssue) => ({
            ...validationIssue,
            path: ["entries", entry.id, ...validationIssue.path],
          })),
        );
      } else {
        issues.push(
          migrationIssue(
            entry.id,
            "migrationHandlerFailure",
            error instanceof Error ? error.message : "Migration Handler failed",
          ),
        );
      }
    }
  }
  return {
    entries: issues.length === 0 ? transformedEntries : [],
    id: `${input.manifest.id}@${input.sourceGeneration}`,
    manifest: input.manifest,
    report:
      issues.length === 0
        ? { status: "ready", transformedEntryCount: transformedEntries.length }
        : { issues, status: "failed" },
    sourceGeneration: input.sourceGeneration,
    sourceSnapshotId: input.source.snapshotId,
    targetSnapshotId: input.target.snapshotId,
  };
};

export const assertFresh = (preparation: Preparation, currentGeneration: number): void => {
  if (preparation.sourceGeneration !== currentGeneration) {
    throw Conflict.make({
      message: "Migration Preparation is stale because the source generation changed",
    });
  }
  if (preparation.report.status !== "ready") {
    throw InvalidInput.make({ message: "A failed Migration Preparation cannot be cut over" });
  }
};

const pathCount = (
  manifests: readonly Manifest[],
  sourceSnapshotId: string,
  targetSnapshotId: string,
  visited: ReadonlySet<string>,
): number => {
  if (sourceSnapshotId === targetSnapshotId) {
    return 1;
  }
  if (visited.has(sourceSnapshotId)) {
    return 0;
  }
  let count = 0;
  const nextVisited = new Set(visited).add(sourceSnapshotId);
  for (const manifest of manifests.filter(
    (candidate) => candidate.sourceSnapshotId === sourceSnapshotId,
  )) {
    count += pathCount(manifests, manifest.targetSnapshotId, targetSnapshotId, nextVisited);
    if (count > 1) {
      return count;
    }
  }
  return count;
};

export const validateGraph = (manifests: readonly Manifest[]): void => {
  const manifestIds = new Set<string>();
  for (const manifest of manifests) {
    if (manifestIds.has(manifest.id)) {
      throw InvalidInput.make({ message: `Migration Manifest ${manifest.id} is duplicated` });
    }
    manifestIds.add(manifest.id);
    if (manifest.sourceSnapshotId === manifest.targetSnapshotId) {
      throw InvalidInput.make({ message: "Migration graph cannot contain self edges" });
    }
  }
  const snapshots = new Set(
    manifests.flatMap((manifest) => [manifest.sourceSnapshotId, manifest.targetSnapshotId]),
  );
  for (const sourceSnapshotId of snapshots) {
    for (const targetSnapshotId of snapshots) {
      if (
        sourceSnapshotId !== targetSnapshotId &&
        pathCount(manifests, sourceSnapshotId, targetSnapshotId, new Set()) > 1
      ) {
        throw InvalidInput.make({
          message: `Migration graph is ambiguous between ${sourceSnapshotId} and ${targetSnapshotId}`,
        });
      }
    }
  }
};

export const path = (
  manifests: readonly Manifest[],
  sourceSnapshotId: string,
  targetSnapshotId: string,
): readonly Manifest[] => {
  validateGraph(manifests);
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
      const nextVisited = new Set(visited).add(currentSnapshotId);
      for (const manifest of manifests.filter(
        (candidate) => candidate.sourceSnapshotId === currentSnapshotId,
      )) {
        const remainder = search(manifest.targetSnapshotId, nextVisited);
        if (remainder !== undefined) {
          return [manifest, ...remainder];
        }
      }
      return undefined;
    },
    found = search(sourceSnapshotId, new Set());
  if (found === undefined) {
    throw InvalidInput.make({
      message: `No Migration Path exists from ${sourceSnapshotId} to ${targetSnapshotId}`,
    });
  }
  return found;
};

export interface SerializableManifest extends Omit<Manifest, "compatible"> {
  readonly compatible?: boolean;
  readonly metadata?: JsonValue;
}
