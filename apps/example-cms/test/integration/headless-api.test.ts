import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ExampleSystem } from "../../src/system.ts";
import { createExampleSystem } from "../../src/system.ts";

describe("Example CMS Headless API", () => {
  let system: ExampleSystem;
  let storageRoot: string;

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
    expect(response.status).toBe(200);
    const exported = (await response.json()) as {
      posts: readonly { status: string }[];
      comments: readonly { status: string }[];
    };
    expect(exported.posts.length).toBeGreaterThan(0);
    expect(exported.posts.every((post) => post.status === "published")).toBeTrue();
    expect(exported.comments.every((comment) => comment.status === "approved")).toBeTrue();
  });

  test("deduplicates pending Comment submission by idempotency key", async () => {
    const exported = (await (
        await system.handler(new Request("http://cms.test/api/v1/headless/export"))
      ).json()) as { posts: readonly { id: string }[] },
      postId = exported.posts[0]!.id,
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
    expect(first.status).toBe(201);
    expect(await second.json()).toEqual(await first.json());
  });

  test("supports bounded listings, conditional export, and public Asset ranges", async () => {
    const invalidPage = await system.handler(
      new Request("http://cms.test/api/v1/headless/posts?pageSize=0"),
    );
    expect(invalidPage.status).toBe(400);

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
          headers: { "if-none-match": etag! },
        }),
      );
    expect(notModified.status).toBe(304);

    const assetId = exported.assets[0]!.id,
      head = await system.handler(
        new Request(`http://cms.test/api/v1/headless/assets/${assetId}`, { method: "HEAD" }),
      );
    expect(head.status).toBe(200);
    expect(head.headers.get("accept-ranges")).toBe("bytes");
    const partial = await system.handler(
      new Request(`http://cms.test/api/v1/headless/assets/${assetId}`, {
        headers: { range: "bytes=0-9" },
      }),
    );
    expect(partial.status).toBe(206);
    expect((await partial.arrayBuffer()).byteLength).toBe(10);

    const draft = await system.handler(
      new Request("http://cms.test/api/v1/headless/posts/the-unfinished-map"),
    );
    expect(draft.status).toBe(404);
  });

  test("exposes named editorial Management commands with Write Token concurrency", async () => {
    const postId = system.seed!.publishedPostId,
      statePath = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${postId}/state`,
      initial = (await (await system.handler(new Request(statePath))).json()) as {
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
    expect(returnedToDraft.status).toBe(200);
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
    expect(stalePublish.status).toBe(409);
    const published = await system.handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${postId}/publications`,
        {
          headers: { "cms-write-token": draftState.writeToken },
          method: "POST",
        },
      ),
    );
    expect(published.status).toBe(200);
    expect(
      ((await published.json()) as { entry: { values: { status: string } } }).entry.values.status,
    ).toBe("published");
  });

  test("runs detachment, image replacement, and cascade deletion commands through safe commit boundaries", async () => {
    const exportBefore = (await (
        await system.handler(new Request("http://cms.test/api/v1/headless/export"))
      ).json()) as {
        assets: readonly { id: string }[];
        categories: readonly { id: string }[];
        posts: readonly { id: string; categories: readonly string[]; featuredAsset: string }[];
      },
      categoryId = exportBefore.categories[0]!.id,
      categoryStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/category/entries/${categoryId}/state`,
      categoryState = (await (await system.handler(new Request(categoryStateUrl))).json()) as {
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
    expect(detached.status).toBe(200);
    expect(((await detached.json()) as { detachedPostCount: number }).detachedPostCount).toBe(1);

    const oldAssetId = exportBefore.assets[0]!.id,
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
    expect(replaced.status).toBe(200);
    expect(replacementReceipt.newAssetId).not.toBe(oldAssetId);
    expect(replacementReceipt.reassignedEntryCount).toBe(2);
    expect(replacementReceipt.oldAssetDeleted).toBeTrue();

    const postId = system.seed!.publishedPostId,
      postStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${postId}/state`,
      postState = (await (await system.handler(new Request(postStateUrl))).json()) as {
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
    expect(cascaded.status).toBe(200);
    expect(
      ((await cascaded.json()) as { deletedCommentCount: number }).deletedCommentCount,
    ).toBeGreaterThanOrEqual(2);
    expect(
      (
        await system.handler(
          new Request("http://cms.test/api/v1/headless/posts/a-lighthouse-for-content"),
        )
      ).status,
    ).toBe(404);
  });

  test("replays durable Comment receipts and Definition state after restart", async () => {
    const restartRoot = await mkdtemp(join(import.meta.dir, ".restart-api-")),
      firstSystem = await createExampleSystem({ seed: true, storageRoot: restartRoot }),
      postId = firstSystem.seed!.publishedPostId,
      makeRequest = () =>
        new Request(`http://cms.test/api/v1/headless/posts/${postId}/comments`, {
          body: JSON.stringify({ body: "Persist this receipt.", displayName: "Restart reader" }),
          headers: {
            "content-type": "application/json",
            "idempotency-key": "restart-comment-key",
          },
          method: "POST",
        }),
      firstReceipt = await (await firstSystem.handler(makeRequest())).json();
    await firstSystem.dispose();

    const restartedSystem = await createExampleSystem({ storageRoot: restartRoot });
    try {
      const replayedReceipt = await (await restartedSystem.handler(makeRequest())).json(),
        schema = await restartedSystem.handler(
          new Request("http://cms.test/api/v1/headless/schema"),
        );
      expect(replayedReceipt).toEqual(firstReceipt);
      expect(schema.status).toBe(200);
    } finally {
      await restartedSystem.dispose();
      await rm(restartRoot, { force: true, recursive: true });
    }
  });
});
