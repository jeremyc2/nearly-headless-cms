import {
  type ExampleSystem,
  afterAll,
  beforeAll,
  createExampleSystem,
  describe,
  test,
  verifyBoundedListingsAndAssets,
  verifyCommentIdempotency,
  verifyDetachmentAndCascadeCommands,
  verifyEditorialManagementCommands,
  verifyHiddenUnpublishedReachability,
  verifyPublicExportEligibility,
} from "./complete-system-journeys-scenarios-imports.ts";

const journeyContext: { system: ExampleSystem | undefined } = { system: undefined },
  requireJourneySystem = (): ExampleSystem => {
    const { system } = journeyContext;
    if (system === undefined) {
      throw new Error("Expected complete-system journey fixture");
    }
    return system;
  },
  temporaryStorageRoot = (): Promise<string> =>
    Bun.$`mktemp -d ${import.meta.dir}/.complete-system-journey-XXXXXX`.text().then((output) =>
      output.trim(),
    );

describe("complete-system journeys", () => {
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-007] Bun lifecycle hook performs async system setup.
  beforeAll(async () => {
    journeyContext.system = await createExampleSystem({
      seed: true,
      storageRoot: await temporaryStorageRoot(),
    });
  });

  // oxlint-disable-next-line effecttsgo/async-function -- [EH-006] Bun lifecycle hook performs async cleanup.
  afterAll(async () => {
    const { system } = journeyContext;
    if (system !== undefined) {
      await system.dispose();
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
    return verifyDetachmentAndCascadeCommands(system).then(() =>
      verifyBoundedListingsAndAssets(system.handler),
    );
  });
});
