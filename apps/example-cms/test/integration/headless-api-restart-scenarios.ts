import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";
import {
  createTemporaryStorageRoot,
  httpOk,
  jsonRecord,
  removeStorageRoot,
  requirePublishedPostId,
} from "./headless-api-support.ts";
import { expect } from "bun:test";

const makeRestartCommentRequest = (postId: string): Request =>
    new Request(`http://cms.test/api/v1/headless/posts/${postId}/comments`, {
      body: JSON.stringify({ body: "Persist this receipt.", displayName: "Restart reader" }),
      headers: {
        "content-type": "application/json",
        "idempotency-key": "restart-comment-key",
      },
      method: "POST",
    }),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-037] helper intentionally awaits native HTTP promises.
  recordRestartComment = async (
    system: ExampleSystem,
  ): Promise<{
    readonly postId: string;
    readonly receipt: Readonly<Record<string, unknown>>;
  }> => {
    const postId = requirePublishedPostId(system),
      responseComment = await system.handler(makeRestartCommentRequest(postId));
    return { postId, receipt: await jsonRecord(responseComment) };
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-036] helper intentionally awaits native filesystem cleanup.
  restartSeededSystem = async (
    firstSystem: ExampleSystem,
    restartRoot: string,
  ): Promise<ExampleSystem> => {
    await firstSystem.dispose();
    return createExampleSystem({ storageRoot: restartRoot });
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-038] HTTP contract assertions intentionally await native promises.
  verifyCommentReceiptReplay = async (testDirectory: string): Promise<void> => {
    const aSetupRoot = await createTemporaryStorageRoot(testDirectory),
      bSetupFirstSystem = await createExampleSystem({ seed: true, storageRoot: aSetupRoot }),
      cSetupRestartComment = await recordRestartComment(bSetupFirstSystem),
      dRestartedSystem = await restartSeededSystem(bSetupFirstSystem, aSetupRoot);
    try {
      const replayedReceipt = await jsonRecord(
          await dRestartedSystem.handler(makeRestartCommentRequest(cSetupRestartComment.postId)),
        ),
        schemaResponse = await dRestartedSystem.handler(
          new Request("http://cms.test/api/v1/headless/schema"),
        );
      expect(replayedReceipt).toEqual(cSetupRestartComment.receipt);
      expect(schemaResponse.status).toBe(httpOk);
    } finally {
      await dRestartedSystem.dispose();
      await removeStorageRoot(aSetupRoot);
    }
  };

export { verifyCommentReceiptReplay };
