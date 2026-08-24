import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";

const FIRST_INDEX = 0,
 HTTP_BAD_REQUEST = 400,
 HTTP_CONFLICT = 409,
 HTTP_CREATED = 201,
 HTTP_NOT_FOUND = 404,
 HTTP_NOT_MODIFIED = 304,
 HTTP_OK = 200,
 HTTP_PARTIAL_CONTENT = 206,
 ONE_ITEM = 1,
 TEN_BYTES = 10,
 TWO_ITEMS = 2,

 firstItem = <Item>(items: readonly Item[]): Item => {
  const item = items[FIRST_INDEX];
  if (item === undefined) {
    throw new Error("Expected at least one item");
  }
  return item;
};

describe("Example CMS Headless API", () => {
  let storageRoot: string, system: ExampleSystem;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(import.meta.dir, ".headless-api-"));
    system = await createExampleSystem({ seed: true, storageRoot });
  });

  afterAll(async () => {
    await system.dispose();
    await rm(storageRoot, { force: true, recursive: true });
  });

  test("exports only public-eligible Posts and approved Comments", async () => {
    const response = await system.handler(new Request("http://cms.test/api/v1/headless/export"));
    expect(response.status).toBe(HTTP_OK);
    const exported = (await response.json()) as {
      posts: readonly { status: string }[];
      comments: readonly { status: string }[];
    };
    expect(exported.posts.length).toBeGreaterThan(FIRST_INDEX);
    expect(exported.posts.every((post) => post.status === "published")).toBeTrue();
    expect(exported.comments.every((comment) => comment.status === "approved")).toBeTrue();
  });

  test("deduplicates pending Comment submission by idempotency key", async () => {
    const exportResponse = await system.handler(
        new Request("http://cms.test/api/v1/headless/export"),
      ),
      exported = (await exportResponse.json()) as { posts: readonly { id: string }[] },
      postId = firstItem(exported.posts).id,
      request = () =>
        new Request(`http://cms.test/api/v1/headless/posts/${postId}/comments`, {
          body: JSON.stringify({
            body: "Thoughtful post.",
            displayName: "Reader",
            websiteUrl: "https://example.com",
          }),
          headers: { "content-type": "application/json", "idempotency-key": "comment-key-1" },
          method: "POST",
        }),
      first = await system.handler(request()),
      second = await system.handler(request());
    expect(first.status).toBe(HTTP_CREATED);
    expect(await second.json()).toEqual(await first.json());
  });

  test("supports bounded listings, conditional export, and public Asset ranges", async () => {
    const invalidPage = await system.handler(
      new Request("http://cms.test/api/v1/headless/posts?pageSize=0"),
    );
    expect(invalidPage.status).toBe(HTTP_BAD_REQUEST);

    const exportedResponse = await system.handler(
        new Request("http://cms.test/api/v1/headless/export"),
      ),
      etag = exportedResponse.headers.get("etag");
    expect(etag).not.toBeNull();
    const exported = (await exportedResponse.json()) as {
        assets: readonly { id: string; metadata: { byteLength: number } }[];
      },
      notModified = await system.handler(
        new Request("http://cms.test/api/v1/headless/export", {
          headers: { "if-none-match": etag ?? "" },
        }),
      );
    expect(notModified.status).toBe(HTTP_NOT_MODIFIED);

    const assetId = firstItem(exported.assets).id,
      head = await system.handler(
        new Request(`http://cms.test/api/v1/headless/assets/${assetId}`, { method: "HEAD" }),
      );
    expect(head.status).toBe(HTTP_OK);
    expect(head.headers.get("accept-ranges")).toBe("bytes");
    const partial = await system.handler(
      new Request(`http://cms.test/api/v1/headless/assets/${assetId}`, {
        headers: { range: "bytes=0-9" },
      }),
    );
    expect(partial.status).toBe(HTTP_PARTIAL_CONTENT);
    const partialBody = await partial.arrayBuffer();
    expect(partialBody.byteLength).toBe(TEN_BYTES);

    const draft = await system.handler(
      new Request("http://cms.test/api/v1/headless/posts/the-unfinished-map"),
    );
    expect(draft.status).toBe(HTTP_NOT_FOUND);
  });

  test("exposes named editorial Management commands with Write Token concurrency", async () => {
    const postId = system.seed?.publishedPostId ?? "",
      statePath = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${postId}/state`,
      initialResponse = await system.handler(new Request(statePath)),
      initial = (await initialResponse.json()) as {
        writeToken: string;
      },
      returnedToDraft = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/draft-returns`,
          {
            headers: { "cms-write-token": initial.writeToken },
            method: "POST",
          },
        ),
      );
    expect(returnedToDraft.status).toBe(HTTP_OK);
    const draftState = (await returnedToDraft.json()) as {
      writeToken: string;
      entry: { values: { status: string } };
    };
    expect(draftState.entry.values.status).toBe("draft");
    const stalePublish = await system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/publications`,
        {
          headers: { "cms-write-token": initial.writeToken },
          method: "POST",
        },
      ),
    );
    expect(stalePublish.status).toBe(HTTP_CONFLICT);
    const published = await system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/publications`,
        {
          headers: { "cms-write-token": draftState.writeToken },
          method: "POST",
        },
      ),
    );
    expect(published.status).toBe(HTTP_OK);
    expect(
      ((await published.json()) as { entry: { values: { status: string } } }).entry.values.status,
    ).toBe("published");
  });

  test("runs detachment, image replacement, and cascade deletion commands through safe commit boundaries", async () => {
    const exportBeforeResponse = await system.handler(
        new Request("http://cms.test/api/v1/headless/export"),
      ),
      exportBefore = (await exportBeforeResponse.json()) as {
        assets: readonly { id: string }[];
        categories: readonly { id: string }[];
        posts: readonly { id: string; categories: readonly string[]; featuredAsset: string }[];
      },
      categoryId = firstItem(exportBefore.categories).id,
      categoryStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/category/entries/${categoryId}/state`,
      categoryStateResponse = await system.handler(new Request(categoryStateUrl)),
      categoryState = (await categoryStateResponse.json()) as {
        writeToken: string;
      },
      detached = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/categories/${categoryId}/detachments`,
          {
            headers: { "cms-write-token": categoryState.writeToken },
            method: "POST",
          },
        ),
      );
    expect(detached.status).toBe(HTTP_OK);
    expect(((await detached.json()) as { detachedPostCount: number }).detachedPostCount).toBe(
      ONE_ITEM,
    );

    const oldAssetId = firstItem(exportBefore.assets).id,
      replacementForm = new FormData();
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
    const replaced = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${oldAssetId}/replacements`,
          {
            body: replacementForm,
            headers: { "idempotency-key": "replace-seed-image" },
            method: "POST",
          },
        ),
      ),
      replacementReceipt = (await replaced.json()) as {
        newAssetId: string;
        oldAssetDeleted: boolean;
        reassignedEntryCount: number;
      };
    expect(replaced.status).toBe(HTTP_OK);
    expect(replacementReceipt.newAssetId).not.toBe(oldAssetId);
    expect(replacementReceipt.reassignedEntryCount).toBe(TWO_ITEMS);
    expect(replacementReceipt.oldAssetDeleted).toBeTrue();

    const postId = system.seed?.publishedPostId ?? "",
      postStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${postId}/state`,
      postStateResponse = await system.handler(new Request(postStateUrl)),
      postState = (await postStateResponse.json()) as {
        writeToken: string;
      },
      cascaded = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/cascade-deletions`,
          {
            headers: { "cms-write-token": postState.writeToken },
            method: "POST",
          },
        ),
    );
    expect(cascaded.status).toBe(HTTP_OK);
    const cascadeReceipt = (await cascaded.json()) as { deletedCommentCount: number },
      deletedPostResponse = await system.handler(
        new Request("http://cms.test/api/v1/headless/posts/a-lighthouse-for-content"),
      );
    expect(cascadeReceipt.deletedCommentCount).toBeGreaterThanOrEqual(TWO_ITEMS);
    expect(deletedPostResponse.status).toBe(HTTP_NOT_FOUND);
  });

  test("replays durable Comment receipts and Definition state after restart", async () => {
    const restartRoot = await mkdtemp(join(import.meta.dir, ".restart-api-")),
      firstSystem = await createExampleSystem({ seed: true, storageRoot: restartRoot }),
      postId = firstSystem.seed?.publishedPostId ?? "",
      makeRequest = () =>
        new Request(`http://cms.test/api/v1/headless/posts/${postId}/comments`, {
          body: JSON.stringify({ body: "Persist this receipt.", displayName: "Restart reader" }),
          headers: {
            "content-type": "application/json",
            "idempotency-key": "restart-comment-key",
          },
          method: "POST",
        }),
      firstResponse = await firstSystem.handler(makeRequest()),
      firstReceipt = await firstResponse.json();
    await firstSystem.dispose();

    const restartedSystem = await createExampleSystem({ storageRoot: restartRoot });
    try {
      const replayedResponse = await restartedSystem.handler(makeRequest()),
        replayedReceipt = await replayedResponse.json(),
        schema = await restartedSystem.handler(
          new Request("http://cms.test/api/v1/headless/schema"),
        );
      expect(replayedReceipt).toEqual(firstReceipt);
      expect(schema.status).toBe(HTTP_OK);
    } finally {
      await restartedSystem.dispose();
      await rm(restartRoot, { force: true, recursive: true });
    }
  });
});
