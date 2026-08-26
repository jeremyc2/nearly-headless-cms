import {
  type ReadonlyTransportRequest,
  httpEtagSupport,
  httpStatusOk,
  httpStatusPartialContent,
  httpStatusRangeNotSatisfiable,
} from "nearly-headless-cms/http";
import type { Asset } from "nearly-headless-cms";
import { ONE_ITEM } from "./delivery-support.ts";
import { Stream } from "effect";
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
  publicAssetBody = <Content extends Asset.StoredAsset["content"]>(
    request: Readonly<ReadonlyTransportRequest>,
    content: Readonly<Content>,
  ): BodyInit | null => {
    if (request.method === "HEAD") {
      return null;
    }
    return Stream.toReadableStream(content);
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
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-273] stored asset bytes are read without mutation when serving range requests.
    asset: Readonly<Asset.StoredAsset>,
    headers: Readonly<Headers>,
  ): Response | undefined => {
    const etag = headers.get("etag"),
      ifRange = request.headers.get("if-range"),
      range = request.headers.get("range");
    if (range === null || ifRange === null || ifRange === etag) {
      return undefined;
    }
    return new Response(publicAssetBody(request, asset.content), {
      headers,
      status: httpStatusOk,
    });
  },
  rangedAssetResponse = <Input extends RangedAssetResponseInput>(
    input: Readonly<Input>,
  ): Response => {
    const { asset, headers, range, request } = input,
      parsedRange = parseByteRange(range, asset.metadata.byteLength);
    if (parsedRange === "invalid" || parsedRange === "unsatisfiable") {
      headers.set("content-range", `bytes */${asset.metadata.byteLength}`);
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
      content = slicePublicAssetContent(
        asset.content,
        parsedRange.start,
        Math.min(parsedRange.end, asset.metadata.byteLength - ONE_ITEM),
      ),
      sliceEnd = Math.min(parsedRange.end, asset.metadata.byteLength - ONE_ITEM);
    headers.set(
      "content-range",
      `bytes ${parsedRange.start}-${sliceEnd}/${asset.metadata.byteLength}`,
    );
    headers.set("content-length", String(sliceEnd - parsedRange.start + ONE_ITEM));
    return new Response(publicAssetBody(request, content), {
      headers,
      status: httpStatusPartialContent,
    });
  },
  slicePublicAssetContent = <Content extends Asset.StoredAsset["content"]>(
    content: Readonly<Content>,
    start: number,
    end: number,
  ): Asset.StoredAsset["content"] =>
    content.pipe(
      Stream.mapAccum(
        () => 0,
        (offset, bytes) => {
          const chunkEnd = offset + bytes.byteLength,
            selectedEnd = Math.min(bytes.byteLength, end - offset + ONE_ITEM),
            selectedStart = Math.max(0, start - offset);
          return [
            chunkEnd,
            [
              {
                bytes: bytes.slice(selectedStart, Math.max(selectedStart, selectedEnd)),
                reachedEnd: chunkEnd > end,
              },
            ],
          ] as const;
        },
      ),
      Stream.takeUntil((chunk) => chunk.reachedEnd),
      Stream.map((chunk) => chunk.bytes),
      Stream.filter((bytes) => bytes.byteLength > 0),
    );

const publicAssetResponse = <Input extends PublicAssetResponseInput>(
  input: Readonly<Input>,
): Response => {
  const { asset, request } = input,
    { etag, headers } = publicAssetHeaders(input),
    ifRangeMismatch = rangeNotModifiedResponse(request, asset, headers),
    range = request.headers.get("range");
  if (httpEtagSupport.ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
    return new Response(null, { headers, status: 304 });
  }
  if (ifRangeMismatch !== undefined) {
    return ifRangeMismatch;
  }
  if (range !== null) {
    return rangedAssetResponse({ asset, headers, range, request });
  }
  return new Response(publicAssetBody(request, asset.content), {
    headers,
    status: 200,
  });
};

export default {
  publicAssetBody,
  publicAssetHeaders,
  publicAssetResponse,
  rangeNotModifiedResponse,
  rangedAssetResponse,
};
