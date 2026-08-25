import {
  Cms,
  type CmsError,
  type ContentDefinition,
  RichText,
} from "nearly-headless-cms";
import { Effect } from "effect";

export interface SeedResult {
  readonly draftPostId: string;
  readonly publishedPostId: string;
}

interface SeedReferences {
  readonly assetId: string;
  readonly authorId: string;
  readonly categoryId: string;
  readonly tagId: string;
}

interface ExistingSeedEntries {
  readonly draftPostId?: string;
  readonly publishedPostId?: string;
}

const paragraph = (text: string): RichText.ParagraphNode => ({
    children: [{ text, type: "text" }],
    type: "paragraph",
  }),
  richTextJsonObject = (document: RichText.Document): ContentDefinition.JsonObject =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.
    RichText.toJson(document) as ContentDefinition.JsonObject,
  seedAuthorProfile = (): RichText.Document => ({
    children: [paragraph("Ada writes about durable knowledge, small tools, and the coast.")],
    format: RichText.format,
    version: RichText.formatVersion,
  }),
  seedAuthorProfileDocument = (): ContentDefinition.JsonObject =>
    richTextJsonObject(seedAuthorProfile()),
  seedDraftBody = (): RichText.Document => ({
    children: [paragraph("Still taking notes.")],
    format: RichText.format,
    version: RichText.formatVersion,
  }),
  seedEntryId = (result: Cms.MutationResult): string => {
    if ("writeToken" in result) {
      return result.entry.id;
    }
    return result.id;
  },
  seedFindExistingEntries = (
    cms: Readonly<Cms.ServiceShape>,
  ): Effect.Effect<ExistingSeedEntries, CmsError.CmsError> =>
    Effect.gen(function* findExistingSeedEntriesEffect() {
      const existingDraftPosts = yield* cms.queryEntries({
          contentTypeId: "post",
          pageSize: 1,
          where: { operator: "equals", path: "slug", value: "the-unfinished-map" },
        }),
        existingPublishedPosts = yield* cms.queryEntries({
          contentTypeId: "post",
          pageSize: 1,
          where: { operator: "equals", path: "slug", value: "a-lighthouse-for-content" },
        }),
        [existingDraftPost] = existingDraftPosts.items,
        [existingPublishedPost] = existingPublishedPosts.items;
      return {
        draftPostId: existingDraftPost?.id,
        publishedPostId: existingPublishedPost?.id,
      };
    }),
  seedMakeReferences = (
    cms: Readonly<Cms.ServiceShape>,
  ): Effect.Effect<SeedReferences, CmsError.CmsError> =>
    Effect.gen(function* createSeedReferencesEffect() {
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
            profile: seedAuthorProfileDocument(),
            slug: "ada-rowan",
          },
        }),
        authorId = seedEntryId(author),
        category = yield* cms.createEntry({
          contentTypeId: "category",
          values: {
            description: "Observations from practical work.",
            name: "Field Notes",
            slug: "field-notes",
          },
        }),
        categoryId = seedEntryId(category),
        tag = yield* cms.createEntry({
          contentTypeId: "tag",
          values: {
            description: "Designing systems that can change.",
            name: "Architecture",
            slug: "architecture",
          },
        }),
        tagId = seedEntryId(tag);
      return { assetId: asset.id, authorId, categoryId, tagId };
    }),
  seedPrepareDraftPost = (
    cms: Readonly<Cms.ServiceShape>,
    references: SeedReferences,
  ): Effect.Effect<string, CmsError.CmsError> => {
    const body = richTextJsonObject(seedDraftBody());
    return Effect.map(
      cms.createEntry({
        contentTypeId: "post",
        values: {
          author: references.authorId,
          body,
          categories: [],
          excerpt: "A draft that must never cross the Headless API.",
          "featured-alternative-text": null,
          "featured-asset": null,
          "published-at": null,
          slug: "the-unfinished-map",
          status: "draft",
          tags: [references.tagId],
          title: "The Unfinished Map",
        },
      }),
      seedEntryId,
    );
  },
  seedPreparePublishedBody = (assetId: string): RichText.Document => ({
    children: [
      {
        children: [{ text: "Keep the signal separate", type: "text" }],
        level: 2,
        type: "heading",
      },
      paragraph("Content survives when its meaning is not trapped inside one presentation."),
      {
        alternativeText: "A lighthouse casting a beam over dark water",
        assetId,
        caption: "A durable signal",
        children: [],
        type: "asset-reference",
      },
    ],
    format: RichText.format,
    version: RichText.formatVersion,
  }),
  seedPreparePublishedPost = (
    cms: Readonly<Cms.ServiceShape>,
    references: SeedReferences,
  ): Effect.Effect<string, CmsError.CmsError> => {
    const body = richTextJsonObject(seedPreparePublishedBody(references.assetId));
    return Effect.map(
      cms.createEntry({
        contentTypeId: "post",
        values: {
          author: references.authorId,
          body,
          categories: [references.categoryId],
          excerpt: "Why presentation-neutral content makes a steadier signal.",
          "featured-alternative-text": "A lighthouse casting a beam over dark water",
          "featured-asset": references.assetId,
          "published-at": "2026-08-23T12:00:00.000Z",
          slug: "a-lighthouse-for-content",
          status: "published",
          tags: [references.tagId],
          title: "A Lighthouse for Content",
        },
      }),
      seedEntryId,
    );
  },
  seedRecordComments = (
    cms: Readonly<Cms.ServiceShape>,
    publishedPostId: string,
  ): Effect.Effect<void, CmsError.CmsError> =>
    Effect.gen(function* createSeedCommentsEffect() {
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
    }),
  seedWritePosts = (
    cms: Readonly<Cms.ServiceShape>,
  ): Effect.Effect<SeedResult, CmsError.CmsError> =>
    Effect.flatMap(seedMakeReferences(cms), (references) =>
      Effect.gen(function* createSeedPostsEffect() {
        const draftPostId = yield* seedPrepareDraftPost(cms, references),
          publishedPostId = yield* seedPreparePublishedPost(cms, references);
        return { draftPostId, publishedPostId };
      }),
    ),
  zSeed = Effect.gen(function* seed() {
    const cms = yield* Cms.Service,
      existingSeedEntries = yield* seedFindExistingEntries(cms);
    if (
      existingSeedEntries.draftPostId !== undefined &&
      existingSeedEntries.publishedPostId !== undefined
    ) {
      return {
        draftPostId: existingSeedEntries.draftPostId,
        publishedPostId: existingSeedEntries.publishedPostId,
      } satisfies SeedResult;
    }
    {
      const seedResult = yield* seedWritePosts(cms);
      yield* seedRecordComments(cms, seedResult.publishedPostId);
      return seedResult;
    }
  });

/** Idempotently creates the Example CMS fixture graph. */
export { zSeed as seed };
