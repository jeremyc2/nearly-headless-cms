import { Conflict, InvalidInput, type ValidationIssue } from "./cms-error.ts";
import type {
  Handler,
  Manifest,
  Preparation,
  PreparationInput,
} from "./definition-migration-types.ts";
import type { Representation } from "./entry.ts";
import { dual } from "effect/Function";
import migrationHelpers from "./definition-migration-helpers.ts";

export type {
  Handler,
  HandlerInput,
  Manifest,
  Preparation,
  PreparationInput,
  PreparationReport,
  SerializableManifest,
} from "./definition-migration-types.ts";

/** Rejects a preparation whose source Entry generation has changed. */
const // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
  assertFresh = dual(2, (preparation: Preparation, currentGeneration: number): void => {
    if (preparation.sourceGeneration !== currentGeneration) {
      throw Conflict.make({
        message: "Migration Preparation is stale because the source generation changed",
      });
    }
    if (preparation.report.status !== "ready") {
      throw InvalidInput.make({ message: "A failed Migration Preparation cannot be cut over" });
    }
  }),
  migrateEntries = (
    entries: PreparationInput["entries"],
    handler: Handler | undefined,
    input: PreparationInput,
  ): { issues: ValidationIssue[]; transformedEntries: Representation[] } => {
    const issues: ValidationIssue[] = [],
      transformedEntries: Representation[] = [];
    for (const entry of entries) {
      try {
        const validatedValues = migrationHelpers.migrateEntryValues(entry, handler, input);
        transformedEntries.push({
          contentTypeId: entry.contentTypeId,
          id: entry.id,
          values: validatedValues,
        });
      } catch (error) {
        migrationHelpers.appendMigrationIssue(issues, entry, error);
      }
    }
    return { issues, transformedEntries };
  },
  /** Resolves the unique ordered migration path between two snapshots. */
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
  path = dual(
    3,
    (
      manifests: readonly Manifest[],
      sourceSnapshotId: string,
      targetSnapshotId: string,
    ): readonly Manifest[] => {
      migrationHelpers.validateGraph(manifests);
      const found = migrationHelpers.searchMigrationPath(
        manifests,
        sourceSnapshotId,
        targetSnapshotId,
      );
      if (found === undefined) {
        throw InvalidInput.make({
          message: `No Migration Path exists from ${sourceSnapshotId} to ${targetSnapshotId}`,
        });
      }
      return found;
    },
  ),
  /** Deterministically prepares every live Entry without modifying durable state. */
  prepare = (input: PreparationInput): Preparation => {
    migrationHelpers.validateManifestSnapshots(input.manifest, input.source, input.target);
    if (
      migrationHelpers.findMigrationHandler(input.handlers, input.manifest) === undefined &&
      input.manifest.compatible !== true
    ) {
      return migrationHelpers.missingHandlerPreparation(input);
    }
    const handler = migrationHelpers.findMigrationHandler(input.handlers, input.manifest),
      { issues, transformedEntries } = migrateEntries(input.entries, handler, input);
    return migrationHelpers.finalizePreparation(input, transformedEntries, issues);
  },
  {validateGraph} = migrationHelpers;

export { assertFresh, path, prepare, validateGraph };
