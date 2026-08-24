import { Schema } from "effect";
import { dual } from "effect/Function";
import { Conflict, InvalidInput, type ValidationIssue } from "./cms-error.ts";
import type { CompiledSnapshot } from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import type { JsonObject, JsonValue } from "./internal/json.ts";

const NO_PATHS = 0,
  SINGLE_PATH = 1;

/** One directed, versioned Definition migration edge. */
export interface Manifest {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly handlerIdentifier: string;
  readonly handlerVersion: number;
  readonly compatible?: boolean;
}

/** Source Entry and snapshots supplied to a deterministic Migration Handler. */
export interface HandlerInput {
  readonly entryId: string;
  readonly contentTypeId: string;
  readonly values: JsonObject;
  readonly manifest: Manifest;
}

/** Builder-supplied deterministic one-to-one Entry migration capability. */
export interface Handler {
  readonly identifier: string;
  readonly version: number;
  readonly transform: (input: HandlerInput) => JsonObject;
}

/** Inputs for staging and validating a complete Definition migration. */
export interface PreparationInput {
  readonly source: CompiledSnapshot;
  readonly target: CompiledSnapshot;
  readonly sourceGeneration: number;
  readonly entries: readonly Representation[];
  readonly manifest: Manifest;
  readonly handlers: readonly Handler[];
}

/** Serializable success or failure report for one staged Entry migration. */
export type PreparationReport =
  | { readonly status: "ready"; readonly transformedEntryCount: number }
  | { readonly status: "failed"; readonly issues: readonly ValidationIssue[] };

/** Complete staged migration output tied to its source generation. */
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

/** Deterministically prepares every live Entry without modifying durable state. */
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
  if (handler === undefined && input.manifest.compatible !== true) {
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
      validatedValues = input.target.validateEntry(entry.contentTypeId, validatedValues, {
        applyDefaults: false,
      });
      transformedEntries.push({
        contentTypeId: entry.contentTypeId,
        id: entry.id,
        values: validatedValues,
      });
    } catch (error) {
      if (Schema.is(InvalidInput)(error) && error.issues !== undefined) {
        issues.push(
          ...error.issues.map((validationIssue) => ({
            ...validationIssue,
            path: ["entries", entry.id, ...validationIssue.path],
          })),
        );
      } else {
        let message = "Migration Handler failed";
        if (error instanceof Error) {
          message = error.message;
        }
        issues.push(
          migrationIssue(
            entry.id,
            "migrationHandlerFailure",
            message,
          ),
        );
      }
    }
  }
  let entries: readonly Representation[] = [],
   report: Preparation["report"];
  if (issues.length === NO_PATHS) {
    entries = transformedEntries;
    report = { status: "ready", transformedEntryCount: transformedEntries.length };
  } else {
    report = { issues, status: "failed" };
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
};

/** Rejects a preparation whose source Entry generation has changed. */
// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
export const assertFresh = dual(2, (preparation: Preparation, currentGeneration: number): void => {
  if (preparation.sourceGeneration !== currentGeneration) {
    throw Conflict.make({
      message: "Migration Preparation is stale because the source generation changed",
    });
  }
  if (preparation.report.status !== "ready") {
    throw InvalidInput.make({ message: "A failed Migration Preparation cannot be cut over" });
  }
});

interface PathCountInput {
  readonly manifests: readonly Manifest[];
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly visited: ReadonlySet<string>;
}

const pathCount = ({
  manifests,
  sourceSnapshotId,
  targetSnapshotId,
  visited,
}: PathCountInput): number => {
  if (sourceSnapshotId === targetSnapshotId) {
    return SINGLE_PATH;
  }
  if (visited.has(sourceSnapshotId)) {
    return NO_PATHS;
  }
  let count = NO_PATHS;
  const nextVisited = new Set(visited).add(sourceSnapshotId);
  for (const manifest of manifests.filter(
    (candidate) => candidate.sourceSnapshotId === sourceSnapshotId,
  )) {
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
};

/** Ensures migration edges form an unambiguous directed graph with at most one path. */
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
        pathCount({ manifests, sourceSnapshotId, targetSnapshotId, visited: new Set() }) >
          SINGLE_PATH
      ) {
        throw InvalidInput.make({
          message: `Migration graph is ambiguous between ${sourceSnapshotId} and ${targetSnapshotId}`,
        });
      }
    }
  }
};

/** Resolves the unique ordered migration path between two snapshots. */
// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
export const path = dual(3, (
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
});

/** Persistable Migration Manifest metadata without executable compatibility logic. */
export interface SerializableManifest extends Omit<Manifest, "compatible"> {
  readonly compatible?: boolean;
  readonly metadata?: JsonValue;
}
