import type { Asset } from "nearly-headless-cms";
import { ONE_ITEM } from "./delivery-support.ts";
import deliveryPublicAssetByteRangeSupport from "./delivery-public-asset-byte-range-support.ts";

export interface PublicAssetResponseInput {
  readonly asset: Asset.StoredAsset;
  readonly definitionFingerprint: string;
  readonly request: Request;
  readonly requestId: string;
}

interface RangedAssetResponseInput {
  readonly asset: Asset.StoredAsset;
  readonly headers: Headers;
  readonly range: string;
  readonly request: Request;
}

const { parseByteRange } = deliveryPublicAssetByteRangeSupport,
  publicAssetBody = (request: Request, bytes: Uint8Array): ArrayBuffer | null => {
    if (request.method === "HEAD") {
      return null;
    }
    return new Uint8Array(bytes).buffer;
  },
  publicAssetHeaders = ({
    asset,
    definitionFingerprint,
    requestId,
  }: Omit<PublicAssetResponseInput, "request">): { etag: string; headers: Headers } => {
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
    return { etag, headers };
  },
  rangeNotModifiedResponse = (
    request: Request,
    asset: Asset.StoredAsset,
    headers: Headers,
  ): Response | undefined => {
    const etag = headers.get("etag"),
      ifRange = request.headers.get("if-range"),
      range = request.headers.get("range");
    if (range === null || ifRange === null || ifRange === etag) {
      return undefined;
    }
    return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
      headers,
      status: 200,
    });
  },
  rangedAssetSlice = (
    asset: Asset.StoredAsset,
    parsedRange: { readonly end: number; readonly start: number },
  ): Uint8Array => {
    const boundedEnd = Math.min(parsedRange.end, asset.bytes.byteLength - ONE_ITEM);
    return asset.bytes.slice(parsedRange.start, boundedEnd + ONE_ITEM);
  },
  rangedAssetResponse = (input: RangedAssetResponseInput): Response => {
    const { asset, headers, range, request } = input,
      parsedRange = parseByteRange(range, asset.bytes.byteLength);
    if (parsedRange === "invalid" || parsedRange === "unsatisfiable") {
      headers.set("content-range", `bytes */${asset.bytes.byteLength}`);
      headers.delete("content-length");
      return new Response(null, { headers, status: 416 });
    }
    const bytes = rangedAssetSlice(asset, parsedRange),
      boundedEnd = parsedRange.start + bytes.byteLength - ONE_ITEM;
    headers.set("content-range", `bytes ${parsedRange.start}-${boundedEnd}/${asset.bytes.byteLength}`);
    headers.set("content-length", String(bytes.byteLength));
    return new Response(publicAssetBody(request, new Uint8Array(bytes)), {
      headers,
      status: 206,
    });
  };

export default {
  publicAssetBody,
  publicAssetHeaders,
  rangeNotModifiedResponse,
  rangedAssetResponse,
};
