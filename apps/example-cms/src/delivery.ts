import { type Cms, CmsError, type ContentDefinition, EntryQuery } from "nearly-headless-cms";
import type { HttpContract } from "nearly-headless-cms/http";
import { Effect, Schema } from "effect";
import { type CommandReceiptStore, memoryCommandReceiptStore } from "./command-receipt-store.ts";
import {
  AssetBytes,
  CommentReceipt,
  CommentSubmission,
  EmptyRequest,
  EntryPage,
  Identifier,
  PageQuery,
  PublicAuthor,
  PublicBlogExport,
  PublicComment,
  PublicEntryReference,
  PublicPost,
  PublicTaxonomy,
} from "./wire-schemas.ts";

type PublicValue = ContentDefinition.JsonObject;

interface QueryEntriesInput {
  readonly cms: Cms.ServiceShape;
  readonly contentTypeId: string;
  readonly sort?: readonly EntryQuery.Sort[];
  readonly where?: EntryQuery.Predicate;
}

interface QueryPageInput extends QueryEntriesInput {
  readonly request: Request;
}

interface FindBySlugInput {
  readonly cms: Cms.ServiceShape;
  readonly contentTypeId: string;
  readonly publicOnly?: boolean;
  readonly slug: string;
}

interface QuerySnapshotInput {
  readonly consistentSnapshot: Cms.ConsistentReadSnapshot;
  readonly contentTypeId: string;
  readonly sort?: readonly EntryQuery.Sort[];
  readonly where?: EntryQuery.Predicate;
}

interface PublicReachabilityInput {
  readonly authors: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly categories: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly posts: readonly Cms.ConsistentReadSnapshot["entries"][number][];
  readonly tags: readonly Cms.ConsistentReadSnapshot["entries"][number][];
}

interface PublicAssetResponseInput {
  readonly asset: Awaited<
    ReturnType<Cms.ServiceShape["readAsset"]> extends Effect.Effect<infer Value, unknown>
      ? Value
      : never
  >;
  readonly definitionFingerprint: string;
  readonly request: Request;
  readonly requestId: string;
}

const DEFAULT_PAGE_SIZE = 20,
  FIRST_INDEX = 0,
  MAX_PUBLIC_EXPORT_BYTES = 5_000_000,
  MAX_QUERY_PAGE_SIZE = 100,
  ONE_ITEM = 1,
  requiredParameter = (
    parameters: Readonly<Record<string, string | undefined>>,
    name: string,
  ): string => {
    const value = parameters[name];
    if (value === undefined) {
      throw new Error(`Missing required parameter: ${name}`);
    }
    return value;
  };

export const postDefinitionRequirement = {
    contentTypeId: "post",
    fields: [
      { kind: "text", path: "title", projectable: true, required: true },
      { kind: "text", path: "slug", projectable: true, required: true },
      { kind: "text", path: "excerpt", projectable: true, required: true },
      { formatVersion: 1, kind: "rich-text", path: "body", projectable: true, required: true },
      { kind: "asset", path: "featured-asset", projectable: true },
      { kind: "text", path: "featured-alternative-text", projectable: true },
      { kind: "relationship", path: "author", projectable: true, required: true },
      { kind: "list", path: "categories", projectable: true },
      { kind: "list", path: "tags", projectable: true },
      { kind: "enum", path: "status", projectable: true, required: true },
      { kind: "datetime", path: "published-at", projectable: true },
    ],
  } as const,
  authorDefinitionRequirement = {
    contentTypeId: "author",
    fields: [
      { kind: "text", path: "name", projectable: true, required: true },
      { kind: "text", path: "slug", projectable: true, required: true },
      { kind: "text", path: "biography", projectable: true, required: true },
      { formatVersion: 1, kind: "rich-text", path: "profile", projectable: true },
      { kind: "asset", path: "portrait", projectable: true },
      { kind: "text", path: "portrait-alternative-text", projectable: true },
      { kind: "list", path: "external-links", projectable: true },
    ],
  } as const,
  taxonomyDefinitionRequirement = (contentTypeId: "category" | "tag") =>
    ({
      contentTypeId,
      fields: [
        { kind: "text", path: "name", projectable: true, required: true },
        { kind: "text", path: "slug", projectable: true, required: true },
        { kind: "text", path: "description", projectable: true },
      ],
    }) as const,
  commentDefinitionRequirement = {
    contentTypeId: "comment",
    fields: [
      { kind: "relationship", path: "post", projectable: true, required: true },
      { kind: "text", path: "display-name", projectable: true, required: true },
      { kind: "url", path: "website-url", projectable: true },
      { kind: "text", path: "body", projectable: true, required: true },
      { kind: "datetime", path: "created-at", projectable: true, required: true },
      { kind: "enum", path: "status", projectable: true, required: true },
    ],
  } as const,
  readSchemas = (
    response: HttpContract.OperationSchema,
    pathParameters: Readonly<Record<string, HttpContract.OperationSchema>> = {},
    includePagination = false,
  ): HttpContract.OperationSchemas => {
    if (includePagination) {
      return { pathParameters, queryParameters: PageQuery, request: EmptyRequest, response };
    }
    return { pathParameters, request: EmptyRequest, response };
  };

const lowerCamelCase = (key: string): string =>
    key.replaceAll(/-([a-z])/gu, (_match, letter: string) => letter.toUpperCase()),
  publicValue = (entry: {
    readonly id: string;
    readonly values: ContentDefinition.JsonObject;
  }): PublicValue => ({
    id: entry.id,
    ...Object.fromEntries(
      Object.entries(entry.values).map(([key, value]) => [lowerCamelCase(key), value]),
    ),
  }),
  queryAll = ({
    cms,
    contentTypeId,
    sort,
    where,
  }: QueryEntriesInput): Effect.Effect<
    readonly Cms.ConsistentReadSnapshot["entries"][number][],
    CmsError.CmsError
  > =>
    Effect.gen(function* queryEveryPage() {
      const entries: Cms.ConsistentReadSnapshot["entries"][number][] = [];
      let cursor: string | undefined;
      do {
        const page = yield* cms.queryEntries({
          contentTypeId,
          cursor,
          pageSize: MAX_QUERY_PAGE_SIZE,
          sort,
          where,
        });
        entries.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      return entries;
    }),
  queryPage = ({ cms, contentTypeId, request, sort, where }: QueryPageInput) => {
    const requestUrl = new URL(request.url),
      pageSize = Number(requestUrl.searchParams.get("pageSize") ?? String(DEFAULT_PAGE_SIZE)),
      cursor = requestUrl.searchParams.get("cursor") ?? undefined;
    return cms.queryEntries({ contentTypeId, cursor, pageSize, sort, where }).pipe(
      Effect.map((page) => {
        const result = { items: page.items.map(publicValue) };
        if (page.nextCursor !== undefined) {
          return { ...result, nextCursor: page.nextCursor };
        }
        return result;
      }),
    );
  },
  parseBody = (
    request: Request,
  ): Effect.Effect<ContentDefinition.JsonObject, CmsError.InvalidInput> =>
    Effect.tryPromise({
      catch: (cause) => {
        if (Schema.is(CmsError.InvalidInput)(cause)) {
          return cause;
        }
        return CmsError.InvalidInput.make({ message: "Malformed Comment submission" });
      },
      try: async () => {
        if (!(request.headers.get("content-type") ?? "").startsWith("application/json")) {
          throw CmsError.InvalidInput.make({
            message: "Comment submission requires application/json",
          });
        }
        const value = (await request.json()) as unknown;
        if (!Schema.is(Schema.JsonObject)(value)) {
          throw CmsError.InvalidInput.make({ message: "Comment submission must be an object" });
        }
        return value;
      },
    }),
  findBySlug = ({ cms, contentTypeId, publicOnly = false, slug }: FindBySlugInput) => {
    let where: EntryQuery.Predicate = { operator: "equals", path: "slug", value: slug };
    if (publicOnly) {
      where = {
        all: [
          { operator: "equals", path: "slug", value: slug },
          { operator: "equals", path: "status", value: "published" },
        ],
      };
    }
    return queryAll({ cms, contentTypeId, where }).pipe(
      Effect.flatMap((entries) => {
        const firstEntry = entries[FIRST_INDEX];
        if (firstEntry === undefined) {
          return Effect.fail(CmsError.NotFound.make({ message: `${contentTypeId} was not found` }));
        }
        return Effect.succeed(publicValue(firstEntry));
      }),
    );
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
    posts: readonly { readonly values: ContentDefinition.JsonObject }[],
    authors: readonly { readonly values: ContentDefinition.JsonObject }[],
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
  querySnapshot = ({
    consistentSnapshot,
    contentTypeId,
    sort,
    where,
  }: QuerySnapshotInput): readonly Cms.ConsistentReadSnapshot["entries"][number][] => {
    const entries: Cms.ConsistentReadSnapshot["entries"][number][] = [];
    let cursor: string | undefined;
    do {
      const query = { contentTypeId, cursor, pageSize: 100 } as {
        contentTypeId: string;
        cursor: string | undefined;
        pageSize: number;
        sort?: readonly EntryQuery.Sort[];
        where?: EntryQuery.Predicate;
      };
      if (sort !== undefined) {query.sort = sort;}
      if (where !== undefined) {query.where = where;}
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
  },
  publicReachability = ({ authors, categories, posts, tags }: PublicReachabilityInput) => {
    const publishedPostIdentifiers = new Set(posts.map((post) => post.id)),
      publicAuthorIdentifiers = new Set(relationshipIdentifiers(posts, "author")),
      publicCategoryIdentifiers = new Set(relationshipIdentifiers(posts, "categories")),
      publicTagIdentifiers = new Set(relationshipIdentifiers(posts, "tags")),
      entriesByIdentifier = new Map(
        [...posts, ...authors, ...categories, ...tags].map((entry) => [entry.id, entry]),
      ),
      richTextReachableIdentifiers = new Set<string>(),
      documents: unknown[] = [
        ...posts.map((post) => post.values["body"]),
        ...authors
          .filter((author) => publicAuthorIdentifiers.has(author.id))
          .map((author) => author.values["profile"]),
      ];
    while (documents.length > 0) {
      const discoveredIdentifiers = new Set<string>();
      collectRichTextEntryIds(documents.pop(), discoveredIdentifiers);
      for (const entryIdentifier of discoveredIdentifiers) {
        if (!richTextReachableIdentifiers.has(entryIdentifier)) {
          const entry = entriesByIdentifier.get(entryIdentifier);
          if (
            entry !== undefined &&
            !(entry.contentTypeId === "post" && entry.values["status"] !== "published")
          ) {
            richTextReachableIdentifiers.add(entryIdentifier);
            if (entry.contentTypeId === "author") {
              publicAuthorIdentifiers.add(entryIdentifier);
              documents.push(entry.values["profile"]);
            } else if (entry.contentTypeId === "category") {
              publicCategoryIdentifiers.add(entryIdentifier);
            } else if (entry.contentTypeId === "tag") {
              publicTagIdentifiers.add(entryIdentifier);
            }
          }
        }
      }
    }
    return {
      publicAuthorIdentifiers,
      publicCategoryIdentifiers,
      publicTagIdentifiers,
      publishedPostIdentifiers,
      richTextReachableIdentifiers,
    };
  },
  publicContent = (consistentSnapshot: Cms.ConsistentReadSnapshot) => {
    const posts = querySnapshot({
        consistentSnapshot,
        contentTypeId: "post",
        sort: [{ direction: "descending", path: "published-at" }],
        where: { operator: "equals", path: "status", value: "published" },
      }),
      allAuthors = querySnapshot({ consistentSnapshot, contentTypeId: "author" }),
      allCategories = querySnapshot({ consistentSnapshot, contentTypeId: "category" }),
      allTags = querySnapshot({ consistentSnapshot, contentTypeId: "tag" }),
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
  publicOwnerBySlug = (
    cms: Cms.ServiceShape,
    contentTypeId: "author" | "category" | "tag",
    slug: string,
  ) =>
    cms.readConsistentSnapshot.pipe(
      Effect.flatMap((consistentSnapshot) => {
        const content = publicContent(consistentSnapshot);
        let entries = content.tags;
        if (contentTypeId === "author") {
          entries = content.authors;
        } else if (contentTypeId === "category") {
          entries = content.categories;
        }
        const entry = entries.find((candidate) => candidate.values["slug"] === slug);
        if (entry === undefined) {
          return Effect.fail(CmsError.NotFound.make({ message: `${contentTypeId} was not found` }));
        }
        return Effect.succeed(publicValue(entry));
      }),
    ),
  publicAssetBody = (request: Request, bytes: Uint8Array): ArrayBuffer | null => {
    if (request.method === "HEAD") {return null;}
    return [...bytes].buffer;
  },
  publicOwnerPath = (contentTypeId: "author" | "category" | "tag"): string => {
    if (contentTypeId === "category") {return "categories";}
    return `${contentTypeId}s`;
  },
  publicOwnerDefinition = (contentTypeId: "author" | "category" | "tag") => {
    if (contentTypeId === "author") {return authorDefinitionRequirement;}
    return taxonomyDefinitionRequirement(contentTypeId);
  },
  publicOwnerSchema = (contentTypeId: "author" | "category" | "tag") => {
    if (contentTypeId === "author") {return PublicAuthor;}
    return PublicTaxonomy;
  },
  publicRelationshipPath = (contentTypeId: "author" | "category" | "tag"): string => {
    if (contentTypeId === "author") {return "author";}
    if (contentTypeId === "category") {return "categories";}
    return "tags";
  },
  publicAssetResponse = ({
    asset,
    definitionFingerprint,
    request,
    requestId,
  }: PublicAssetResponseInput): Response => {
    const etag = `"sha256-${asset.metadata.digest}"`,
      headers = new Headers({
        "accept-ranges": "bytes",
        "cache-control": "public, max-age=31536000, immutable",
        "cms-definition-fingerprint": definitionFingerprint,
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(asset.metadata.filename)}`,
        "content-length": String(asset.metadata.byteLength),
        "content-type": asset.metadata.mediaType,
        etag,
        "x-request-id": requestId,
      });
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { headers, status: 304 });
    }
    const range = request.headers.get("range");
    if (
      range !== null &&
      request.headers.get("if-range") !== null &&
      request.headers.get("if-range") !== etag
    ) {
      return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
        headers,
        status: 200,
      });
    }
    if (range !== null) {
      const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
      if (match === null || range.includes(",")) {
        headers.set("content-range", `bytes */${asset.bytes.byteLength}`);
        headers.delete("content-length");
        return new Response(null, { headers, status: 416 });
      }
      let start = Number(match[1]);
      if (match[1] === "") {start = Math.max(FIRST_INDEX, asset.bytes.byteLength - Number(match[2]));}
      let end = Number(match[2]);
      if (match[1] === "" || match[2] === "") {end = asset.bytes.byteLength - ONE_ITEM;}
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < FIRST_INDEX ||
        end < start ||
        start >= asset.bytes.byteLength
      ) {
        headers.set("content-range", `bytes */${asset.bytes.byteLength}`);
        headers.delete("content-length");
        return new Response(null, { headers, status: 416 });
      }
      const boundedEnd = Math.min(end, asset.bytes.byteLength - ONE_ITEM),
        bytes = asset.bytes.slice(start, boundedEnd + 1);
      headers.set("content-range", `bytes ${start}-${boundedEnd}/${asset.bytes.byteLength}`);
      headers.set("content-length", String(bytes.byteLength));
      return new Response(publicAssetBody(request, new Uint8Array(bytes)), {
        headers,
        status: 206,
      });
    }
    return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
      headers,
      status: 200,
    });
  };

export interface DeliveryOperationOptions {
  readonly commandReceiptStore?: CommandReceiptStore;
}

export const makeDeliveryOperations = (
  options: DeliveryOperationOptions = {},
): readonly HttpContract.DeliveryOperation[] => {
  const commandReceiptStore = options.commandReceiptStore ?? memoryCommandReceiptStore(),
    operations: readonly HttpContract.DeliveryOperation[] = [
      {
        definitionRequirements: [
          postDefinitionRequirement,
          authorDefinitionRequirement,
          taxonomyDefinitionRequirement("category"),
          taxonomyDefinitionRequirement("tag"),
        ],
        execute: ({ cms, request }) =>
          queryPage({
            cms,
            contentTypeId: "post",
            request,
            sort: [{ direction: "descending", path: "published-at" }],
            where: { operator: "equals", path: "status", value: "published" },
          }),
        identifier: "listPublishedPosts",
        method: "GET",
        path: "/posts",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
        schemas: readSchemas(EntryPage(PublicPost), {}, true),
      },
      {
        definitionRequirements: [
          postDefinitionRequirement,
          authorDefinitionRequirement,
          taxonomyDefinitionRequirement("category"),
          taxonomyDefinitionRequirement("tag"),
        ],
        execute: ({ cms, parameters }) =>
          findBySlug({
            cms,
            contentTypeId: "post",
            publicOnly: true,
            slug: requiredParameter(parameters, "slug"),
          }),
        identifier: "getPublishedPostBySlug",
        method: "GET",
        path: "/posts/{slug}",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
        schemas: readSchemas(PublicPost, { slug: Identifier }),
      },
      ...(["author", "category", "tag"] as const).flatMap(
        (contentTypeId): readonly HttpContract.DeliveryOperation[] => [
          {
            definitionRequirements: [
              publicOwnerDefinition(contentTypeId),
              postDefinitionRequirement,
            ],
            execute: ({ cms, parameters }) =>
              publicOwnerBySlug(cms, contentTypeId, requiredParameter(parameters, "slug")),
            identifier: `getPublic${contentTypeId.slice(0, 1).toUpperCase()}${contentTypeId.slice(1)}BySlug`,
            method: "GET",
            path: `/${publicOwnerPath(contentTypeId)}/{slug}`,
            reachableContentTypeIds: [contentTypeId, "post"],
            schemas: readSchemas(publicOwnerSchema(contentTypeId), {
              slug: Identifier,
            }),
          },
          {
            definitionRequirements: [
              publicOwnerDefinition(contentTypeId),
              postDefinitionRequirement,
            ],
            execute: ({ cms, parameters, request }) =>
              Effect.gen(function* execute() {
                const owner = yield* publicOwnerBySlug(
                    cms,
                    contentTypeId,
                    requiredParameter(parameters, "slug"),
                  ),
                  ownerIdentifier = owner["id"];
                if (typeof ownerIdentifier !== "string") {
                  return yield* CmsError.InvalidInput.make({
                    message: `Public ${contentTypeId} has an invalid identifier`,
                  });
                }
                const relationshipPath = publicRelationshipPath(contentTypeId);
                return yield* queryPage({
                  cms,
                  contentTypeId: "post",
                  request,
                  sort: [{ direction: "descending", path: "published-at" }],
                  where: {
                    all: [
                      { operator: "equals", path: "status", value: "published" },
                      { operator: "equals", path: relationshipPath, value: ownerIdentifier },
                    ],
                  },
                });
              }),
            identifier: `list${contentTypeId.slice(0, 1).toUpperCase()}${contentTypeId.slice(1)}Posts`,
            method: "GET",
            path: `/${publicOwnerPath(contentTypeId)}/{slug}/posts`,
            reachableContentTypeIds: [contentTypeId, "post"],
            schemas: readSchemas(EntryPage(PublicPost), { slug: Identifier }, true),
          },
        ],
      ),
      {
        definitionRequirements: [postDefinitionRequirement, commentDefinitionRequirement],
        execute: ({ cms, parameters, request }) =>
          Effect.gen(function* listApprovedComments() {
            const post = yield* cms.getEntry({
              contentTypeId: "post",
              entryId: requiredParameter(parameters, "postId"),
            });
            if (post.values["status"] !== "published") {
              return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
            }
            return yield* queryPage({
              cms,
              contentTypeId: "comment",
              request,
              sort: [{ direction: "ascending", path: "created-at" }],
              where: {
                all: [
                  { operator: "equals", path: "post", value: post.id },
                  { operator: "equals", path: "status", value: "approved" },
                ],
              },
            });
          }),
        identifier: "listApprovedComments",
        method: "GET",
        path: "/posts/{postId}/comments",
        reachableContentTypeIds: ["post", "comment"],
        schemas: readSchemas(EntryPage(PublicComment), { postId: Identifier }, true),
      },
      {
        definitionRequirements: [postDefinitionRequirement, commentDefinitionRequirement],
        execute: ({ cms, parameters, request }) =>
          Effect.gen(function* execute() {
            const idempotencyKey = request.headers.get("idempotency-key") ?? "",
              body = yield* parseBody(request),
              canonicalInput = JSON.stringify(body, (_propertyName, leftValue) => {
                if (
                  leftValue === null ||
                  typeof leftValue !== "object" ||
                  Array.isArray(leftValue)
                ) {
                  return leftValue;
                }
                const entries = Object.entries(leftValue).toSorted(([leftKey], [rightKey]) =>
                  leftKey.localeCompare(rightKey),
                );
                return Object.fromEntries(entries);
              }),
              prior = yield* commandReceiptStore
                .read(
                  `comment-submission:${requiredParameter(parameters, "postId")}`,
                  idempotencyKey,
                )
                .pipe(
                  Effect.mapError((cause) =>
                    CmsError.InfrastructureFailure.make({
                      cause,
                      message: "Comment receipt lookup failed",
                      retryable: true,
                    }),
                  ),
                );
            if (
              prior !== undefined &&
              prior !== null &&
              typeof prior === "object" &&
              "canonicalInput" in prior &&
              "receipt" in prior &&
              typeof prior.canonicalInput === "string" &&
              prior.receipt !== null &&
              typeof prior.receipt === "object"
            ) {
              if (prior.canonicalInput !== canonicalInput) {
                return yield* CmsError.IdempotencyConflict.make({
                  message: "Idempotency key was reused with different Comment input",
                });
              }
              if (!Schema.is(Schema.JsonObject)(prior.receipt)) {
                return yield* CmsError.InfrastructureFailure.make({
                  message: "Stored Comment receipt is not JSON-compatible",
                  retryable: false,
                });
              }
              return prior.receipt;
            }
            const post = yield* cms.getEntry({
              contentTypeId: "post",
              entryId: requiredParameter(parameters, "postId"),
            });
            if (post.values["status"] !== "published") {
              return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
            }
            const { displayName } = body,
              commentBody = body["body"],
              { websiteUrl } = body;
            if (
              typeof displayName !== "string" ||
              typeof commentBody !== "string" ||
              (websiteUrl !== undefined && websiteUrl !== null && typeof websiteUrl !== "string")
            ) {
              return yield* CmsError.InvalidInput.make({ message: "Comment fields are invalid" });
            }
            const result = yield* cms.createEntry({
                contentTypeId: "comment",
                values: {
                  body: commentBody,
                  "created-at": new Date().toISOString(),
                  "display-name": displayName,
                  post: post.id,
                  status: "pending",
                  "website-url": websiteUrl ?? null,
                },
              }),
              submissionId = (() => {
                if ("writeToken" in result) {return result.entry.id;}
                return result.id;
              })(),
              receipt = { status: "pending", submissionId };
            yield* commandReceiptStore
              .write(
                `comment-submission:${requiredParameter(parameters, "postId")}`,
                idempotencyKey,
                {
                  canonicalInput,
                  receipt,
                },
              )
              .pipe(
                Effect.mapError((cause) =>
                  CmsError.InfrastructureFailure.make({
                    cause,
                    message: "Comment receipt persistence failed",
                    retryable: true,
                  }),
                ),
              );
            return receipt;
          }),
        identifier: "submitComment",
        method: "POST",
        path: "/posts/{postId}/comments",
        reachableContentTypeIds: ["post", "comment"],
        requiresIdempotencyKey: true,
        schemas: {
          pathParameters: { postId: Identifier },
          request: CommentSubmission,
          requestBody: CommentSubmission,
          requestHeaders: { "idempotency-key": Identifier },
          response: CommentReceipt,
        },
        successStatus: 201,
      },
      {
        definitionRequirements: [
          postDefinitionRequirement,
          authorDefinitionRequirement,
          taxonomyDefinitionRequirement("category"),
          taxonomyDefinitionRequirement("tag"),
        ],
        execute: ({ cms, parameters }) =>
          Effect.gen(function* execute() {
            const consistentSnapshot = yield* cms.readConsistentSnapshot,
              content = publicContent(consistentSnapshot),
              entryIdentifier = requiredParameter(parameters, "entryId");
            if (content.reachability.richTextReachableIdentifiers.has(entryIdentifier)) {
              const entry = [
                ...content.posts,
                ...content.authors,
                ...content.categories,
                ...content.tags,
              ].find((candidate) => candidate.id === entryIdentifier);
              if (entry !== undefined) {
                return publicValue(entry);
              }
            }
            return yield* CmsError.NotFound.make({
              message: "Public Entry reference was not found",
            });
          }),
        identifier: "resolvePublicEntryReference",
        method: "GET",
        path: "/references/entries/{entryId}",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
        schemas: readSchemas(PublicEntryReference, { entryId: Identifier }),
      },
      ...(["GET", "HEAD"] as const).map(
        (method): HttpContract.DeliveryOperation => ({
          cacheControl: "public, max-age=31536000, immutable",
          definitionRequirements: [postDefinitionRequirement, authorDefinitionRequirement],
          execute: ({ cms, parameters, request, requestId, snapshot }) =>
            Effect.gen(function* execute() {
              const consistentSnapshot = yield* cms.readConsistentSnapshot,
                content = publicContent(consistentSnapshot),
                assetIdentifier = requiredParameter(parameters, "assetId");
              if (!publicAssetIds(content.posts, content.authors).has(assetIdentifier)) {
                return yield* CmsError.NotFound.make({ message: "Public Asset was not found" });
              }
              const asset = yield* cms.readAsset(assetIdentifier);
              return publicAssetResponse({
                asset,
                definitionFingerprint: snapshot.fingerprint,
                request,
                requestId,
              });
            }),
          identifier: (() => {
            if (method === "GET") {return "deliverPublicAsset";}
            return "inspectPublicAsset";
          })(),
          method,
          path: "/assets/{assetId}",
          reachableContentTypeIds: ["post", "author", "category", "tag"],
          schemas: {
            pathParameters: { assetId: Identifier },
            request: EmptyRequest,
            response: AssetBytes,
            responseMediaType: "application/octet-stream",
          },
        }),
      ),
      {
        cacheControl: "no-cache",
        definitionRequirements: [
          postDefinitionRequirement,
          authorDefinitionRequirement,
          taxonomyDefinitionRequirement("category"),
          taxonomyDefinitionRequirement("tag"),
          commentDefinitionRequirement,
        ],
        execute: ({ cms, request, requestId }) =>
          Effect.gen(function* execute() {
            const consistentSnapshot = yield* cms.readConsistentSnapshot,
              snapshot = consistentSnapshot.definitionSnapshot,
              content = publicContent(consistentSnapshot),
              reachableAssetIds = publicAssetIds(content.posts, content.authors),
              assets = consistentSnapshot.assets
                .filter((asset) => reachableAssetIds.has(asset.id))
                .map(({ bytes: _bytes, ...asset }) => asset),
              artifact = {
                assets,
                authors: content.authors.map(publicValue),
                categories: content.categories.map(publicValue),
                comments: content.comments.map(publicValue),
                definitionFingerprint: snapshot.fingerprint,
                generatedAt: "2026-08-23T16:00:00.000Z",
                posts: content.posts.map(publicValue),
                tags: content.tags.map(publicValue),
              },
              bytes = new TextEncoder().encode(JSON.stringify(artifact));
            if (bytes.byteLength > MAX_PUBLIC_EXPORT_BYTES) {
              return yield* CmsError.ExportTooLarge.make({
                message: "Public Content Export exceeds the configured 5000000-byte bound",
              });
            }
            const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
              etag = `"sha256-${digest}"`,
              headers = new Headers({
                "cache-control": "no-cache",
                "cms-definition-fingerprint": snapshot.fingerprint,
                "content-length": String(bytes.byteLength),
                "content-type": "application/json; charset=utf-8",
                etag,
                "x-request-id": requestId,
              });
            if (request.headers.get("if-none-match") === etag) {
              return new Response(null, { headers, status: 304 });
            }
            return new Response(bytes, { headers, status: 200 });
          }),
        identifier: "exportPublicBlog",
        method: "GET",
        path: "/export",
        reachableContentTypeIds: ["post", "author", "category", "tag", "comment"],
        schemas: readSchemas(PublicBlogExport),
      },
    ];
  return operations;
};
