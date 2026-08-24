import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";

const HTTP_NOT_FOUND = 404,
  HTTP_OK = 200,
  PAGE_SIZE = 100,
  TWO = 2,
  ZERO = 0,

 isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  jsonRecord = async (response: Response): Promise<Readonly<Record<string, unknown>>> => {
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error("Expected a JSON object");
    }
    return body;
  };

describe("Example CMS destructive workflows", () => {
  let storageRoot: string, system: ExampleSystem;

  beforeEach(async () => {
    storageRoot = await mkdtemp(join(import.meta.dir, ".destructive-workflows-"));
    system = await createExampleSystem({ seed: true, storageRoot });
  });

  afterEach(async () => {
    await system.dispose();
    await rm(storageRoot, { force: true, recursive: true });
  });

  test("deleting an Author atomically deletes their Posts and Comments", async () => {
    const exported = await jsonRecord(
        await system.handler(new Request("http://cms.test/api/v1/headless/export")),
      ),
      { authors } = exported,
      { posts } = exported;
    if (!Array.isArray(authors) || !isRecord(authors[ZERO]) || typeof authors[ZERO]["id"] !== "string") {
      throw new Error("Expected a seeded Author");
    }
    if (!Array.isArray(posts) || !isRecord(posts[ZERO]) || typeof posts[ZERO]["id"] !== "string") {
      throw new Error("Expected a seeded Post");
    }
    const authorId = authors[ZERO]["id"],
      authorState = await jsonRecord(
        await system.handler(
          new Request(
            `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/author/entries/${authorId}/state`,
          ),
        ),
      ),
      { writeToken } = authorState;
    if (typeof writeToken !== "string") {
      throw new TypeError("Expected an Author Write Token");
    }
    const response = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/authors/${authorId}/cascade-deletions`,
          { headers: { "cms-write-token": writeToken }, method: "POST" },
        ),
      ),
      receipt = await jsonRecord(response);
    expect(response.status).toBe(HTTP_OK);
    expect(receipt).toMatchObject({
      deletedAuthorId: authorId,
      deletedCommentCount: TWO,
      deletedPostCount: TWO,
      deletionRecord: {
        contentTypeId: "author",
        entryId: authorId,
        writeToken: expect.any(String),
      },
    });

    const authorLookup = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/author/entries/${authorId}`,
        ),
      ),
      postQuery = await system.handler(
        new Request(
          "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/query",
          {
            body: JSON.stringify({
              contentTypeId: "post",
              pageSize: PAGE_SIZE,
              where: { operator: "equals", path: "author", value: authorId },
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      ),
      postPage = await jsonRecord(postQuery);
    expect(authorLookup.status).toBe(HTTP_NOT_FOUND);
    expect(postPage["items"]).toEqual([]);
  });

  test("deleting an image clears optional assignments before deleting the Asset", async () => {
    const form = new FormData();
    form.set(
      "metadata",
      JSON.stringify({
        defaultAlternativeText: "A temporary illustration",
        filename: "temporary.svg",
        height: 20,
        mediaType: "image/svg+xml",
        width: 20,
      }),
    );
    form.set(
      "content",
      new File(
        [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
        "temporary.svg",
        { type: "image/svg+xml" },
      ),
    );
    const ingestion = await system.handler(
        new Request("http://cms.test/api/v1/management/definition-spaces/example-blog/assets", {
          body: form,
          method: "POST",
        }),
      ),
      asset = await jsonRecord(ingestion),
      assetId = asset["id"];
    if (typeof assetId !== "string") {
      throw new TypeError("Expected an ingested Asset identifier");
    }
    if (system.seed === undefined) {
      throw new Error("Expected a seeded Example System");
    }
    const { draftPostId } = system.seed,
      draftStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${draftPostId}/state`,
      draftEntryUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${draftPostId}`,
      draftState = await jsonRecord(await system.handler(new Request(draftStateUrl))),
      draftEntry = draftState["entry"],
      draftWriteToken = draftState["writeToken"];
    if (
      !isRecord(draftEntry) ||
      !isRecord(draftEntry["values"]) ||
      typeof draftWriteToken !== "string"
    ) {
      throw new Error("Expected a draft Post Current Entry State");
    }
    const assigned = await system.handler(
      new Request(draftEntryUrl, {
        body: JSON.stringify({
          values: {
            ...draftEntry["values"],
            "featured-alternative-text": "A temporary illustration",
            "featured-asset": assetId,
          },
        }),
        headers: { "cms-write-token": draftWriteToken, "content-type": "application/json" },
        method: "PUT",
      }),
    );
    expect(assigned.status).toBe(HTTP_OK);

    const deletion = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${assetId}/assignment-clearing-deletions`,
          { headers: { "idempotency-key": "delete-temporary-image" }, method: "POST" },
        ),
      ),
      receipt = await jsonRecord(deletion);
    expect(deletion.status).toBe(HTTP_OK);
    expect(receipt).toMatchObject({
      clearedAuthorCount: ZERO,
      clearedPostCount: 1,
      deletedAssetId: assetId,
      deletionCompleted: true,
    });
    const repeatedDeletion = await system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${assetId}/assignment-clearing-deletions`,
        { headers: { "idempotency-key": "delete-temporary-image" }, method: "POST" },
      ),
    );
    expect(await jsonRecord(repeatedDeletion)).toEqual(receipt);

    const updatedState = await jsonRecord(await system.handler(new Request(draftStateUrl))),
      updatedEntry = updatedState["entry"];
    if (!isRecord(updatedEntry) || !isRecord(updatedEntry["values"])) {
      throw new Error("Expected an updated draft Post");
    }
    expect(updatedEntry["values"]["featured-asset"]).toBeNull();
    expect(updatedEntry["values"]["featured-alternative-text"]).toBeNull();
    const assetLookup = await system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/assets/${assetId}`,
      ),
    );
    expect(assetLookup.status).toBe(HTTP_NOT_FOUND);
  });

  test("declares image replacement as multipart for generated Management clients", async () => {
    const document = await jsonRecord(
        await system.handler(new Request("http://cms.test/api/v1/management/openapi.json")),
      ),
      { paths } = document,
      replacementPath = isRecord(paths)
        ? paths[
            "/api/v1/management/definition-spaces/{definitionSpaceId}/operations/assets/{assetId}/replacements"
          ]
        : undefined,
      replacementPost = isRecord(replacementPath) ? replacementPath["post"] : undefined,
      requestBody = isRecord(replacementPost) ? replacementPost["requestBody"] : undefined,
      content = isRecord(requestBody) ? requestBody["content"] : undefined;
    expect(isRecord(content) && content["multipart/form-data"] !== undefined).toBeTrue();
  });
});
