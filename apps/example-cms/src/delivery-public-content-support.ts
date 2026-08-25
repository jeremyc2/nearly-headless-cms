import type {
  PublicReachabilityInput,
  ReachabilityState,
  SnapshotEntry,
} from "./delivery-public-content-types.ts";
import type { Cms } from "nearly-headless-cms";
import { Schema } from "effect";
import deliveryPublicContentQuerySupport from "./delivery-public-content-query-support.ts";

const { querySnapshot } = deliveryPublicContentQuerySupport,
  appendReachableRichTextEntry = (
    discoveredIdentifier: string,
    state: ReachabilityState,
  ): void => {
    if (state.richTextReachableIdentifiers.has(discoveredIdentifier)) {
      return;
    }
    const entry = state.entriesByIdentifier.get(discoveredIdentifier);
    if (entry === undefined) {
      return;
    }
    if (entry.contentTypeId === "post" && entry.values["status"] !== "published") {
      return;
    }
    state.richTextReachableIdentifiers.add(discoveredIdentifier);
    applyReachableEntrySideEffects(discoveredIdentifier, entry, state);
  },
  applyReachableEntrySideEffects = (
    discoveredIdentifier: string,
    entry: SnapshotEntry,
    state: ReachabilityState,
  ): void => {
    if (entry.contentTypeId === "author") {
      state.publicAuthorIdentifiers.add(discoveredIdentifier);
      state.pendingDocuments.push(entry.values["profile"]);
      return;
    }
    if (entry.contentTypeId === "category") {
      state.publicCategoryIdentifiers.add(discoveredIdentifier);
      return;
    }
    if (entry.contentTypeId === "tag") {
      state.publicTagIdentifiers.add(discoveredIdentifier);
    }
  },
  collectAuthorAssetIds = (
    author: { readonly values: Record<string, unknown> },
    assetIds: Set<string>,
  ): void => {
    const portraitAssetId = author.values["portrait"];
    if (typeof portraitAssetId === "string") {
      assetIds.add(portraitAssetId);
    }
    collectRichTextAssetIds(author.values["profile"], assetIds);
  },
  collectPostAssetIds = (
    post: { readonly values: Record<string, unknown> },
    assetIds: Set<string>,
  ): void => {
    const featuredAssetId = post.values["featured-asset"];
    if (typeof featuredAssetId === "string") {
      assetIds.add(featuredAssetId);
    }
    collectRichTextAssetIds(post.values["body"], assetIds);
  },
  collectRichTextAssetIds = (value: unknown, assetIds: Set<string>): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        collectRichTextAssetIds(item, assetIds);
      }
      return;
    }
    if (!Schema.is(Schema.JsonObject)(value)) {
      return;
    }
    if (value["type"] === "asset-reference" && typeof value["assetId"] === "string") {
      assetIds.add(value["assetId"]);
    }
    for (const child of Object.values(value)) {
      collectRichTextAssetIds(child, assetIds);
    }
  },
  collectRichTextEntryIds = (value: unknown, entryIds: Set<string>): void => {
    if (Array.isArray(value)) {
      for (const item of value) {
        collectRichTextEntryIds(item, entryIds);
      }
      return;
    }
    if (!Schema.is(Schema.JsonObject)(value)) {
      return;
    }
    if (value["type"] === "entry-reference" && typeof value["entryId"] === "string") {
      entryIds.add(value["entryId"]);
    }
    for (const child of Object.values(value)) {
      collectRichTextEntryIds(child, entryIds);
    }
  },
  createReachabilityState = ({
    authors,
    categories,
    posts,
    tags,
  }: PublicReachabilityInput): {
    readonly publishedPostIdentifiers: Set<string>;
    readonly reachabilityState: ReachabilityState;
  } => {
    const publicAuthorIdentifiers = new Set(relationshipIdentifiers(posts, "author")),
      publicCategoryIdentifiers = new Set(relationshipIdentifiers(posts, "categories")),
      publicTagIdentifiers = new Set(relationshipIdentifiers(posts, "tags")),
      publishedPostIdentifiers = new Set(posts.map((post) => post.id));
    return {
      publishedPostIdentifiers,
      reachabilityState: {
        entriesByIdentifier: new Map(
          [...posts, ...authors, ...categories, ...tags].map((entry) => [entry.id, entry]),
        ),
        pendingDocuments: [
          ...posts.map((post) => post.values["body"]),
          ...authors
            .filter((author) => publicAuthorIdentifiers.has(author.id))
            .map((author) => author.values["profile"]),
        ],
        publicAuthorIdentifiers,
        publicCategoryIdentifiers,
        publicTagIdentifiers,
        richTextReachableIdentifiers: new Set<string>(),
      },
    };
  },
  publicApprovedComments = (
    consistentSnapshot: Cms.ConsistentReadSnapshot,
    publishedPostIdentifiers: ReadonlySet<string>,
  ) =>
    querySnapshot({
      consistentSnapshot,
      contentTypeId: "comment",
      sort: [{ direction: "ascending", path: "created-at" }],
      where: { operator: "equals", path: "status", value: "approved" },
    }).filter((comment) => {
      const postIdentifier = comment.values["post"];
      return typeof postIdentifier === "string" && publishedPostIdentifiers.has(postIdentifier);
    }),
  publicAssetIds = (
    posts: readonly { readonly values: Record<string, unknown> }[],
    authors: readonly { readonly values: Record<string, unknown> }[],
  ): ReadonlySet<string> => {
    const assetIds = new Set<string>();
    for (const post of posts) {
      collectPostAssetIds(post, assetIds);
    }
    for (const author of authors) {
      collectAuthorAssetIds(author, assetIds);
    }
    return assetIds;
  },
  publicContent = (consistentSnapshot: Cms.ConsistentReadSnapshot) => {
    const allAuthors = querySnapshot({ consistentSnapshot, contentTypeId: "author" }),
      allCategories = querySnapshot({ consistentSnapshot, contentTypeId: "category" }),
      allTags = querySnapshot({ consistentSnapshot, contentTypeId: "tag" }),
      posts = querySnapshot({
        consistentSnapshot,
        contentTypeId: "post",
        sort: [{ direction: "descending", path: "published-at" }],
        where: { operator: "equals", path: "status", value: "published" },
      }),
      reachability = publicReachability({
        authors: allAuthors,
        categories: allCategories,
        posts,
        tags: allTags,
      });
    return {
      authors: allAuthors.filter((author) => reachability.publicAuthorIdentifiers.has(author.id)),
      categories: allCategories.filter((category) =>
        reachability.publicCategoryIdentifiers.has(category.id),
      ),
      comments: publicApprovedComments(consistentSnapshot, reachability.publishedPostIdentifiers),
      posts,
      reachability,
      tags: allTags.filter((tag) => reachability.publicTagIdentifiers.has(tag.id)),
    };
  },
  publicReachability = ({ authors, categories, posts, tags }: PublicReachabilityInput) => {
    const { publishedPostIdentifiers, reachabilityState } = createReachabilityState({
        authors,
        categories,
        posts,
        tags,
      }),
      discoveredIdentifiers = new Set<string>();
    while (reachabilityState.pendingDocuments.length > 0) {
      discoveredIdentifiers.clear();
      collectRichTextEntryIds(reachabilityState.pendingDocuments.pop(), discoveredIdentifiers);
      for (const entryIdentifier of discoveredIdentifiers) {
        appendReachableRichTextEntry(entryIdentifier, reachabilityState);
      }
    }
    return {
      publicAuthorIdentifiers: reachabilityState.publicAuthorIdentifiers,
      publicCategoryIdentifiers: reachabilityState.publicCategoryIdentifiers,
      publicTagIdentifiers: reachabilityState.publicTagIdentifiers,
      publishedPostIdentifiers,
      richTextReachableIdentifiers: reachabilityState.richTextReachableIdentifiers,
    };
  },
  relationshipIdentifiers = (
    posts: readonly SnapshotEntry[],
    relationshipField: "author" | "categories" | "tags",
  ): ReadonlySet<string> => {
    const identifiers = new Set<string>();
    for (const post of posts) {
      const value = post.values[relationshipField];
      if (typeof value === "string") {
        identifiers.add(value);
      } else if (Array.isArray(value)) {
        for (const item of value) {
          if (typeof item === "string") {
            identifiers.add(item);
          }
        }
      }
    }
    return identifiers;
  };

export default {
  publicAssetIds,
  publicContent,
  publicReachability,
};
