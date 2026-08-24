import { afterAll, beforeAll, describe, test } from "bun:test";
import {
  createHeadlessApiFixture,
  disposeHeadlessApiFixture,
  verifyBoundedListingsAndAssets,
  verifyCommentIdempotency,
  verifyCommentReceiptReplay,
  verifyDetachmentAndCascadeCommands,
  verifyEditorialManagementCommands,
  verifyPublicExportEligibility,
} from "./headless-api-scenarios.ts";

type HeadlessApiFixture = Awaited<ReturnType<typeof createHeadlessApiFixture>>;

const headlessApiContext: { fixture: HeadlessApiFixture | undefined } = { fixture: undefined },
  requireHeadlessApiFixture = (): HeadlessApiFixture => {
    const { fixture } = headlessApiContext;
    if (fixture === undefined) {
      throw new Error("Expected Headless API fixture");
    }
    return fixture;
  };

describe("Example CMS Headless API", () => {
  // oxlint-disable-next-line effecttsgo/async-function -- Bun lifecycle hook performs async system setup.
  beforeAll(async () => {
    headlessApiContext.fixture = await createHeadlessApiFixture(import.meta.dir);
  });

  // oxlint-disable-next-line effecttsgo/async-function -- Bun lifecycle hook performs async cleanup.
  afterAll(async () => {
    const { fixture } = headlessApiContext;
    if (fixture !== undefined) {
      await disposeHeadlessApiFixture(fixture);
    }
  });

  test("exports only public-eligible Posts and approved Comments", () =>
    verifyPublicExportEligibility(requireHeadlessApiFixture().system.handler));

  test("deduplicates pending Comment submission by idempotency key", () =>
    verifyCommentIdempotency(requireHeadlessApiFixture().system.handler));

  test("supports bounded listings, conditional export, and public Asset ranges", () =>
    verifyBoundedListingsAndAssets(requireHeadlessApiFixture().system.handler));

  test("exposes named editorial Management commands with Write Token concurrency", () =>
    verifyEditorialManagementCommands(requireHeadlessApiFixture().system));

  test("runs detachment, image replacement, and cascade deletion commands through safe commit boundaries", () =>
    verifyDetachmentAndCascadeCommands(requireHeadlessApiFixture().system));

  test("replays durable Comment receipts and Definition state after restart", () =>
    verifyCommentReceiptReplay(import.meta.dir));
});
