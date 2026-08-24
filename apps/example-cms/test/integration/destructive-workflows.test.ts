import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ExampleSystem } from "../../src/system.ts";
import { createExampleSystem } from "../../src/system.ts";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  jsonRecord = async (response: Response): Promise<Readonly<Record<string, unknown>>> => {
    const body: unknown = await response.json();
    if (!isRecord(body)) {
      throw new Error("Expected a JSON object");
    }
    return body;
  };

describe("Example CMS destructive workflows", () => {
  let system: ExampleSystem;
  let storageRoot: string;

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
      authors = exported["authors"],
      posts = exported["posts"];
    if (!Array.isArray(authors) || !isRecord(authors[0]) || typeof authors[0]["id"] !== "string") {
      throw new Error("Expected a seeded Author");
    }
    if (!Array.isArray(posts) || !isRecord(posts[0]) || typeof posts[0]["id"] !== "string") {
      throw new Error("Expected a seeded Post");
    }
    const authorId = authors[0]["id"],
      authorState = await jsonRecord(
        await system.handler(
          new Request(
            `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/author/entries/${authorId}/state`,
          ),
        ),
      ),
      writeToken = authorState["writeToken"];
    if (typeof writeToken !== "string") {
      throw new Error("Expected an Author Write Token");
    }
    const response = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/authors/${authorId}/cascade-deletions`,
          { headers: { "cms-write-token": writeToken }, method: "POST" },
        ),
      ),
      receipt = await jsonRecord(response);
    expect(response.status).toBe(200);
    expect(receipt).toMatchObject({
      deletedAuthorId: authorId,
      deletedCommentCount: 2,
      deletedPostCount: 2,
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
              pageSize: 100,
              where: { operator: "equals", path: "author", value: authorId },
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      ),
      postPage = await jsonRecord(postQuery);
    expect(authorLookup.status).toBe(404);
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
      throw new Error("Expected an ingested Asset identifier");
    }
    const draftPostId = system.seed!.draftPostId,
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
    expect(assigned.status).toBe(200);

    const deletion = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${assetId}/assignment-clearing-deletions`,
          { headers: { "idempotency-key": "delete-temporary-image" }, method: "POST" },
        ),
      ),
      receipt = await jsonRecord(deletion);
    expect(deletion.status).toBe(200);
    expect(receipt).toMatchObject({
      clearedAuthorCount: 0,
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
    expect(assetLookup.status).toBe(404);
  });
});
