import {
  type DestructiveWorkflowsFixture,
  createDestructiveWorkflowsFixture,
  verifyAssetAssignmentClearingDeletion,
  verifyAuthorCascadeDeletion,
  verifyImageReplacementMultipart,
} from "./destructive-workflows-scenarios.ts";
import { afterEach, beforeEach, describe, test } from "bun:test";

const destructiveWorkflowsContext: { fixture: DestructiveWorkflowsFixture | undefined } = {
    fixture: undefined,
  },
  requireDestructiveWorkflowsFixture = (): DestructiveWorkflowsFixture => {
    const { fixture } = destructiveWorkflowsContext;
    if (fixture === undefined) {
      throw new Error("Expected destructive workflows fixture");
    }
    return fixture;
  };

describe("Example CMS destructive workflows", () => {
  // oxlint-disable-next-line effecttsgo/async-function -- Bun lifecycle hook performs async system setup.
  beforeEach(async () => {
    destructiveWorkflowsContext.fixture = await createDestructiveWorkflowsFixture(import.meta.dir);
  });

  // oxlint-disable-next-line effecttsgo/async-function -- Bun lifecycle hook performs async cleanup.
  afterEach(async () => {
    const { fixture } = destructiveWorkflowsContext;
    if (fixture !== undefined) {
      await fixture.dispose();
    }
  });

  test("deleting an Author atomically deletes their Posts and Comments", () =>
    verifyAuthorCascadeDeletion(requireDestructiveWorkflowsFixture().system));

  test("deleting an image clears optional assignments before deleting the Asset", () =>
    verifyAssetAssignmentClearingDeletion(requireDestructiveWorkflowsFixture().system));

  test("declares image replacement as multipart for generated Management clients", () =>
    verifyImageReplacementMultipart(requireDestructiveWorkflowsFixture().system));
});
