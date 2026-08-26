import { afterAll, beforeAll, describe, test } from "bun:test";
import {
  createPublicationValidationFixture,
  disposePublicationValidationFixture,
  verifyFieldPathIssuesForPublication,
} from "./publication-validation-scenarios.ts";

type PublicationValidationFixture = Awaited<ReturnType<typeof createPublicationValidationFixture>>;

const publicationValidationContext: { fixture: PublicationValidationFixture | undefined } = {
    fixture: undefined,
  },
  requirePublicationValidationFixture = (): PublicationValidationFixture => {
    const { fixture } = publicationValidationContext;
    if (fixture === undefined) {
      throw new Error("Expected publication validation fixture");
    }
    return fixture;
  };

describe("Example CMS Post publication", () => {
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-009] Bun lifecycle hook performs async system setup.
  beforeAll(async () => {
    publicationValidationContext.fixture = await createPublicationValidationFixture(
      import.meta.dir,
    );
  });

  // oxlint-disable-next-line effecttsgo/async-function -- [EH-008] Bun lifecycle hook performs async cleanup.
  afterAll(async () => {
    const { fixture } = publicationValidationContext;
    if (fixture !== undefined) {
      await disposePublicationValidationFixture(fixture);
    }
  });

  test("returns Field-path issues for public image and live-reference rules", () =>
    verifyFieldPathIssuesForPublication(requirePublicationValidationFixture().system));
});
