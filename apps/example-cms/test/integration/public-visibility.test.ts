import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ExampleSystem } from "../../src/system.ts";
import { createExampleSystem } from "../../src/system.ts";

const managementEntriesUrl = (contentTypeIdentifier: string): string =>
  `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/${contentTypeIdentifier}/entries`;

describe("Example CMS public visibility", () => {
  let system: ExampleSystem;
  let storageRoot: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(import.meta.dir, ".public-visibility-"));
    system = await createExampleSystem({ seed: true, storageRoot });
  });

  afterAll(async () => {
    await system.dispose();
    await rm(storageRoot, { force: true, recursive: true });
  });

  test("exports every public Entry across internal query pages", async () => {
    const initialExport = (await (
        await system.handler(new Request("http://cms.test/api/v1/headless/export"))
      ).json()) as { authors: readonly { id: string }[]; posts: readonly { id: string }[] },
      authorIdentifier = initialExport.authors[0]!.id;
    for (let postNumber = 0; postNumber < 101; postNumber += 1) {
      const response = await system.handler(
        new Request(managementEntriesUrl("post"), {
          body: JSON.stringify({
            values: {
              author: authorIdentifier,
              body: {
                children: [
                  {
                    children: [{ text: `Complete export ${postNumber}`, type: "text" }],
                    type: "paragraph",
                  },
                ],
                format: "nearly-headless-cms/rich-text",
                version: 1,
              },
              categories: [],
              excerpt: `Complete export fixture ${postNumber}`,
              "featured-alternative-text": null,
              "featured-asset": null,
              "published-at": `2026-08-22T${String(postNumber % 24).padStart(2, "0")}:00:00.000Z`,
              slug: `complete-export-${postNumber}`,
              status: "published",
              tags: [],
              title: `Complete export ${postNumber}`,
            },
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      );
      expect(response.status).toBe(201);
    }

    const completeExport = (await (
      await system.handler(new Request("http://cms.test/api/v1/headless/export"))
    ).json()) as { posts: readonly { id: string }[] };
    expect(completeExport.posts).toHaveLength(initialExport.posts.length + 101);
  }, 30_000);

  test("hides Comments, taxonomies, and Entry references outside published reachability", async () => {
    const categoryResponse = await system.handler(
        new Request(managementEntriesUrl("category"), {
          body: JSON.stringify({
            values: {
              description: "Not attached to any published Post.",
              name: "Private taxonomy",
              slug: "private-taxonomy",
            },
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      ),
      category = (await categoryResponse.json()) as {
        entry?: { id: string };
        id?: string;
      },
      categoryIdentifier = category.entry?.id ?? category.id!;
    expect(categoryResponse.status).toBe(201);

    const commentResponse = await system.handler(
      new Request(managementEntriesUrl("comment"), {
        body: JSON.stringify({
          values: {
            body: "Approved, but attached to a draft.",
            "created-at": "2026-08-23T15:30:00.000Z",
            "display-name": "Hidden reader",
            post: system.seed!.draftPostId,
            status: "approved",
            "website-url": null,
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(commentResponse.status).toBe(201);

    const draftComments = await system.handler(
        new Request(`http://cms.test/api/v1/headless/posts/${system.seed!.draftPostId}/comments`),
      ),
      privateTaxonomy = await system.handler(
        new Request("http://cms.test/api/v1/headless/categories/private-taxonomy"),
      ),
      privateReference = await system.handler(
        new Request(`http://cms.test/api/v1/headless/references/entries/${categoryIdentifier}`),
      );
    expect(draftComments.status).toBe(404);
    expect(privateTaxonomy.status).toBe(404);
    expect(privateReference.status).toBe(404);

    const publicExport = (await (
      await system.handler(new Request("http://cms.test/api/v1/headless/export"))
    ).json()) as {
      categories: readonly { id: string }[];
      comments: readonly { post: string }[];
    };
    expect(
      publicExport.categories.some((candidate) => candidate.id === categoryIdentifier),
    ).toBeFalse();
    expect(
      publicExport.comments.some((candidate) => candidate.post === system.seed!.draftPostId),
    ).toBeFalse();
  });
});
