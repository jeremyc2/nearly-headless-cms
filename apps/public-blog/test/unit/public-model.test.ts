import { describe, expect, test } from "bun:test";
import { paginate, publishedPosts } from "../../src/domain/public-model.ts";
import type { PublicBlogExport, PublicPost } from "../../src/generated/headless-client.ts";

const post = (id: string, status: "published", publishedAt: string): PublicPost => ({
  author: "author",
  body: { children: [], format: "nearly-headless-cms/rich-text", version: 1 },
  categories: [],
  excerpt: id,
  featuredAlternativeText: null,
  featuredAsset: null,
  id,
  publishedAt,
  slug: id,
  status,
  tags: [],
  title: id,
});

describe("Public Blog render model", () => {
  test("orders published Posts stably and paginates without offsets in public URLs", () => {
    const snapshot: PublicBlogExport = {
        assets: [],
        authors: [],
        categories: [],
        comments: [],
        definitionFingerprint: "test",
        generatedAt: "2026-08-24T00:00:00.000Z",
        posts: [
          post("later-b", "published", "2026-08-24T00:00:00.000Z"),
          post("earlier", "published", "2026-08-23T00:00:00.000Z"),
          post("later-a", "published", "2026-08-24T00:00:00.000Z"),
        ],
        tags: [],
      },
      ordered = publishedPosts(snapshot);
    expect(ordered.map((candidate) => candidate.id)).toEqual(["later-a", "later-b", "earlier"]);
    expect(paginate(ordered, 2).map((page) => page.items.length)).toEqual([2, 1]);
  });
});
