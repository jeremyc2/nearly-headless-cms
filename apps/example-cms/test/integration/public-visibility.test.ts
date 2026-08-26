import { afterAll, beforeAll, describe, test } from "bun:test";
import {
  createPublicVisibilityFixture,
  disposePublicVisibilityFixture,
  verifyCompleteExportPagination,
  verifyHiddenUnpublishedReachability,
} from "./public-visibility-scenarios.ts";
import { exportTimeoutMilliseconds } from "./public-visibility-support.ts";

type PublicVisibilityFixture = Awaited<ReturnType<typeof createPublicVisibilityFixture>>;

const publicVisibilityContext: { fixture: PublicVisibilityFixture | undefined } = {
    fixture: undefined,
  },
  requirePublicVisibilityFixture = (): PublicVisibilityFixture => {
    const { fixture } = publicVisibilityContext;
    if (fixture === undefined) {
      throw new Error("Expected public visibility fixture");
    }
    return fixture;
  };

describe("Example CMS public visibility", () => {
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-009] Bun lifecycle hook performs async system setup.
  beforeAll(async () => {
    publicVisibilityContext.fixture = await createPublicVisibilityFixture(import.meta.dir);
  });

  // oxlint-disable-next-line effecttsgo/async-function -- [EH-008] Bun lifecycle hook performs async cleanup.
  afterAll(async () => {
    const { fixture } = publicVisibilityContext;
    if (fixture !== undefined) {
      await disposePublicVisibilityFixture(fixture);
    }
  });

  test(
    "exports every public Entry across internal query pages",
    () => verifyCompleteExportPagination(requirePublicVisibilityFixture().system.handler),
    exportTimeoutMilliseconds,
  );

  test("hides Comments, taxonomies, and Entry references outside published reachability", () =>
    verifyHiddenUnpublishedReachability(requirePublicVisibilityFixture().system));
});
