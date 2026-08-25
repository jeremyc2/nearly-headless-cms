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
  verifyConcurrentAssetReads,
  verifyReadOnlyBlobDirectorySurfacesPermissionFailure,
  verifySymlinkedBlobIsNotServedAsContent,
} from "./filesystem-concurrency-fault-scenarios.ts";

describe("BunFilesystemPersistence", () => {
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

  test("serves concurrent Asset reads without cross-talk", () => verifyConcurrentAssetReads());

  test("classifies read-only blob directory failures during ingest", () =>
    verifyReadOnlyBlobDirectorySurfacesPermissionFailure());

  test("rejects symlinked committed blobs that would escape the private layout", () =>
    verifySymlinkedBlobIsNotServedAsContent());
});
