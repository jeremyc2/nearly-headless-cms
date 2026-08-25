import {
  type ExampleSystem,
  firstItemIndex,
  httpNotFound,
  httpOk,
  isRecord,
  jsonRecord,
  pageSize,
  twoItems,
} from "./destructive-workflows-support.ts";
import { expect } from "bun:test";

const readAuthorId = (exported: Readonly<Record<string, unknown>>): string => {
    const { authors } = exported;
    if (!Array.isArray(authors) || !isRecord(authors[firstItemIndex])) {
      throw new Error("Expected a seeded Author");
    }
    return readStringField(authors[firstItemIndex], "id");
  },
  readExport = (system: ExampleSystem): Promise<Readonly<Record<string, unknown>>> =>
    Promise.resolve(system.handler(new Request("http://cms.test/api/v1/headless/export"))).then(
      jsonRecord,
    ),
  readPostId = (exported: Readonly<Record<string, unknown>>): string => {
    const { posts } = exported;
    if (!Array.isArray(posts) || !isRecord(posts[firstItemIndex])) {
      throw new Error("Expected a seeded Post");
    }
    return readStringField(posts[firstItemIndex], "id");
  },
  readPostQueryPage = (
    system: ExampleSystem,
    authorId: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    const queryBody = JSON.stringify({
      contentTypeId: "post",
      pageSize,
      where: { operator: "equals", path: "author", value: authorId },
    });
    return Promise.resolve(
      system.handler(
        new Request(
          "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/query",
          {
            body: queryBody,
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      ),
    ).then(jsonRecord);
  },
  readStringField = (record: Readonly<Record<string, unknown>>, key: string): string => {
    const value = record[key];
    if (typeof value !== "string") {
      throw new TypeError(`Expected string field ${key}`);
    }
    return value;
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-060] scenario intentionally awaits native HTTP promises.
  verifyAuthorCascadeDeletion = async (system: ExampleSystem): Promise<void> => {
    const aExported = await readExport(system),
      bAuthorId = readAuthorId(aExported),
      cAuthorStateResponse = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/author/entries/${bAuthorId}/state`,
        ),
      ),
      dAuthorState = await jsonRecord(cAuthorStateResponse),
      eCascadeResponse = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/authors/${bAuthorId}/cascade-deletions`,
          {
            headers: { "cms-write-token": readStringField(dAuthorState, "writeToken") },
            method: "POST",
          },
        ),
      ),
      fPostPage = await readPostQueryPage(system, bAuthorId),
      gReceipt = await jsonRecord(eCascadeResponse),
      hAuthorLookupResponse = await verifyAuthorLookup(system, bAuthorId);
    readPostId(aExported);
    expect(eCascadeResponse.status).toBe(httpOk);
    expect(gReceipt).toMatchObject({
      deletedAuthorId: bAuthorId,
      deletedCommentCount: twoItems,
      deletedPostCount: twoItems,
      deletionRecord: {
        contentTypeId: "author",
        entryId: bAuthorId,
      },
    });
    if (isRecord(gReceipt["deletionRecord"])) {
      expect(typeof gReceipt["deletionRecord"]["writeToken"]).toBe("string");
    }
    expect(hAuthorLookupResponse.status).toBe(httpNotFound);
    expect(fPostPage["items"]).toEqual([]);
  },
  verifyAuthorLookup = (system: ExampleSystem, authorId: string): Promise<Response> =>
    system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/author/entries/${authorId}`,
      ),
    );

export { verifyAuthorCascadeDeletion };
