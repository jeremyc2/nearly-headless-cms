import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";

const authorIndex = 0,
  createdEntryStatus = 201,
  exportTimeoutMilliseconds = 30_000,
  hourTextWidth = 2,
  hoursPerDay = 24,
  loopIncrement = 1,
  notFoundStatus = 404,
  postsToCreate = 101,
  richTextVersion = 1,
  managementEntriesUrl = (contentTypeIdentifier: string): string =>
    `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/${contentTypeIdentifier}/entries`;

describe("Example CMS public visibility", () => {
  let storageRoot: string, system: ExampleSystem;

  // oxlint-disable-next-line effecttsgo/async-function -- Bun's lifecycle hook requires a Promise-returning callback.
  beforeAll(async () => {
    storageRoot = (
      await Bun.$`mktemp -d ${import.meta.dir}/.public-visibility-XXXXXX`.text()
    ).trim();
    system = await createExampleSystem({ seed: true, storageRoot });
  });

  // oxlint-disable-next-line effecttsgo/async-function -- Bun's lifecycle hook requires a Promise-returning callback.
  afterAll(async () => {
    await system.dispose();
    await Bun.$`rm -rf ${storageRoot}`;
  });

  test(
    "exports every public Entry across internal query pages",
    // oxlint-disable-next-line effecttsgo/async-function -- Bun's test callback requires a Promise-returning callback.
    async () => {
      const initialExportResponse = await system.handler(
          new Request("http://cms.test/api/v1/headless/export"),
        ),
        initialExport = (await initialExportResponse.json()) as {
          authors: readonly { id: string }[];
          posts: readonly { id: string }[];
        },
        authorIdentifier = initialExport.authors[authorIndex]?.id ?? "",
        createPosts = (postNumber: number): Promise<void> => {
          if (postNumber >= postsToCreate) {
            return Promise.resolve();
          }
          return system
            .handler(
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
                      version: richTextVersion,
                    },
                    categories: [],
                    excerpt: `Complete export fixture ${postNumber}`,
                    "featured-alternative-text": null,
                    "featured-asset": null,
                    "published-at": `2026-08-22T${String(postNumber % hoursPerDay).padStart(hourTextWidth, "0")}:00:00.000Z`,
                    slug: `complete-export-${postNumber}`,
                    status: "published",
                    tags: [],
                    title: `Complete export ${postNumber}`,
                  },
                }),
                headers: { "content-type": "application/json" },
                method: "POST",
              }),
            )
            .then((response) => {
              expect(response.status).toBe(createdEntryStatus);
              return createPosts(postNumber + loopIncrement);
            });
        };
      await createPosts(0);

      const completeExportResponse = await system.handler(
          new Request("http://cms.test/api/v1/headless/export"),
        ),
        completeExport = (await completeExportResponse.json()) as {
          posts: readonly { id: string }[];
        };
      expect(completeExport.posts).toHaveLength(initialExport.posts.length + postsToCreate);
    },
    exportTimeoutMilliseconds,
  );

  // oxlint-disable-next-line effecttsgo/async-function -- Bun's test callback requires a Promise-returning callback.
  test("hides Comments, taxonomies, and Entry references outside published reachability", async () => {
    const draftPostId = system.seed?.draftPostId ?? "",
      categoryResponse = await system.handler(
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
      categoryIdentifier = category.entry?.id ?? category.id ?? "";
    expect(categoryResponse.status).toBe(createdEntryStatus);

    const commentResponse = await system.handler(
      new Request(managementEntriesUrl("comment"), {
        body: JSON.stringify({
          values: {
            body: "Approved, but attached to a draft.",
            "created-at": "2026-08-23T15:30:00.000Z",
            "display-name": "Hidden reader",
            post: draftPostId,
            status: "approved",
            "website-url": null,
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    );
    expect(commentResponse.status).toBe(createdEntryStatus);

    const draftComments = await system.handler(
        new Request(`http://cms.test/api/v1/headless/posts/${draftPostId}/comments`),
      ),
      privateTaxonomy = await system.handler(
        new Request("http://cms.test/api/v1/headless/categories/private-taxonomy"),
      ),
      privateReference = await system.handler(
        new Request(`http://cms.test/api/v1/headless/references/entries/${categoryIdentifier}`),
      );
    expect(draftComments.status).toBe(notFoundStatus);
    expect(privateTaxonomy.status).toBe(notFoundStatus);
    expect(privateReference.status).toBe(notFoundStatus);

    const publicExportResponse = await system.handler(
        new Request("http://cms.test/api/v1/headless/export"),
      ),
      publicExport = (await publicExportResponse.json()) as {
        categories: readonly { id: string }[];
        comments: readonly { post: string }[];
      };
    expect(
      publicExport.categories.some((candidate) => candidate.id === categoryIdentifier),
    ).toBeFalse();
    expect(publicExport.comments.some((candidate) => candidate.post === draftPostId)).toBeFalse();
  });
});
