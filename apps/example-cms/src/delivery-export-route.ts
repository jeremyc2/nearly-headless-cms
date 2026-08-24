import { CmsError } from "nearly-headless-cms";
import type { HttpContract } from "nearly-headless-cms/http";
import { Effect, Schema } from "effect";
import {
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";
import deliveryPublicContent from "./delivery-public-content.ts";
import deliverySupport, { MAX_PUBLIC_EXPORT_BYTES } from "./delivery-support.ts";
import { PublicBlogExport } from "./wire-schemas.ts";

const { publicAssetIds, publicContent } = deliveryPublicContent,
  { publicValue, readSchemas } = deliverySupport,
  buildExportRoute = (): HttpContract.DeliveryOperation => ({
    cacheControl: "no-cache",
    definitionRequirements: [
      postDefinitionRequirement,
      authorDefinitionRequirement,
      taxonomyDefinitionRequirement("category"),
      taxonomyDefinitionRequirement("tag"),
      commentDefinitionRequirement,
    ],
    execute: ({ cms, request, requestId }) =>
      Effect.gen(function* exportPublicBlog() {
        const consistentSnapshot = yield* cms.readConsistentSnapshot,
          content = publicContent(consistentSnapshot),
          reachableAssetIds = publicAssetIds(content.posts, content.authors),
          snapshot = consistentSnapshot.definitionSnapshot,
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
          bytes = new TextEncoder().encode(
            yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(artifact).pipe(
              Effect.orDie,
            ),
          );
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
  });

export default {
  buildExportRoute,
};
