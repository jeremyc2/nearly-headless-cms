import type { Cms, ContentDefinition } from "nearly-headless-cms";
import { CmsError, EntryQuery } from "nearly-headless-cms";
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
  ): HttpContract.OperationSchemas => ({
    pathParameters,
    ...(includePagination ? { queryParameters: PageQuery } : {}),
    request: EmptyRequest,
    response,
  });

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
  queryAll = (
    cms: Cms.ServiceShape,
    contentTypeId: string,
    where?: EntryQuery.Predicate,
    sort?: readonly EntryQuery.Sort[],
  ): Effect.Effect<readonly Cms.ConsistentReadSnapshot["entries"][number][], CmsError.CmsError> =>
    Effect.gen(function* queryEveryPage() {
      const entries: Cms.ConsistentReadSnapshot["entries"][number][] = [];
      let cursor: string | undefined;
      do {
        const page = yield* cms.queryEntries({ contentTypeId, cursor, pageSize: 100, sort, where });
        entries.push(...page.items);
        cursor = page.nextCursor;
      } while (cursor !== undefined);
      return entries;
    }),
  queryPage = (
    cms: Cms.ServiceShape,
    request: Request,
    contentTypeId: string,
    where?: EntryQuery.Predicate,
    sort?: readonly EntryQuery.Sort[],
  ) => {
    const requestUrl = new URL(request.url),
      pageSize = Number(requestUrl.searchParams.get("pageSize") ?? "20"),
      cursor = requestUrl.searchParams.get("cursor") ?? undefined;
    return cms.queryEntries({ contentTypeId, cursor, pageSize, sort, where }).pipe(
      Effect.map((page) => ({
        items: page.items.map(publicValue),
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      })),
    );
  },
  parseBody = (
    request: Request,
  ): Effect.Effect<ContentDefinition.JsonObject, CmsError.InvalidInput> =>
    Effect.tryPromise({
      catch: (cause) =>
        cause instanceof CmsError.InvalidInput
          ? cause
          : CmsError.InvalidInput.make({ message: "Malformed Comment submission" }),
      try: async () => {
        if (!(request.headers.get("content-type") ?? "").startsWith("application/json"))
          throw CmsError.InvalidInput.make({
            message: "Comment submission requires application/json",
          });
        const value = (await request.json()) as unknown;
        if (!Schema.is(Schema.JsonObject)(value))
          throw CmsError.InvalidInput.make({ message: "Comment submission must be an object" });
        return value;
      },
    }),
  findBySlug = (cms: Cms.ServiceShape, contentTypeId: string, slug: string, publicOnly = false) =>
    queryAll(
      cms,
      contentTypeId,
      publicOnly
        ? {
            all: [
              { operator: "equals", path: "slug", value: slug },
              { operator: "equals", path: "status", value: "published" },
            ],
          }
        : { operator: "equals", path: "slug", value: slug },
    ).pipe(
      Effect.flatMap((entries) =>
        entries[0] === undefined
          ? Effect.fail(CmsError.NotFound.make({ message: `${contentTypeId} was not found` }))
          : Effect.succeed(publicValue(entries[0])),
      ),
    ),
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
  querySnapshot = (
    consistentSnapshot: Cms.ConsistentReadSnapshot,
    contentTypeId: string,
    where?: EntryQuery.Predicate,
    sort?: readonly EntryQuery.Sort[],
  ): readonly Cms.ConsistentReadSnapshot["entries"][number][] => {
    const entries: Cms.ConsistentReadSnapshot["entries"][number][] = [];
    let cursor: string | undefined;
    do {
      const page = EntryQuery.evaluate(
        consistentSnapshot.entries,
        {
          contentTypeId,
          cursor,
          pageSize: 100,
          ...(sort === undefined ? {} : { sort }),
          ...(where === undefined ? {} : { where }),
        },
        consistentSnapshot.definitionSnapshot,
        { generation: consistentSnapshot.generation },
      );
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
  publicReachability = (
    posts: readonly Cms.ConsistentReadSnapshot["entries"][number][],
    authors: readonly Cms.ConsistentReadSnapshot["entries"][number][],
    categories: readonly Cms.ConsistentReadSnapshot["entries"][number][],
    tags: readonly Cms.ConsistentReadSnapshot["entries"][number][],
  ) => {
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
        if (richTextReachableIdentifiers.has(entryIdentifier)) {
          continue;
        }
        const entry = entriesByIdentifier.get(entryIdentifier);
        if (
          entry === undefined ||
          (entry.contentTypeId === "post" && entry.values["status"] !== "published")
        ) {
          continue;
        }
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
    return {
      publishedPostIdentifiers,
      publicAuthorIdentifiers,
      publicCategoryIdentifiers,
      publicTagIdentifiers,
      richTextReachableIdentifiers,
    };
  },
  publicContent = (consistentSnapshot: Cms.ConsistentReadSnapshot) => {
    const posts = querySnapshot(
        consistentSnapshot,
        "post",
        { operator: "equals", path: "status", value: "published" },
        [{ direction: "descending", path: "published-at" }],
      ),
      allAuthors = querySnapshot(consistentSnapshot, "author"),
      allCategories = querySnapshot(consistentSnapshot, "category"),
      allTags = querySnapshot(consistentSnapshot, "tag"),
      reachability = publicReachability(posts, allAuthors, allCategories, allTags),
      comments = querySnapshot(
        consistentSnapshot,
        "comment",
        { operator: "equals", path: "status", value: "approved" },
        [{ direction: "ascending", path: "created-at" }],
      ).filter((comment) => {
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
        const content = publicContent(consistentSnapshot),
          entries =
            contentTypeId === "author"
              ? content.authors
              : contentTypeId === "category"
                ? content.categories
                : content.tags,
          entry = entries.find((candidate) => candidate.values["slug"] === slug);
        return entry === undefined
          ? Effect.fail(CmsError.NotFound.make({ message: `${contentTypeId} was not found` }))
          : Effect.succeed(publicValue(entry));
      }),
    ),
  publicAssetResponse = (
    asset: Awaited<
      ReturnType<Cms.ServiceShape["readAsset"]> extends Effect.Effect<infer Value, unknown>
        ? Value
        : never
    >,
    request: Request,
    requestId: string,
    definitionFingerprint: string,
  ): Response => {
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
      return new Response(request.method === "HEAD" ? null : asset.bytes.slice().buffer, {
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
      const start =
          match[1] === ""
            ? Math.max(0, asset.bytes.byteLength - Number(match[2]))
            : Number(match[1]),
        end =
          match[1] === ""
            ? asset.bytes.byteLength - 1
            : match[2] === ""
              ? asset.bytes.byteLength - 1
              : Number(match[2]);
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end < start ||
        start >= asset.bytes.byteLength
      ) {
        headers.set("content-range", `bytes */${asset.bytes.byteLength}`);
        headers.delete("content-length");
        return new Response(null, { headers, status: 416 });
      }
      const boundedEnd = Math.min(end, asset.bytes.byteLength - 1),
        bytes = asset.bytes.slice(start, boundedEnd + 1);
      headers.set("content-range", `bytes ${start}-${boundedEnd}/${asset.bytes.byteLength}`);
      headers.set("content-length", String(bytes.byteLength));
      return new Response(request.method === "HEAD" ? null : bytes.buffer, {
        headers,
        status: 206,
      });
    }
    return new Response(request.method === "HEAD" ? null : asset.bytes.slice().buffer, {
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
          queryPage(
            cms,
            request,
            "post",
            { operator: "equals", path: "status", value: "published" },
            [{ direction: "descending", path: "published-at" }],
          ),
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
        execute: ({ cms, parameters }) => findBySlug(cms, "post", parameters["slug"]!, true),
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
              contentTypeId === "author"
                ? authorDefinitionRequirement
                : taxonomyDefinitionRequirement(contentTypeId),
              postDefinitionRequirement,
            ],
            execute: ({ cms, parameters }) =>
              publicOwnerBySlug(cms, contentTypeId, parameters["slug"]!),
            identifier: `getPublic${contentTypeId[0]!.toUpperCase()}${contentTypeId.slice(1)}BySlug`,
            method: "GET",
            path: `/${contentTypeId === "category" ? "categories" : `${contentTypeId}s`}/{slug}`,
            reachableContentTypeIds: [contentTypeId, "post"],
            schemas: readSchemas(contentTypeId === "author" ? PublicAuthor : PublicTaxonomy, {
              slug: Identifier,
            }),
          },
          {
            definitionRequirements: [
              contentTypeId === "author"
                ? authorDefinitionRequirement
                : taxonomyDefinitionRequirement(contentTypeId),
              postDefinitionRequirement,
            ],
            execute: ({ cms, parameters, request }) =>
              Effect.gen(function* () {
                const owner = yield* publicOwnerBySlug(cms, contentTypeId, parameters["slug"]!);
                const ownerIdentifier = owner["id"];
                if (typeof ownerIdentifier !== "string") {
                  return yield* CmsError.InvalidInput.make({
                    message: `Public ${contentTypeId} has an invalid identifier`,
                  });
                }
                const relationshipPath =
                  contentTypeId === "author"
                    ? "author"
                    : contentTypeId === "category"
                      ? "categories"
                      : "tags";
                return yield* queryPage(
                  cms,
                  request,
                  "post",
                  {
                    all: [
                      { operator: "equals", path: "status", value: "published" },
                      { operator: "equals", path: relationshipPath, value: ownerIdentifier },
                    ],
                  },
                  [{ direction: "descending", path: "published-at" }],
                );
              }),
            identifier: `list${contentTypeId[0]!.toUpperCase()}${contentTypeId.slice(1)}Posts`,
            method: "GET",
            path: `/${contentTypeId === "category" ? "categories" : `${contentTypeId}s`}/{slug}/posts`,
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
              entryId: parameters["postId"]!,
            });
            if (post.values["status"] !== "published") {
              return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
            }
            return yield* queryPage(
              cms,
              request,
              "comment",
              {
                all: [
                  { operator: "equals", path: "post", value: post.id },
                  { operator: "equals", path: "status", value: "approved" },
                ],
              },
              [{ direction: "ascending", path: "created-at" }],
            );
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
          Effect.gen(function* () {
            const idempotencyKey = request.headers.get("idempotency-key")!;
            const body = yield* parseBody(request);
            const canonicalInput = JSON.stringify(body, (_propertyName, leftValue) => {
              if (leftValue === null || typeof leftValue !== "object" || Array.isArray(leftValue)) {
                return leftValue;
              }
              const entries = Object.entries(leftValue).sort(([leftKey], [rightKey]) =>
                leftKey.localeCompare(rightKey),
              );
              return Object.fromEntries(entries);
            });
            const prior = yield* Effect.tryPromise({
              catch: (cause) =>
                CmsError.InfrastructureFailure.make({
                  cause,
                  message: "Comment receipt lookup failed",
                  retryable: true,
                }),
              try: () =>
                commandReceiptStore.read(
                  `comment-submission:${parameters["postId"]!}`,
                  idempotencyKey,
                ),
            });
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
              if (prior.canonicalInput !== canonicalInput)
                return yield* CmsError.IdempotencyConflict.make({
                  message: "Idempotency key was reused with different Comment input",
                });
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
              entryId: parameters["postId"]!,
            });
            if (post.values["status"] !== "published")
              return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
            const displayName = body["displayName"];
            const commentBody = body["body"];
            const websiteUrl = body["websiteUrl"];
            if (
              typeof displayName !== "string" ||
              typeof commentBody !== "string" ||
              (websiteUrl !== undefined && websiteUrl !== null && typeof websiteUrl !== "string")
            )
              return yield* CmsError.InvalidInput.make({ message: "Comment fields are invalid" });
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
            });
            const submissionId = "writeToken" in result ? result.entry.id : result.id;
            const receipt = { status: "pending", submissionId };
            yield* Effect.tryPromise({
              catch: (cause) =>
                CmsError.InfrastructureFailure.make({
                  cause,
                  message: "Comment receipt persistence failed",
                  retryable: true,
                }),
              try: () =>
                commandReceiptStore.write(
                  `comment-submission:${parameters["postId"]!}`,
                  idempotencyKey,
                  { canonicalInput, receipt },
                ),
            });
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
          Effect.gen(function* () {
            const consistentSnapshot = yield* cms.readConsistentSnapshot,
              content = publicContent(consistentSnapshot),
              entryIdentifier = parameters["entryId"]!;
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
            Effect.gen(function* () {
              const consistentSnapshot = yield* cms.readConsistentSnapshot,
                content = publicContent(consistentSnapshot),
                assetIdentifier = parameters["assetId"]!;
              if (!publicAssetIds(content.posts, content.authors).has(assetIdentifier))
                return yield* CmsError.NotFound.make({ message: "Public Asset was not found" });
              const asset = yield* cms.readAsset(assetIdentifier);
              return publicAssetResponse(asset, request, requestId, snapshot.fingerprint);
            }),
          identifier: method === "GET" ? "deliverPublicAsset" : "inspectPublicAsset",
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
          Effect.gen(function* () {
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
            if (bytes.byteLength > 5_000_000)
              return yield* CmsError.ExportTooLarge.make({
                message: "Public Content Export exceeds the configured 5000000-byte bound",
              });
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
            return request.headers.get("if-none-match") === etag
              ? new Response(null, { headers, status: 304 })
              : new Response(bytes, { headers, status: 200 });
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
