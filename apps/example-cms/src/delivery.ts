import type { Cms, ContentDefinition } from "nearly-headless-cms";
import { CmsError, EntryQuery } from "nearly-headless-cms";
import type { HttpContract } from "nearly-headless-cms/http";
import { Effect } from "effect";
import { type CommandReceiptStore, memoryCommandReceiptStore } from "./command-receipt-store.ts";

type PublicValue = ContentDefinition.JsonObject;

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
  ) =>
    cms
      .queryEntries({ contentTypeId, pageSize: 100, sort, where })
      .pipe(Effect.map((page) => page.items)),
  queryPage = (
    cms: Cms.ServiceShape,
    request: Request,
    contentTypeId: string,
    where?: EntryQuery.Predicate,
    sort?: readonly EntryQuery.Sort[],
  ) => {
    const url = new URL(request.url),
      pageSize = Number(url.searchParams.get("pageSize") ?? "20"),
      cursor = url.searchParams.get("cursor") ?? undefined;
    return cms.queryEntries({ contentTypeId, cursor, pageSize, sort, where }).pipe(
      Effect.map((page) => ({
        items: page.items.map(publicValue),
        ...(page.nextCursor === undefined ? {} : { nextCursor: page.nextCursor }),
      })),
    );
  },
  parseBody = (
    request: Request,
  ): Effect.Effect<Readonly<Record<string, unknown>>, CmsError.InvalidInput> =>
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
        if (value === null || Array.isArray(value) || typeof value !== "object")
          throw CmsError.InvalidInput.make({ message: "Comment submission must be an object" });
        return value as Readonly<Record<string, unknown>>;
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
    if (value === null || typeof value !== "object") {
      return;
    }
    const record = value as Readonly<Record<string, unknown>>;
    if (record["type"] === "asset-reference" && typeof record["assetId"] === "string") {
      assetIds.add(record["assetId"]);
    }
    for (const child of Object.values(record)) {
      collectRichTextAssetIds(child, assetIds);
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
  ): readonly Cms.ConsistentReadSnapshot["entries"][number][] =>
    EntryQuery.evaluate(
      consistentSnapshot.entries,
      {
        contentTypeId,
        pageSize: 100,
        ...(sort === undefined ? {} : { sort }),
        ...(where === undefined ? {} : { where }),
      },
      consistentSnapshot.definitionSnapshot,
      { generation: consistentSnapshot.generation },
    ).items,
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
      },
      {
        execute: ({ cms, parameters }) => findBySlug(cms, "post", parameters["slug"]!, true),
        identifier: "getPublishedPostBySlug",
        method: "GET",
        path: "/posts/{slug}",
        reachableContentTypeIds: ["post", "author", "category", "tag"],
      },
      ...(["author", "category", "tag"] as const).flatMap(
        (contentTypeId): readonly HttpContract.DeliveryOperation[] => [
          {
            execute: ({ cms, parameters }) => findBySlug(cms, contentTypeId, parameters["slug"]!),
            identifier: `getPublic${contentTypeId[0]!.toUpperCase()}${contentTypeId.slice(1)}BySlug`,
            method: "GET",
            path: `/${contentTypeId === "category" ? "categories" : `${contentTypeId}s`}/{slug}`,
            reachableContentTypeIds: [contentTypeId, "post"],
          },
          {
            execute: ({ cms, parameters, request }) =>
              Effect.gen(function* () {
                const owner = yield* findBySlug(cms, contentTypeId, parameters["slug"]!);
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
                      { operator: "equals", path: relationshipPath, value: owner["id"] as string },
                    ],
                  },
                  [{ direction: "descending", path: "published-at" }],
                );
              }),
            identifier: `list${contentTypeId[0]!.toUpperCase()}${contentTypeId.slice(1)}Posts`,
            method: "GET",
            path: `/${contentTypeId === "category" ? "categories" : `${contentTypeId}s`}/{slug}/posts`,
            reachableContentTypeIds: [contentTypeId, "post"],
          },
        ],
      ),
      {
        execute: ({ cms, parameters, request }) =>
          queryPage(
            cms,
            request,
            "comment",
            {
              all: [
                { operator: "equals", path: "post", value: parameters["postId"]! },
                { operator: "equals", path: "status", value: "approved" },
              ],
            },
            [{ direction: "ascending", path: "created-at" }],
          ),
        identifier: "listApprovedComments",
        method: "GET",
        path: "/posts/{postId}/comments",
        reachableContentTypeIds: ["post", "comment"],
      },
      {
        execute: ({ cms, parameters, request }) =>
          Effect.gen(function* () {
            const idempotencyKey = request.headers.get("idempotency-key")!;
            const body = yield* parseBody(request);
            const canonicalInput = JSON.stringify(body, Object.keys(body).sort());
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
              return prior.receipt as PublicValue;
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
        successStatus: 201,
      },
      {
        execute: ({ cms, parameters }) =>
          Effect.gen(function* () {
            for (const contentTypeId of ["post", "author", "category", "tag"]) {
              const entry = yield* cms
                .getEntry({ contentTypeId, entryId: parameters["entryId"]! })
                .pipe(Effect.catchTag("NotFound", () => Effect.succeed(undefined)));
              if (entry !== undefined) {
                if (contentTypeId === "post" && entry.values["status"] !== "published") break;
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
      },
      ...(["GET", "HEAD"] as const).map(
        (method): HttpContract.DeliveryOperation => ({
          cacheControl: "public, max-age=31536000, immutable",
          execute: ({ cms, parameters, request, requestId, snapshot }) =>
            Effect.gen(function* () {
              const posts = yield* queryAll(cms, "post", {
                operator: "equals",
                path: "status",
                value: "published",
              });
              const authors = yield* queryAll(cms, "author");
              const assetId = parameters["assetId"]!;
              if (!publicAssetIds(posts, authors).has(assetId))
                return yield* CmsError.NotFound.make({ message: "Public Asset was not found" });
              const asset = yield* cms.readAsset(assetId);
              return publicAssetResponse(asset, request, requestId, snapshot.fingerprint);
            }),
          identifier: method === "GET" ? "deliverPublicAsset" : "inspectPublicAsset",
          method,
          path: "/assets/{assetId}",
          reachableContentTypeIds: ["post", "author", "category", "tag"],
        }),
      ),
      {
        cacheControl: "no-cache",
        execute: ({ cms, request, requestId }) =>
          Effect.gen(function* () {
            const consistentSnapshot = yield* cms.readConsistentSnapshot,
              snapshot = consistentSnapshot.definitionSnapshot,
              posts = querySnapshot(
                consistentSnapshot,
                "post",
                { operator: "equals", path: "status", value: "published" },
                [{ direction: "descending", path: "published-at" }],
              ),
              comments = querySnapshot(
                consistentSnapshot,
                "comment",
                { operator: "equals", path: "status", value: "approved" },
                [{ direction: "ascending", path: "created-at" }],
              ),
              authors = querySnapshot(consistentSnapshot, "author"),
              categories = querySnapshot(consistentSnapshot, "category"),
              tags = querySnapshot(consistentSnapshot, "tag"),
              reachableAssetIds = publicAssetIds(posts, authors),
              assets = consistentSnapshot.assets
                .filter((asset) => reachableAssetIds.has(asset.id))
                .map(({ bytes: _bytes, ...asset }) => asset),
              artifact = {
                assets: assets as unknown as ContentDefinition.JsonValue,
                authors: authors.map(publicValue),
                categories: categories.map(publicValue),
                comments: comments.map(publicValue),
                definitionFingerprint: snapshot.fingerprint,
                generatedAt: "2026-08-23T16:00:00.000Z",
                posts: posts.map(publicValue),
                tags: tags.map(publicValue),
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
      },
    ];
  return operations;
};
