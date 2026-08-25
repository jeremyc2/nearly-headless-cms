import {
  type ExampleSystem,
  afterAll,
  beforeAll,
  createExampleSystem,
  describe,
  join,
  mkdtemp,
  rm,
  test,
  tmpdir,
  verifyBoundedListingsAndAssets,
  verifyCommentIdempotency,
  verifyDefinitionMigrationJourney,
  verifyDetachmentAndCascadeCommands,
  verifyEditorialManagementCommands,
  verifyHiddenUnpublishedReachability,
  verifyPublicExportEligibility,
} from "./complete-system-journeys-scenarios-imports.ts";

const journeyContext: {
    storageRoot: string | undefined;
    system: ExampleSystem | undefined;
  } = { storageRoot: undefined, system: undefined },
  requireJourneySystem = (): ExampleSystem => {
    const { system } = journeyContext;
    if (system === undefined) {
      throw new Error("Expected complete-system journey fixture");
    }
    return system;
  };

describe("complete-system journeys", () => {
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-007] Bun lifecycle hook performs async system setup.
  beforeAll(async () => {
    const storageRoot = await mkdtemp(join(tmpdir(), "nearly-headless-cms-journey-"));
    journeyContext.storageRoot = storageRoot;
    journeyContext.system = await createExampleSystem({
      seed: true,
      storageRoot,
    });
  });

  // oxlint-disable-next-line effecttsgo/async-function -- [EH-006] Bun lifecycle hook performs async cleanup.
  afterAll(async () => {
    const { storageRoot, system } = journeyContext;
    if (system !== undefined) {
      await system.dispose();
    }
    if (storageRoot !== undefined) {
      await rm(storageRoot, { force: true, recursive: true });
    }
  });

  test("journeys 1-2: seeded public export eligibility and publication workflows", () => {
    const system = requireJourneySystem();
    return verifyPublicExportEligibility(system.handler).then(() =>
      verifyEditorialManagementCommands(system),
    );
  });

  test("journey 3: comment idempotency and moderation visibility boundaries", () => {
    const system = requireJourneySystem();
    return verifyCommentIdempotency(system.handler).then(() =>
      verifyHiddenUnpublishedReachability(system),
    );
  });

  test("journeys 4-6: stale write tokens, destructive workflows, and public asset delivery", () => {
    const system = requireJourneySystem();
    return verifyBoundedListingsAndAssets(system.handler).then(() =>
      verifyDetachmentAndCascadeCommands(system),
    );
  });

  test("journey 7: compatible definition change, stale migration preparation, and atomic cutover", () =>
    verifyDefinitionMigrationJourney());
});
