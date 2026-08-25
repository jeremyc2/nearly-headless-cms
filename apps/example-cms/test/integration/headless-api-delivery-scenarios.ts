import {
  type HeadlessApiHandler,
  exportUrl,
  firstItemIndex,
  httpBadRequest,
  httpCreated,
  httpNotFound,
  httpNotModified,
  httpOk,
  httpPartialContent,
  isRecord,
  jsonRecord,
  tenBytes,
} from "./headless-api-support.ts";
import { expect } from "bun:test";

const readExport = (handler: HeadlessApiHandler): Promise<Readonly<Record<string, unknown>>> =>
    Promise.resolve(handler(new Request(exportUrl))).then(jsonRecord),
  readFirstAssetId = (exported: Readonly<Record<string, unknown>>): string => {
    const { assets } = exported;
    if (!Array.isArray(assets) || !isRecord(assets[firstItemIndex])) {
      throw new TypeError("Expected at least one exported Asset");
    }
    return readStringField(assets[firstItemIndex], "id");
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- helper intentionally awaits native HTTP promises.
  readFirstPostId = async (handler: HeadlessApiHandler): Promise<string> => {
    const exported = await readExport(handler),
      { posts } = exported;
    if (!Array.isArray(posts) || !isRecord(posts[firstItemIndex])) {
      throw new TypeError("Expected at least one exported Post");
    }
    return readStringField(posts[firstItemIndex], "id");
  },
  readStringField = (record: Readonly<Record<string, unknown>>, key: string): string => {
    const value = record[key];
    if (typeof value !== "string") {
      throw new TypeError(`Expected string field ${key}`);
    }
    return value;
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- helper intentionally awaits native HTTP promises.
  submitCommentTwice = async (
    handler: HeadlessApiHandler,
    postId: string,
  ): Promise<{
    readonly receiptFirst: Readonly<Record<string, unknown>>;
    readonly receiptSecond: Readonly<Record<string, unknown>>;
    readonly responseFirst: Response;
  }> => {
    const requestComment = () =>
        new Request(`http://cms.test/api/v1/headless/posts/${postId}/comments`, {
          body: JSON.stringify({
            body: "Thoughtful post.",
            displayName: "Reader",
            websiteUrl: "https://example.com",
          }),
          headers: { "content-type": "application/json", "idempotency-key": "comment-key-1" },
          method: "POST",
        }),
      responseFirst = await handler(requestComment()),
      responseSecond = await handler(requestComment());
    return {
      receiptFirst: await jsonRecord(responseFirst),
      receiptSecond: await jsonRecord(responseSecond),
      responseFirst,
    };
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyAssetByteRanges = async (handler: HeadlessApiHandler): Promise<void> => {
    const assetId = readFirstAssetId(await readExport(handler)),
      assetUrl = `http://cms.test/api/v1/headless/assets/${assetId}`,
      head = await handler(new Request(assetUrl, { method: "HEAD" })),
      partial = await handler(
        new Request(assetUrl, {
          headers: { range: "bytes=0-9" },
        }),
      ),
      partialBody = await partial.arrayBuffer();
    expect(head.status).toBe(httpOk);
    expect(head.headers.get("accept-ranges")).toBe("bytes");
    expect(partial.status).toBe(httpPartialContent);
    expect(partialBody.byteLength).toBe(tenBytes);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyBoundedListingsAndAssets = async (handler: HeadlessApiHandler): Promise<void> => {
    await verifyInvalidPageSize(handler);
    await verifyConditionalExport(handler);
    await verifyAssetByteRanges(handler);
    await verifyDraftPostNotFound(handler);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyCommentIdempotency = async (handler: HeadlessApiHandler): Promise<void> => {
    const postId = await readFirstPostId(handler),
      submission = await submitCommentTwice(handler, postId);
    expect(submission.responseFirst.status).toBe(httpCreated);
    expect(submission.receiptSecond).toEqual(submission.receiptFirst);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyConditionalExport = async (handler: HeadlessApiHandler): Promise<void> => {
    const responseExport = await handler(new Request(exportUrl)),
      responseExportCached = await handler(
        new Request(exportUrl, {
          headers: { "if-none-match": responseExport.headers.get("etag") ?? "" },
        }),
      );
    expect(responseExport.headers.get("etag")).not.toBeNull();
    expect(responseExportCached.status).toBe(httpNotModified);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyDraftPostNotFound = async (handler: HeadlessApiHandler): Promise<void> => {
    const draft = await handler(
      new Request("http://cms.test/api/v1/headless/posts/the-unfinished-map"),
    );
    expect(draft.status).toBe(httpNotFound);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyInvalidPageSize = async (handler: HeadlessApiHandler): Promise<void> => {
    const invalidPage = await handler(
      new Request("http://cms.test/api/v1/headless/posts?pageSize=0"),
    );
    expect(invalidPage.status).toBe(httpBadRequest);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyPublicExportEligibility = async (handler: HeadlessApiHandler): Promise<void> => {
    const exported = await readExport(handler),
      { comments, posts } = exported;
    if (!Array.isArray(posts) || !Array.isArray(comments)) {
      throw new TypeError("Expected posts and comments arrays in export");
    }
    expect(posts.length).toBeGreaterThan(firstItemIndex);
    expect(posts.every((post) => isRecord(post) && post["status"] === "published")).toBeTrue();
    expect(
      comments.every((comment) => isRecord(comment) && comment["status"] === "approved"),
    ).toBeTrue();
  };

export { verifyBoundedListingsAndAssets, verifyCommentIdempotency, verifyPublicExportEligibility };
