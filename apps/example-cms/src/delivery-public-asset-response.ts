import type { Asset } from "nearly-headless-cms";
import { FIRST_INDEX, ONE_ITEM } from "./delivery-support.ts";

interface PublicAssetResponseInput {
  readonly asset: Asset.StoredAsset;
  readonly definitionFingerprint: string;
  readonly request: Request;
  readonly requestId: string;
}

interface ParsedByteRange {
  readonly end: number;
  readonly start: number;
}

const byteRangePattern = /^bytes=(?<start>\d*)-(?<end>\d*)$/u,
  parseByteRangeEnd = (match: RegExpExecArray, byteLength: number): number => {
    if (match.groups?.["start"] === "" || match.groups?.["end"] === "") {
      return byteLength - ONE_ITEM;
    }
    return Number(match.groups?.["end"]);
  },
  parseByteRangeStart = (match: RegExpExecArray, byteLength: number): number => {
    if (match.groups?.["start"] === "") {
      return Math.max(FIRST_INDEX, byteLength - Number(match.groups?.["end"]));
    }
    return Number(match.groups?.["start"]);
  },
  parseByteRange = (
    range: string,
    byteLength: number,
  ): ParsedByteRange | "invalid" | "unsatisfiable" => {
    const match = byteRangePattern.exec(range);
    if (match === null || range.includes(",")) {
      return "invalid";
    }
    const start = parseByteRangeStart(match, byteLength),
      end = parseByteRangeEnd(match, byteLength);
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < FIRST_INDEX ||
      end < start ||
      start >= byteLength
    ) {
      return "unsatisfiable";
    }
    return { end, start };
  },
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
    const range = request.headers.get("range");
    if (range === null) {
      return undefined;
    }
    if (request.headers.get("if-range") === null) {
      return undefined;
    }
    const etag = headers.get("etag");
    if (request.headers.get("if-range") === etag) {
      return undefined;
    }
    return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
      headers,
      status: 200,
    });
  },
  rangedAssetResponse = (
    request: Request,
    asset: Asset.StoredAsset,
    headers: Headers,
    range: string,
  ): Response => {
    const parsedRange = parseByteRange(range, asset.bytes.byteLength);
    if (parsedRange === "invalid" || parsedRange === "unsatisfiable") {
      headers.set("content-range", `bytes */${asset.bytes.byteLength}`);
      headers.delete("content-length");
      return new Response(null, { headers, status: 416 });
    }
    const boundedEnd = Math.min(parsedRange.end, asset.bytes.byteLength - ONE_ITEM),
      bytes = asset.bytes.slice(parsedRange.start, boundedEnd + 1);
    headers.set("content-range", `bytes ${parsedRange.start}-${boundedEnd}/${asset.bytes.byteLength}`);
    headers.set("content-length", String(bytes.byteLength));
    return new Response(publicAssetBody(request, new Uint8Array(bytes)), {
      headers,
      status: 206,
    });
  },
  publicAssetResponse = (input: PublicAssetResponseInput): Response => {
    const { asset, request } = input,
      { etag, headers } = publicAssetHeaders(input);
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { headers, status: 304 });
    }
    const ifRangeMismatch = rangeNotModifiedResponse(request, asset, headers);
    if (ifRangeMismatch !== undefined) {
      return ifRangeMismatch;
    }
    const range = request.headers.get("range");
    if (range !== null) {
      return rangedAssetResponse(request, asset, headers, range);
    }
    return new Response(publicAssetBody(request, new Uint8Array(asset.bytes)), {
      headers,
      status: 200,
    });
  };

export default {
  publicAssetResponse,
};
