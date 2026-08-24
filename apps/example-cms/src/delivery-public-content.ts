import { type Cms, EntryQuery } from "nearly-headless-cms";
import { Schema } from "effect";

interface PublicReachabilityInput {
  readonly authors: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly categories: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly posts: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly tags: readonly Cms.ConsistentReadSnapshot["entries"][number][];
}

interface QuerySnapshotInput {
  readonly consistentSnapshot: Cms.ConsistentReadSnapshot;
  readonly contentTypeId: string;
  readonly sort?: readonly EntryQuery.Sort[];
  readonly where?: EntryQuery.Predicate;
}

interface ReachabilityState {
  readonly entriesByIdentifier: ReadonlyMap<string, Cms.ConsistentReadSnapshot["entries"][number]>;
  readonly pendingDocuments: unknown[];
  readonly publicAuthorIdentifiers: Set<string>;
  readonly publicCategoryIdentifiers: Set<string>;
  readonly publicTagIdentifiers: Set<string>;
  readonly richTextReachableIdentifiers: Set<string>;
}

const appendReachableRichTextEntry = (
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
  publicAssetIds = (
    posts: readonly { readonly values: Record<string, unknown> }[],
    authors: readonly { readonly values: Record<string, unknown> }[],
  ): ReadonlySet<string> => {
    const assetIds = new Set<string>();
    for (const post of posts) {
      const featuredAssetId = post.values["featured-asset"];
      if (typeof featuredAssetId === "string") {
        assetIds.add(featuredAssetId);
      }
      collectRichTextAssetIds(post.values["body"], assetIds);
    }
    for (const author of authors) {
      const portraitAssetId = author.values["portrait"];
      if (typeof portraitAssetId === "string") {
        assetIds.add(portraitAssetId);
      }
      collectRichTextAssetIds(author.values["profile"], assetIds);
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
      }),
      comments = querySnapshot({
        consistentSnapshot,
        contentTypeId: "comment",
        sort: [{ direction: "ascending", path: "created-at" }],
        where: { operator: "equals", path: "status", value: "approved" },
      }).filter((comment) => {
        const postIdentifier = comment.values["post"];
        return (
          typeof postIdentifier === "string" &&
          reachability.publishedPostIdentifiers.has(postIdentifier)
        );
      });
    return {
      authors: allAuthors.filter((author) => reachability.publicAuthorIdentifiers.has(author.id)),
      categories: allCategories.filter((category) =>
        reachability.publicCategoryIdentifiers.has(category.id),
      ),
      comments,
      posts,
      reachability,
      tags: allTags.filter((tag) => reachability.publicTagIdentifiers.has(tag.id)),
    };
  },
  publicReachability = ({ authors, categories, posts, tags }: PublicReachabilityInput) => {
    const publicAuthorIdentifiers = new Set(relationshipIdentifiers(posts, "author")),
      publicCategoryIdentifiers = new Set(relationshipIdentifiers(posts, "categories")),
      publicTagIdentifiers = new Set(relationshipIdentifiers(posts, "tags")),
      publishedPostIdentifiers = new Set(posts.map((post) => post.id)),
      reachabilityState: ReachabilityState = {
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
      };
    while (reachabilityState.pendingDocuments.length > 0) {
      const discoveredIdentifiers = new Set<string>();
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
  querySnapshot = ({
    consistentSnapshot,
    contentTypeId,
    sort,
    where,
  }: QuerySnapshotInput): readonly Cms.ConsistentReadSnapshot["entries"][number][] => {
    const entries: Cms.ConsistentReadSnapshot["entries"][number][] = [];
    let cursor: string | undefined = undefined;
    do {
      const query = { contentTypeId, cursor, pageSize: 100 } as {
        contentTypeId: string;
        cursor: string | undefined;
        pageSize: number;
        sort?: readonly EntryQuery.Sort[];
        where?: EntryQuery.Predicate;
      };
      if (sort !== undefined) {
        query.sort = sort;
      }
      if (where !== undefined) {
        query.where = where;
      }
      const page = EntryQuery.evaluate({
        entries: consistentSnapshot.entries,
        options: { generation: consistentSnapshot.generation },
        query,
        snapshot: consistentSnapshot.definitionSnapshot,
      });
      entries.push(...page.items);
      cursor = page.nextCursor;
    } while (cursor !== undefined);
    return entries;
  },
  relationshipIdentifiers = (
    posts: readonly Cms.ConsistentReadSnapshot["entries"][number][],
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
