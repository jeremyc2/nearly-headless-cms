import { type Cms, CmsError } from "nearly-headless-cms";
import type { HttpContract, ReadonlyTransportRequest } from "nearly-headless-cms/http";
import { Effect, Schema } from "effect";
import {
  authorDefinitionRequirement,
  commentDefinitionRequirement,
  guideDefinitionRequirement,
  postDefinitionRequirement,
  taxonomyDefinitionRequirement,
} from "./delivery-definition-requirements.ts";
import deliveryPublicContent from "./delivery-public-content-support.ts";
import deliverySupport, { MAX_PUBLIC_EXPORT_BYTES } from "./delivery-support.ts";
import { PublicBlogExport } from "../shared/wire-schemas.ts";

interface ExportPublicBlogResponseInput {
  readonly bytes: Uint8Array;
  readonly request: ReadonlyTransportRequest;
  readonly requestId: string;
  readonly snapshot: Cms.ConsistentReadSnapshot["definitionSnapshot"];
}

const { publicAssetIds, publicContent } = deliveryPublicContent,
  { publicValue, readSchemas } = deliverySupport,
  buildExportArtifact = <Snapshot extends Cms.ConsistentReadSnapshot>(
    consistentSnapshot: Readonly<Snapshot>,
  ) => {
    const content = publicContent(consistentSnapshot),
      snapshot = consistentSnapshot.definitionSnapshot;
    return {
      artifact: {
        assets: consistentSnapshot.assets
          .filter((asset) => publicAssetIds(content.posts, content.authors).has(asset.id))
          .map((asset) => asset),
        authors: content.authors.map(publicValue),
        categories: content.categories.map(publicValue),
        comments: content.comments.map(publicValue),
        definitionFingerprint: snapshot.fingerprint,
        generatedAt: "2026-08-23T16:00:00.000Z",
        guides: content.guides.map(publicValue),
        posts: content.posts.map(publicValue),
        tags: content.tags.map(publicValue),
      },
      snapshot,
    };
  },
  buildExportPublicBlogResponse = <Input extends ExportPublicBlogResponseInput>(
    input: Readonly<Input>,
  ): Response => {
    const { bytes, request, requestId, snapshot } = input,
      digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex"),
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
    return new Response(new Uint8Array(bytes), { headers, status: 200 });
  },
  createExportRoute = (): HttpContract.DeliveryOperation => ({
    cacheControl: "no-cache",
    definitionRequirements: [
      postDefinitionRequirement,
      authorDefinitionRequirement,
      taxonomyDefinitionRequirement("category"),
      taxonomyDefinitionRequirement("tag"),
      commentDefinitionRequirement,
      guideDefinitionRequirement,
    ],
    execute: exportPublicBlogExecute,
    identifier: "exportPublicBlog",
    method: "GET",
    path: "/export",
    reachableContentTypeIds: ["post", "author", "category", "tag", "comment", "guide"],
    schemas: readSchemas(PublicBlogExport),
  }),
  encodeExportArtifact = <Artifact extends Record<string, unknown>>(artifact: Readonly<Artifact>) =>
    Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(artifact).pipe(Effect.orDie),
  exportPublicBlogExecute: HttpContract.DeliveryOperation["execute"] = ({
    cms,
    request,
    requestId,
  }) =>
    Effect.gen(function* exportPublicBlog() {
      const builtExport = buildExportArtifact(yield* cms.readConsistentSnapshot()),
        bytes = new TextEncoder().encode(yield* encodeExportArtifact(builtExport.artifact));
      if (bytes.byteLength > MAX_PUBLIC_EXPORT_BYTES) {
        return yield* CmsError.ExportTooLarge.make({
          message: "Public Content Export exceeds the configured 5000000-byte bound",
        });
      }
      return buildExportPublicBlogResponse({
        bytes,
        request,
        requestId,
        snapshot: builtExport.snapshot,
      });
    });

export default { buildExportRoute: createExportRoute };
