import {
  type ReadonlyTransportRequest,
  httpStatusOk,
  httpStatusPartialContent,
  httpStatusRangeNotSatisfiable,
} from "nearly-headless-cms/http";
import type { Asset } from "nearly-headless-cms";
import { ONE_ITEM } from "./delivery-support.ts";
import deliveryPublicAssetByteRangeSupport from "./delivery-public-asset-byte-range-support.ts";

export interface PublicAssetResponseInput {
  readonly asset: Asset.StoredAsset;
  readonly definitionFingerprint: string;
  readonly request: ReadonlyTransportRequest;
  readonly requestId: string;
}

interface RangedAssetResponseInput {
  readonly asset: Asset.StoredAsset;
  readonly headers: Headers;
  readonly range: string;
  readonly request: ReadonlyTransportRequest;
}

const { parseByteRange } = deliveryPublicAssetByteRangeSupport,
  publicAssetBody = (
    request: Readonly<ReadonlyTransportRequest>,
    bytes: Readonly<Uint8Array>,
  ): ArrayBuffer | null => {
    if (request.method === "HEAD") {
      return null;
    }
    return new Uint8Array(bytes).buffer;
  },
  publicAssetHeaders = <
    Input extends Omit<PublicAssetResponseInput, "request"> & { readonly asset: Asset.StoredAsset },
  >({
    asset,
    definitionFingerprint,
    requestId,
  }: Readonly<Input>): { etag: string; headers: Headers } => {
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
    request: Readonly<ReadonlyTransportRequest>,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- stored asset bytes are read without mutation when serving range requests.
    asset: Readonly<Asset.StoredAsset>,
    headers: Readonly<Headers>,
  ): Response | undefined => {
    const etag = headers.get("etag"),
      ifRange = request.headers.get("if-range"),
      range = request.headers.get("range");
    if (range === null || ifRange === null || ifRange === etag) {
      return undefined;
    }
    return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
      headers,
      status: httpStatusOk,
    });
  },
  rangedAssetResponse = <Input extends RangedAssetResponseInput>(
    input: Readonly<Input>,
  ): Response => {
    const { asset, headers, range, request } = input,
      parsedRange = parseByteRange(range, asset.bytes.byteLength);
    if (parsedRange === "invalid" || parsedRange === "unsatisfiable") {
      headers.set("content-range", `bytes */${asset.bytes.byteLength}`);
      headers.delete("content-length");
      return new Response(null, { headers, status: httpStatusRangeNotSatisfiable });
    }
    return rangedAssetSuccessResponse({ asset, headers, request }, parsedRange);
  },
  rangedAssetSuccessResponse = <
    Input extends Omit<RangedAssetResponseInput, "range">,
    ParsedRange extends { readonly end: number; readonly start: number },
  >(
    input: Readonly<Input>,
    parsedRange: Readonly<ParsedRange>,
  ): Response => {
    const { asset, headers, request } = input,
      bytes = asset.bytes.slice(
        parsedRange.start,
        Math.min(parsedRange.end, asset.bytes.byteLength - ONE_ITEM) + ONE_ITEM,
      ),
      sliceEnd = Math.min(parsedRange.end, asset.bytes.byteLength - ONE_ITEM);
    headers.set(
      "content-range",
      `bytes ${parsedRange.start}-${sliceEnd}/${asset.bytes.byteLength}`,
    );
    headers.set("content-length", String(bytes.byteLength));
    return new Response(publicAssetBody(request, new Uint8Array(bytes)), {
      headers,
      status: httpStatusPartialContent,
    });
  };

export default {
  publicAssetBody,
  publicAssetHeaders,
  rangeNotModifiedResponse,
  rangedAssetResponse,
};
