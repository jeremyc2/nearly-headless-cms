import { describe, test } from "bun:test";
import {
  verifyBoundedAssetStream,
  verifyCorruptAssetClassification,
  verifyDurableCatalogCutover,
  verifyEntryAndAssetRecovery,
  verifyStreamingStageCancellation,
  verifyWriterEnforcement,
  verifyWriterLockRecovery,
} from "./filesystem-persistence-scenarios.ts";
import {
  verifyCommittedCorruptionPreservedOnRestart,
  verifyGenerationCommitPermissionFailure,
} from "./filesystem-fault-injection-scenarios.ts";
import {
  verifyConcurrentAssetReads,
  verifyReadOnlyBlobDirectorySurfacesPermissionFailure,
  verifySymlinkedBlobIsNotServedAsContent,
} from "./filesystem-concurrency-fault-scenarios.ts";
import {
  verifyOldOrNewEntryVisibility,
  verifySerializedEntryMutations,
  verifyStaleEntryGenerationConflict,
} from "./filesystem-commit-boundary-scenarios.ts";
// oxlint-disable-next-line eslint/sort-imports -- [EH-357] path-invariant scenarios follow the established filesystem test import grouping.
import {
  verifyAbandonedStagingPrefixCleanedOnRecovery,
  verifyCaseDistinctAssetFilenamesPreservedInMetadata,
  verifyUnexpectedRootEntryRejectedOnStartup,
  verifyUnicodeAssetFilenameRoundTrip,
} from "./filesystem-path-invariant-scenarios.ts";
import { verifyChildTerminationDuringEntryCommit } from "./filesystem-commit-boundary-child-scenarios.ts";
import { verifyManifestPublicationPermissionFailure } from "./filesystem-fault-injection-manifest-scenarios.ts";

describe("BunFilesystemPersistence macOS path invariants", () => {
  test("rejects unexpected committed-root entries during startup recovery", () =>
    verifyUnexpectedRootEntryRejectedOnStartup());

  test("cleans abandoned reserved staging-prefix entries during startup recovery", () =>
    verifyAbandonedStagingPrefixCleanedOnRecovery());

  test("round-trips Unicode Asset filenames through committed metadata", () =>
    verifyUnicodeAssetFilenameRoundTrip());

  test("preserves case-distinct Asset filenames independently in metadata", () =>
    verifyCaseDistinctAssetFilenamesPreservedInMetadata());
});

describe("BunFilesystemPersistence recovery and streaming", () => {
  test("durably commits the Definition Catalog and Entry generation in one cutover", () =>
    verifyDurableCatalogCutover());

  test("recovers committed Entry generations and digest-verified Assets after restart", () =>
    verifyEntryAndAssetRecovery());

  test("interrupts an oversized Asset stream at the configured bound", () =>
    verifyBoundedAssetStream());

  test("classifies committed Asset corruption when the byte stream is consumed", () =>
    verifyCorruptAssetClassification());

  test("stages Asset chunks before the source completes and removes the stage on cancellation", () =>
    verifyStreamingStageCancellation());

  test("enforces one writer and only cleans the exact abandoned-staging convention", () =>
    verifyWriterEnforcement());

  test("recovers the writer lock after its owning process terminates", () =>
    verifyWriterLockRecovery());
});

describe("BunFilesystemPersistence concurrency and commit boundaries", () => {
  test("serves concurrent Asset reads without cross-talk", () => verifyConcurrentAssetReads());

  test("classifies read-only blob directory failures during ingest", () =>
    verifyReadOnlyBlobDirectorySurfacesPermissionFailure());

  test("rejects symlinked committed blobs that would escape the private layout", () =>
    verifySymlinkedBlobIsNotServedAsContent());

  test("rejects stale Entry generation commits", () => verifyStaleEntryGenerationConflict());

  test("serializes Entry mutations and preserves the latest committed generation", () =>
    verifySerializedEntryMutations());

  test("exposes old-or-new Entry visibility across generation commits", () =>
    verifyOldOrNewEntryVisibility());

  test("recovers readable Entry state when a committing child is terminated mid-commit", () =>
    verifyChildTerminationDuringEntryCommit());
});

describe("BunFilesystemPersistence fault injection", () => {
  test("preserves committed corruption across restart instead of silently repairing it", () =>
    verifyCommittedCorruptionPreservedOnRestart());

  test("rejects generation commits when the generations directory is read-only", () =>
    verifyGenerationCommitPermissionFailure());

  test("rejects generation commits when manifest publication is obstructed", () =>
    verifyManifestPublicationPermissionFailure());
});
