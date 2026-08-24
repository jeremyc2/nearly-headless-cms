import { Cms, RichText } from "nearly-headless-cms";
import { Effect } from "effect";

const paragraph = (text: string): RichText.ParagraphNode => ({
  children: [{ text, type: "text" }],
  type: "paragraph",
});

export interface SeedResult {
  readonly publishedPostId: string;
  readonly draftPostId: string;
}

const entryId = (result: Cms.MutationResult): string =>
  "writeToken" in result ? result.entry.id : result.id;

export const seed = Effect.gen(function* seed() {
  const cms = yield* Cms.Service,
    existingPublishedPosts = yield* cms.queryEntries({
      contentTypeId: "post",
      pageSize: 1,
      where: { operator: "equals", path: "slug", value: "a-lighthouse-for-content" },
    }),
    existingDraftPosts = yield* cms.queryEntries({
      contentTypeId: "post",
      pageSize: 1,
      where: { operator: "equals", path: "slug", value: "the-unfinished-map" },
    }),
    existingPublishedPost = existingPublishedPosts.items[0],
    existingDraftPost = existingDraftPosts.items[0];
  if (existingPublishedPost !== undefined && existingDraftPost !== undefined) {
    return {
      draftPostId: existingDraftPost.id,
      publishedPostId: existingPublishedPost.id,
    } satisfies SeedResult;
  }
  const asset = yield* cms.ingestAsset({
      content: new TextEncoder().encode(
        '<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630"><rect width="1200" height="630" fill="#18332f"/><circle cx="850" cy="180" r="90" fill="#f1c75b"/></svg>',
      ),
      defaultAlternativeText: "A lighthouse casting a beam over dark water",
      filename: "lighthouse.svg",
      height: 630,
      mediaType: "image/svg+xml",
      width: 1200,
    }),
    author = yield* cms.createEntry({
      contentTypeId: "author",
      values: {
        biography: "Essayist and keeper of field notes.",
        "external-links": [{ label: "Personal site", url: "https://example.com/ada" }],
        name: "Ada Rowan",
        portrait: asset.id,
        "portrait-alternative-text": "Portrait illustration of Ada Rowan",
        profile: RichText.toJson({
          children: [paragraph("Ada writes about durable knowledge, small tools, and the coast.")],
          format: RichText.format,
          version: RichText.formatVersion,
        }),
        slug: "ada-rowan",
      },
    }),
    category = yield* cms.createEntry({
      contentTypeId: "category",
      values: {
        description: "Observations from practical work.",
        name: "Field Notes",
        slug: "field-notes",
      },
    }),
    tag = yield* cms.createEntry({
      contentTypeId: "tag",
      values: {
        description: "Designing systems that can change.",
        name: "Architecture",
        slug: "architecture",
      },
    }),
    authorId = entryId(author),
    categoryId = entryId(category),
    tagId = entryId(tag),
    publishedPost = yield* cms.createEntry({
      contentTypeId: "post",
      values: {
        author: authorId,
        body: RichText.toJson({
          children: [
            {
              type: "heading",
              level: 2,
              children: [{ type: "text", text: "Keep the signal separate" }],
            },
            paragraph("Content survives when its meaning is not trapped inside one presentation."),
            {
              type: "asset-reference",
              assetId: asset.id,
              alternativeText: "A lighthouse casting a beam over dark water",
              caption: "A durable signal",
              children: [],
            },
          ],
          format: RichText.format,
          version: RichText.formatVersion,
        }),
        categories: [categoryId],
        excerpt: "Why presentation-neutral content makes a steadier signal.",
        "featured-alternative-text": "A lighthouse casting a beam over dark water",
        "featured-asset": asset.id,
        "published-at": "2026-08-23T12:00:00.000Z",
        slug: "a-lighthouse-for-content",
        status: "published",
        tags: [tagId],
        title: "A Lighthouse for Content",
      },
    }),
    draftPost = yield* cms.createEntry({
      contentTypeId: "post",
      values: {
        author: authorId,
        body: RichText.toJson({
          children: [paragraph("Still taking notes.")],
          format: RichText.format,
          version: RichText.formatVersion,
        }),
        categories: [],
        excerpt: "A draft that must never cross the Headless API.",
        "featured-alternative-text": null,
        "featured-asset": null,
        "published-at": null,
        slug: "the-unfinished-map",
        status: "draft",
        tags: [tagId],
        title: "The Unfinished Map",
      },
    }),
    publishedPostId = entryId(publishedPost);
  yield* cms.createEntry({
    contentTypeId: "comment",
    values: {
      body: "The signal metaphor is going to stay with me.",
      "created-at": "2026-08-23T14:00:00.000Z",
      "display-name": "Mira",
      post: publishedPostId,
      status: "approved",
      "website-url": null,
    },
  });
  yield* cms.createEntry({
    contentTypeId: "comment",
    values: {
      body: "Waiting for moderation.",
      "created-at": "2026-08-23T15:00:00.000Z",
      "display-name": "Pending Reader",
      post: publishedPostId,
      status: "pending",
      "website-url": null,
    },
  });
  return { draftPostId: entryId(draftPost), publishedPostId } satisfies SeedResult;
});
