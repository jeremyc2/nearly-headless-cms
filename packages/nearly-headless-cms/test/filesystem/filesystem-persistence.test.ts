import { describe, test } from "bun:test";
import {
  verifyBoundedAssetStream,
  verifyDurableCatalogCutover,
  verifyEntryAndAssetRecovery,
  verifyStreamingStageCancellation,
  verifyWriterEnforcement,
  verifyWriterLockRecovery,
} from "./filesystem-persistence-scenarios.ts";

describe("BunFilesystemPersistence", () => {
  test("durably commits the Definition Catalog and Entry generation in one cutover", () =>
    verifyDurableCatalogCutover());

  test("recovers committed Entry generations and digest-verified Assets after restart", () =>
    verifyEntryAndAssetRecovery());

  test("interrupts an oversized Asset stream at the configured bound", () =>
    verifyBoundedAssetStream());

  test("stages Asset chunks before the source completes and removes the stage on cancellation", () =>
    verifyStreamingStageCancellation());

  test("enforces one writer and only cleans the exact abandoned-staging convention", () =>
    verifyWriterEnforcement());

  test("recovers the writer lock after its owning process terminates", () =>
    verifyWriterLockRecovery());
});
