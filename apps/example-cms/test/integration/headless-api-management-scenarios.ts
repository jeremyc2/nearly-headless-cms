import {
  type HeadlessApiHandler,
  exportUrl,
  firstItemIndex,
  httpConflict,
  httpNotFound,
  httpOk,
  isRecord,
  jsonRecord,
  managementStateUrl,
  oneItem,
  requirePublishedPostId,
  requireWriteToken,
  twoItems,
} from "./headless-api-support.ts";
import { type ExampleSystem } from "../../src/system.ts";
import { expect } from "bun:test";

const makeReplacementForm = (): FormData => {
    const replacementForm = new FormData();
    replacementForm.set(
      "metadata",
      JSON.stringify({ filename: "replacement.svg", mediaType: "image/svg+xml" }),
    );
    replacementForm.set(
      "content",
      new File(['<svg xmlns="http://www.w3.org/2000/svg"/>'], "replacement.svg", {
        type: "image/svg+xml",
      }),
    );
    return replacementForm;
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-031] helper intentionally awaits native HTTP promises.
  readCascadeDeletionResults = async (
    system: ExampleSystem,
    postId: string,
    postWriteToken: string,
  ): Promise<{
    cascadeReceipt: Readonly<Record<string, unknown>>;
    cascaded: Response;
    deletedPostResponse: Response;
  }> => {
    const cascaded = await system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/cascade-deletions`,
        {
          headers: { "cms-write-token": postWriteToken },
          method: "POST",
        },
      ),
    );
    return {
      cascadeReceipt: await jsonRecord(cascaded),
      cascaded,
      deletedPostResponse: await system.handler(
        new Request("http://cms.test/api/v1/headless/posts/a-lighthouse-for-content"),
      ),
    };
  },
  readCategoryId = (exportBefore: Readonly<Record<string, unknown>>): string => {
    const { categories } = exportBefore;
    if (!Array.isArray(categories) || !isRecord(categories[firstItemIndex])) {
      throw new TypeError("Expected at least one exported Category");
    }
    return readStringField(categories[firstItemIndex], "id");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-031] helper intentionally awaits native HTTP promises.
  readCategoryWriteToken = async (
    handler: HeadlessApiHandler,
    exportBefore: Readonly<Record<string, unknown>>,
  ): Promise<{ categoryId: string; categoryWriteToken: string }> => {
    const categoryId = readCategoryId(exportBefore),
      categoryStateResponse = await handler(
        new Request(managementStateUrl("category", categoryId)),
      ),
      categoryWriteToken = requireWriteToken(await jsonRecord(categoryStateResponse));
    return { categoryId, categoryWriteToken };
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-031] helper intentionally awaits native HTTP promises.
  readDraftState = async (
    handler: HeadlessApiHandler,
    postId: string,
    writeToken: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    const returnedToDraft = await handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/draft-returns`,
        {
          headers: { "cms-write-token": writeToken },
          method: "POST",
        },
      ),
    );
    expect(returnedToDraft.status).toBe(httpOk);
    return jsonRecord(returnedToDraft);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-031] helper intentionally awaits native HTTP promises.
  readEditorialContext = async (
    system: ExampleSystem,
  ): Promise<{
    draftEntry: unknown;
    draftState: Readonly<Record<string, unknown>>;
    initialWriteToken: string;
    postId: string;
  }> => {
    const aPostId = requirePublishedPostId(system),
      bInitialPostState = await readPostState(system.handler, aPostId),
      cTokenInitialWrite = requireWriteToken(bInitialPostState),
      dWriteDraftState = await readDraftState(system.handler, aPostId, cTokenInitialWrite);
    return {
      draftEntry: dWriteDraftState["entry"],
      draftState: dWriteDraftState,
      initialWriteToken: cTokenInitialWrite,
      postId: aPostId,
    };
  },
  readExport = (handler: HeadlessApiHandler): Promise<Readonly<Record<string, unknown>>> =>
    Promise.resolve(handler(new Request(exportUrl))).then(jsonRecord),
  readFirstAssetId = (exportBefore: Readonly<Record<string, unknown>>): string => {
    const { assets } = exportBefore;
    if (!Array.isArray(assets) || !isRecord(assets[firstItemIndex])) {
      throw new TypeError("Expected at least one exported Asset");
    }
    return readStringField(assets[firstItemIndex], "id");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-031] helper intentionally awaits native HTTP promises.
  readPostState = async (
    handler: HeadlessApiHandler,
    postId: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    const postStateResponse = await handler(new Request(managementStateUrl("post", postId)));
    return jsonRecord(postStateResponse);
  },
  readStringField = (record: Readonly<Record<string, unknown>>, key: string): string => {
    const value = record[key];
    if (typeof value !== "string") {
      throw new TypeError(`Expected string field ${key}`);
    }
    return value;
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyCategoryDetachment = async (
    handler: HeadlessApiHandler,
    exportBefore: Readonly<Record<string, unknown>>,
  ): Promise<void> => {
    const categoryContext = await readCategoryWriteToken(handler, exportBefore),
      detached = await handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/categories/${categoryContext.categoryId}/detachments`,
          {
            headers: { "cms-write-token": categoryContext.categoryWriteToken },
            method: "POST",
          },
        ),
      ),
      detachedBody = await jsonRecord(detached);
    expect(detached.status).toBe(httpOk);
    expect(detachedBody["detachedPostCount"]).toBe(oneItem);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyDetachmentAndCascadeCommands = async (system: ExampleSystem): Promise<void> => {
    const exportBefore = await readExport(system.handler);
    await verifyCategoryDetachment(system.handler, exportBefore);
    await verifyImageReplacement(system.handler, exportBefore);
    await verifyPostCascadeDeletion(system);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyEditorialManagementCommands = async (system: ExampleSystem): Promise<void> => {
    const editorialContext = await readEditorialContext(system);
    if (
      !isRecord(editorialContext.draftEntry) ||
      !isRecord(editorialContext.draftEntry["values"])
    ) {
      throw new TypeError("Expected draft Entry values");
    }
    expect(editorialContext.draftEntry["values"]["status"]).toBe("draft");
    await verifyStalePublishRejected(
      system.handler,
      editorialContext.postId,
      editorialContext.initialWriteToken,
    );
    await verifyPublishWithFreshToken(
      system.handler,
      editorialContext.postId,
      editorialContext.draftState,
    );
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyImageReplacement = async (
    handler: HeadlessApiHandler,
    exportBefore: Readonly<Record<string, unknown>>,
  ): Promise<void> => {
    const oldAssetId = readFirstAssetId(exportBefore),
      replaced = await handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${oldAssetId}/replacements`,
          {
            body: makeReplacementForm(),
            headers: { "idempotency-key": "replace-seed-image" },
            method: "POST",
          },
        ),
      ),
      replacementReceipt = await jsonRecord(replaced);
    expect(replaced.status).toBe(httpOk);
    expect(replacementReceipt["newAssetId"]).not.toBe(oldAssetId);
    expect(replacementReceipt["reassignedEntryCount"]).toBe(twoItems);
    expect(replacementReceipt["oldAssetDeleted"]).toBeTrue();
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyPostCascadeDeletion = async (system: ExampleSystem): Promise<void> => {
    const postId = requirePublishedPostId(system),
      postWriteToken = requireWriteToken(await readPostState(system.handler, postId)),
      resultsCascade = await readCascadeDeletionResults(system, postId, postWriteToken);
    expect(resultsCascade.cascaded.status).toBe(httpOk);
    expect(resultsCascade.cascadeReceipt["deletedCommentCount"]).toBeGreaterThanOrEqual(twoItems);
    expect(resultsCascade.deletedPostResponse.status).toBe(httpNotFound);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyPublishWithFreshToken = async (
    handler: HeadlessApiHandler,
    postId: string,
    draftState: Readonly<Record<string, unknown>>,
  ): Promise<void> => {
    const published = await handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/publications`,
          {
            headers: { "cms-write-token": requireWriteToken(draftState) },
            method: "POST",
          },
        ),
      ),
      publishedBody = await jsonRecord(published),
      publishedEntry = publishedBody["entry"];
    expect(published.status).toBe(httpOk);
    if (!isRecord(publishedEntry) || !isRecord(publishedEntry["values"])) {
      throw new TypeError("Expected published Entry values");
    }
    expect(publishedEntry["values"]["status"]).toBe("published");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-032] HTTP contract assertions intentionally await native promises.
  verifyStalePublishRejected = async (
    handler: HeadlessApiHandler,
    postId: string,
    staleWriteToken: string,
  ): Promise<void> => {
    const stalePublish = await handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/publications`,
        {
          headers: { "cms-write-token": staleWriteToken },
          method: "POST",
        },
      ),
    );
    expect(stalePublish.status).toBe(httpConflict);
  };

export { verifyDetachmentAndCascadeCommands, verifyEditorialManagementCommands };
