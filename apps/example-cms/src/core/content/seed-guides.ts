import { Cms, type CmsError, type ContentDefinition, RichText } from "nearly-headless-cms";
import { Effect } from "effect";

interface GuideSeedDefinition {
  readonly body: RichText.Document;
  readonly description: string;
  readonly nextGuideSlug?: string;
  readonly slug: string;
  readonly sortOrder: number;
  readonly title: string;
}

interface GuideSeedIdentifiers {
  readonly buildingSiteId: string;
  readonly definingContentId: string;
  readonly gettingStartedId: string;
  readonly providingLayersId: string;
}

const guideSeedSlug = "getting-started",
  inlineText = (content: string, marks?: readonly RichText.Mark[]): RichText.TextNode =>
    marks === undefined ? { text: content, type: "text" } : { marks, text: content, type: "text" },
  guideParagraph = (...children: readonly RichText.InlineNode[]): RichText.ParagraphNode => ({
    children,
    type: "paragraph",
  }),
  guideParagraphText = (content: string): RichText.ParagraphNode =>
    guideParagraph(inlineText(content)),
  guideHeading = (level: 2 | 3 | 4, content: string): RichText.HeadingNode => ({
    children: [inlineText(content)],
    level,
    type: "heading",
  }),
  guideCodeBlock = (content: string): RichText.CodeBlockNode => ({
    children: [inlineText(content)],
    type: "code-block",
  }),
  guideListItem = (...children: readonly RichText.InlineNode[]): RichText.ListItemNode => ({
    children: [guideParagraph(...children)],
    type: "list-item",
  }),
  guideListItemText = (content: string): RichText.ListItemNode => ({
    children: [guideParagraphText(content)],
    type: "list-item",
  }),
  guideUnorderedList = (items: readonly RichText.ListItemNode[]): RichText.ListNode => ({
    children: items,
    type: "unordered-list",
  }),
  guideOrderedList = (items: readonly RichText.ListItemNode[]): RichText.ListNode => ({
    children: items,
    type: "ordered-list",
  }),
  guideDocument = (...children: readonly RichText.BlockNode[]): RichText.Document => ({
    children,
    format: RichText.format,
    version: RichText.formatVersion,
  }),
  guideRichTextJsonObject = (document: RichText.Document): ContentDefinition.JsonObject =>
    // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-212] RichText.toJson returns a JSON-compatible object validated by the CMS schema boundary.
    RichText.toJson(document) as ContentDefinition.JsonObject,
  guideSeedGettingStartedBody = (): RichText.Document => {
    const youProvideListItem = guideListItem(
        inlineText("You provide:", ["bold"]),
        inlineText(
          " persistence, authorization, identity, ID generation, HTTP wiring, and any custom public API operations.",
        ),
      ),
      libraryProvidesListItem = guideListItem(
        inlineText("The library provides:", ["bold"]),
        inlineText(
          " the CMS service for entries, queries, assets, definition snapshots, and history.",
        ),
      );
    return guideDocument(
      guideParagraphText(
        "Hosted headless CMS tools ship storage, auth, and an admin UI together. This library splits that apart on purpose. You keep control of the parts that usually differ between teams.",
      ),
      guideParagraphText(
        "The library exposes one Effect service, Cms.Service. Your app provides the layers around it: where content lives, who is calling, and whether they are allowed to.",
      ),
      guideHeading(2, "The smallest useful app"),
      guideParagraphText("For local development, start with the in-memory layer:"),
      guideCodeBlock(`import { ContentDefinition, Cms } from "nearly-headless-cms"
import { InMemory } from "nearly-headless-cms/layers"
import { Effect } from "effect"

const snapshot = ContentDefinition.compileSnapshot({
  definitionSpaceId: "my-site",
  snapshotId: "v1",
  definitions: [/* your content types */],
})

const cmsLayer = InMemory.cms({ snapshot })`),
      guideParagraphText(
        "That layer already wires open authorization, anonymous identity, crypto identifiers, and process-local storage. Replace any piece later without rewriting the CMS service.",
      ),
      guideHeading(2, "Your job vs the library's job"),
      guideUnorderedList([youProvideListItem, libraryProvidesListItem]),
      guideHeading(2, "Where the example apps fit"),
      guideParagraphText(
        "The Example CMS in this monorepo is a full composition: filesystem storage, delivery and management APIs, and a React dashboard.",
      ),
      guideParagraphText(
        "This Public Blog is the other half. It is a static site that reads from the Headless API at build time and never imports the library.",
      ),
      guideParagraphText(
        "Read the guides in order, or jump to Provide layers if you already know where your data will live.",
      ),
    );
  },
  guideSeedDefiningContentBody = (): RichText.Document =>
    guideDocument(
      guideParagraphText(
        "A blog post, an author page, and a product listing all start the same way. Declare a content type in code, compile it, pass the snapshot to your CMS layer.",
      ),
      guideHeading(2, "Field helpers cut repetition"),
      guideParagraphText("The library ships small helpers so field definitions stay readable:"),
      guideCodeBlock(`import { ContentDefinition } from "nearly-headless-cms"

const { compileSnapshot, Fields } = ContentDefinition

const snapshot = compileSnapshot({
  definitionSpaceId: "example-blog",
  snapshotId: "example-blog-v1",
  definitions: [
    Fields.contentType({
      id: "post",
      name: "Post",
      history: true,
      fields: [
        Fields.requiredTextField("title", "Title", { maxLength: 180, minLength: 1 }),
        Fields.requiredSlugField("slug", "Slug"),
        Fields.requiredTextField("excerpt", "Excerpt", { multiline: true }),
        { key: "body", kind: { kind: "rich-text", formatVersion: 1 }, label: "Body", required: true },
        { key: "author", kind: Fields.relationship(["author"]), label: "Author", required: true },
        {
          key: "status",
          kind: Fields.enumField(["draft", "published"]),
          label: "Status",
          required: true,
          defaultValue: "draft",
        },
      ],
    }),
  ],
})`),
      guideHeading(2, "One file for your model"),
      guideParagraphText(
        "In the Example CMS, every content type for this blog lives in core/content/definitions.ts. Posts, authors, categories, tags, comments, and guides share one source of truth. When the model changes, you change one file.",
      ),
      guideHeading(2, "Compiled snapshots are deterministic"),
      guideParagraphText(
        "compileSnapshot validates relationships, field keys, and constraints. The result is an immutable snapshot with a stable fingerprint. Activate it in persistence and every new entry conforms to it.",
      ),
    ),
  guideSeedProvidingLayersBody = (): RichText.Document =>
    guideDocument(
      guideParagraphText(
        "Effect layers are how you wire dependencies. Nearly Headless CMS expects persistence, authorization, identity, and identifier generation from your app. The library composes them into Cms.Service.",
      ),
      guideHeading(2, "Composition in the Example CMS"),
      guideParagraphText(
        "The reference app wires the CMS in core/composition.ts. Local development uses Filesystem.cms from nearly-headless-cms/layers, which already includes open authorization, anonymous identity, and crypto identifiers.",
      ),
      guideUnorderedList([
        guideListItemText("core/content/definitions.ts declares content types"),
        guideListItemText("core/api/ declares delivery and management HTTP operations"),
        guideListItemText("core/composition.ts merges the CMS layer and route declarations"),
        guideListItemText("core/identifiers.ts supplies deterministic IDs for acceptance tests"),
      ]),
      guideParagraphText("Want filesystem storage with development defaults already wired?"),
      guideCodeBlock(`import { Filesystem } from "nearly-headless-cms/layers"

const cmsLayer = Filesystem.cms({
  root: ".data/my-cms/persistence",
  definitionSnapshot: snapshot,
  operationContracts: [...deliveryOps, ...managementOps],
})`),
      guideHeading(2, "Replace any layer without forking the library"),
      guideParagraphText(
        "Convenience layers are optional. Call Cms.makeLayer directly and provide your own Persistence.EntryPersistence, or build a layer from the service definition with Effect's layer utilities.",
      ),
      guideCodeBlock(`import { Cms } from "nearly-headless-cms"
import { AllowAllAuthorization, AnonymousIdentity } from "nearly-headless-cms/adapters"
import { BunFilesystemPersistence } from "nearly-headless-cms/bun/filesystem"
import { Layer } from "effect"
import { forStorageRoot } from "./identifiers.ts"

const persistence = BunFilesystemPersistence.cmsLayer({ root, definitionSnapshot })
  .pipe(Layer.provide(forStorageRoot(storageRoot)))

const cmsLayer = Cms.makeLayer({ operationContracts })
  .pipe(Layer.provide(Layer.mergeAll(
    AllowAllAuthorization.layer,
    AnonymousIdentity.layer,
    forStorageRoot(storageRoot),
    persistence,
  )))`),
      guideHeading(2, "Development vs production"),
      guideParagraphText(
        "Use InMemory.cms for tests and prototypes. Use Filesystem.cms or your own durable adapter when data must survive restarts. The CMS service interface does not change between them.",
      ),
    ),
  guideSeedBuildingSiteBody = (): RichText.Document =>
    guideDocument(
      guideParagraphText(
        "Content clients should not import the CMS library. They call the Headless API, the public HTTP surface your CMS exposes, and turn the response into pages, feeds, and forms.",
      ),
      guideHeading(2, "Build-time export, runtime comments"),
      guideParagraphText("This Public Blog workflow:"),
      guideOrderedList([
        guideListItemText("Example CMS runs and serves the Headless API on port 3000."),
        guideListItemText("fetch-export.ts downloads a validated public export and assets."),
        guideListItemText("Astro builds static HTML from .generated/public-export.json."),
        guideListItemText("Comment submission is the only piece that calls the API at runtime."),
      ]),
      guideHeading(2, "Why static?"),
      guideParagraphText(
        "Posts, authors, categories, tags, and guides change on editorial cadence, not on every page view.",
      ),
      guideParagraphText(
        "A static snapshot keeps hosting simple, makes caching trivial, and proves the Headless API is a clean boundary between CMS and site.",
      ),
      guideHeading(2, "Your stack, your templates"),
      guideParagraphText(
        "This site uses Astro and Tailwind. Yours might be Next.js, Eleventy, or a mobile app. The contract is the export shape from the Headless API, not the library's internal types.",
      ),
      guideHeading(2, "Try it locally"),
      guideCodeBlock(`# Terminal 1: start the CMS
cd apps/example-cms && bun run dev

# Terminal 2: build and serve the blog
cd apps/public-blog && bun run build && bun run dev`),
      guideParagraphText(
        "Browse the archive, read a post, submit a comment. Open the Example CMS dashboard to approve the comment and trigger a rebuild.",
      ),
    ),
  guideSeedDefinitions: readonly GuideSeedDefinition[] = [
    {
      body: guideSeedGettingStartedBody(),
      description:
        "Nearly Headless CMS is a library, not a hosted product. You compose a CMS from services. This page gets you to a working in-memory CMS in a few lines.",
      nextGuideSlug: "defining-content",
      slug: "getting-started",
      sortOrder: 1,
      title: "Getting started",
    },
    {
      body: guideSeedDefiningContentBody(),
      description:
        "Content types are TypeScript. Describe fields, compile a snapshot once, and every entry is validated against it.",
      nextGuideSlug: "providing-layers",
      slug: "defining-content",
      sortOrder: 2,
      title: "Define your content",
    },
    {
      body: guideSeedProvidingLayersBody(),
      description:
        "The CMS service is pluggable. Provide one layer per dependency, or use the bundled convenience layers to get running faster.",
      nextGuideSlug: "building-a-site",
      slug: "providing-layers",
      sortOrder: 3,
      title: "Provide layers",
    },
    {
      body: guideSeedBuildingSiteBody(),
      description:
        "A headless CMS stores and serves content. Your site turns that content into pages. This blog fetches a static export at build time.",
      slug: "building-a-site",
      sortOrder: 4,
      title: "Build a content site",
    },
  ],
  guideSeedEntryId = (result: Cms.MutationResult): string => {
    if ("writeToken" in result) {
      return result.entry.id;
    }
    return result.id;
  },
  guideSeedFindExisting = (
    cms: Readonly<Cms.ServiceShape>,
  ): Effect.Effect<boolean, CmsError.CmsError> =>
    Effect.map(
      cms.queryEntries({
        contentTypeId: "guide",
        pageSize: 1,
        where: { operator: "equals", path: "slug", value: guideSeedSlug },
      }),
      (page) => page.items.length > 0,
    ),
  guideSeedCreateGuide = (
    cms: Readonly<Cms.ServiceShape>,
    definition: Readonly<GuideSeedDefinition>,
  ): Effect.Effect<string, CmsError.CmsError> =>
    Effect.map(
      cms.createEntry({
        contentTypeId: "guide",
        values: {
          body: guideRichTextJsonObject(definition.body),
          description: definition.description,
          "next-guide": null,
          slug: definition.slug,
          "sort-order": definition.sortOrder,
          status: "published",
          title: definition.title,
        },
      }),
      guideSeedEntryId,
    ),
  guideSeedLinkNextGuides = (
    cms: Readonly<Cms.ServiceShape>,
    identifiers: Readonly<GuideSeedIdentifiers>,
  ): Effect.Effect<void, CmsError.CmsError> =>
    Effect.gen(function* linkNextGuidesEffect() {
      const nextGuideLinks = [
        { entryId: identifiers.gettingStartedId, nextGuideId: identifiers.definingContentId },
        { entryId: identifiers.definingContentId, nextGuideId: identifiers.providingLayersId },
        { entryId: identifiers.providingLayersId, nextGuideId: identifiers.buildingSiteId },
      ] as const;
      for (const link of nextGuideLinks) {
        const entry = yield* cms.getCurrentEntryState({
          contentTypeId: "guide",
          entryId: link.entryId,
        });
        yield* cms.updateEntry({
          contentTypeId: "guide",
          entryId: link.entryId,
          values: { ...entry.entry.values, "next-guide": link.nextGuideId },
          writeToken: entry.writeToken,
        });
      }
    }),
  guideSeedWriteGuides = (
    cms: Readonly<Cms.ServiceShape>,
  ): Effect.Effect<GuideSeedIdentifiers, CmsError.CmsError> =>
    Effect.gen(function* writeGuideEntriesEffect() {
      const gettingStartedId = yield* guideSeedCreateGuide(cms, guideSeedDefinitions[0]!),
        definingContentId = yield* guideSeedCreateGuide(cms, guideSeedDefinitions[1]!),
        providingLayersId = yield* guideSeedCreateGuide(cms, guideSeedDefinitions[2]!),
        buildingSiteId = yield* guideSeedCreateGuide(cms, guideSeedDefinitions[3]!),
        identifiers = {
          buildingSiteId,
          definingContentId,
          gettingStartedId,
          providingLayersId,
        } satisfies GuideSeedIdentifiers;
      yield* guideSeedLinkNextGuides(cms, identifiers);
      return identifiers;
    }),
  zSeedGuides = Effect.gen(function* seedGuides() {
    const cms = yield* Cms.Service,
      guidesAlreadyExist = yield* guideSeedFindExisting(cms);
    if (guidesAlreadyExist) {
      return;
    }
    yield* guideSeedWriteGuides(cms);
  });

/** Idempotently creates the Example CMS guide entries. */
export { zSeedGuides as seedGuides };
