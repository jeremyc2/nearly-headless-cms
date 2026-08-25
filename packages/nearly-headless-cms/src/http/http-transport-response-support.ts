import { type CmsError, InvalidInput, type ValidationIssue } from "../cms-error.ts";
import { type Effect, Schema, Stream } from "effect";
import {
  httpStatusNotModified,
  httpStatusOk,
  httpStatusPartialContent,
  httpStatusRangeNotSatisfiable,
} from "./http-status-codes.ts";
import type { Service as CmsService } from "../cms.ts";
import type { ReadonlyTransportRequest } from "./http-transport-readonly-types.ts";
import httpEtagSupport from "./http-etag-support.ts";

type StoredAsset = Awaited<
  ReturnType<CmsService["Service"]["readAsset"]> extends Effect.Effect<infer Value, unknown>
    ? Value
    : never
>;

const { ifNoneMatchMatches } = httpEtagSupport,
  assetContentResponse = <Asset extends StoredAsset>(
    storedAsset: Readonly<Asset>,
    request: ReadonlyTransportRequest,
    requestId: string,
  ): Response => {
    const baseHeaders = buildAssetBaseHeaders(storedAsset, requestId),
      etag = `"sha256-${storedAsset.metadata.digest}"`;
    baseHeaders.set("etag", etag);
    if (ifNoneMatchMatches(request.headers.get("if-none-match"), etag)) {
      return assetNotModifiedResponse(baseHeaders);
    }
    return resolveRangedAssetResponse({ baseHeaders, etag, request, storedAsset });
  },
  assetFullResponse = <Asset extends StoredAsset, HeadersType extends Headers>(
    storedAsset: Readonly<Asset>,
    baseHeaders: Readonly<HeadersType>,
    requestMethod: string,
  ): Response => {
    baseHeaders.set("content-length", String(storedAsset.metadata.byteLength));
    let body: BodyInit | null = Stream.toReadableStream(storedAsset.content);
    if (requestMethod === "HEAD") {
      body = null;
    }
    return new Response(body, { headers: baseHeaders, status: httpStatusOk });
  },
  assetNotModifiedResponse = <HeadersType extends Headers>(
    baseHeaders: Readonly<HeadersType>,
  ): Response => new Response(null, { headers: baseHeaders, status: httpStatusNotModified }),
  assetRangeResponse = <Asset extends StoredAsset>({
    baseHeaders,
    range,
    request,
    storedAsset,
  }: {
    readonly baseHeaders: Headers;
    readonly range: string;
    readonly request: ReadonlyTransportRequest;
    readonly storedAsset: Readonly<Asset>;
  }): Response => {
    const bounds = parseRangeBounds(range, storedAsset.metadata.byteLength);
    if (bounds === undefined) {
      baseHeaders.set("content-range", `bytes */${storedAsset.metadata.byteLength}`);
      return new Response(null, { headers: baseHeaders, status: httpStatusRangeNotSatisfiable });
    }
    return buildSuccessfulAssetRangeResponse({ baseHeaders, bounds, request, storedAsset });
  },
  buildAssetBaseHeaders = <Asset extends StoredAsset>(
    storedAsset: Readonly<Asset>,
    requestId: string,
  ): Headers => {
    const baseHeaders = responseHeaders(
      requestId,
      undefined,
      "public, max-age=31536000, immutable",
    );
    baseHeaders.set("accept-ranges", "bytes");
    baseHeaders.set(
      "content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(storedAsset.metadata.filename)}`,
    );
    baseHeaders.set("content-type", storedAsset.metadata.mediaType);
    return baseHeaders;
  },
  buildAssetRangeBody = <Failure, Content extends Stream.Stream<Uint8Array, Failure>>(
    request: ReadonlyTransportRequest,
    content: Readonly<Content>,
  ): BodyInit | null => {
    if (request.method === "HEAD") {
      return null;
    }
    return Stream.toReadableStream(content);
  },
  buildErrorDocument = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
    requestId: string,
  ) => {
    const details = invalidInputDetails(error),
      document = {
        code: errorCode(error),
        message: error.message,
        requestId,
      };
    if (details === undefined) {
      return document;
    }
    return { ...document, details };
  },
  buildSuccessfulAssetRangeResponse = <Asset extends StoredAsset>({
    baseHeaders,
    bounds,
    request,
    storedAsset,
  }: {
    readonly baseHeaders: Headers;
    readonly bounds: { readonly end: number; readonly start: number };
    readonly request: ReadonlyTransportRequest;
    readonly storedAsset: Readonly<Asset>;
  }): Response => {
    const { boundedEnd, content } = sliceAssetRange(storedAsset, bounds),
      byteLength = boundedEnd - bounds.start + 1;
    baseHeaders.set(
      "content-range",
      `bytes ${bounds.start}-${boundedEnd}/${storedAsset.metadata.byteLength}`,
    );
    baseHeaders.set("content-length", String(byteLength));
    return new Response(buildAssetRangeBody(request, content), {
      headers: baseHeaders,
      status: httpStatusPartialContent,
    });
  },
  computeRangeEndpoints = (
    startGroup: string,
    endGroup: string,
    byteLength: number,
  ): { readonly end: number; readonly start: number } => {
    if (startGroup === "") {
      return {
        end: byteLength - 1,
        start: Math.max(0, byteLength - Number(endGroup)),
      };
    }
    let end = byteLength - 1;
    if (endGroup !== "") {
      end = Number(endGroup);
    }
    return { end, start: Number(startGroup) };
  },
  errorCode = <ErrorType extends CmsError>(error: Readonly<ErrorType>): string =>
    error.constructor.name,
  finalizeRangeBounds = (
    startGroup: string,
    endGroup: string,
    byteLength: number,
  ): { readonly end: number; readonly start: number } | undefined => {
    const { end, start } = computeRangeEndpoints(startGroup, endGroup, byteLength);
    if (!isValidRangeBounds(start, end, byteLength)) {
      return undefined;
    }
    return { end, start };
  },
  invalidInputDetails = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): { readonly issues: readonly Pick<ValidationIssue, "path" | "reason">[] } | undefined => {
    if (!Schema.is(InvalidInput)(error) || error.issues === undefined) {
      return undefined;
    }
    return {
      issues: error.issues.map((issue: ValidationIssue) => ({
        path: issue.path,
        reason: issue.reason,
      })),
    };
  },
  isValidRangeBounds = (start: number, end: number, byteLength: number): boolean => {
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end)) {
      return false;
    }
    if (start < 0 || end < start || start >= byteLength) {
      return false;
    }
    return true;
  },
  parseRangeBounds = (
    range: string,
    byteLength: number,
  ): { readonly end: number; readonly start: number } | undefined => {
    const groups = readRangeMatch(range);
    if (groups === undefined) {
      return undefined;
    }
    return finalizeRangeBounds(groups.startGroup, groups.endGroup, byteLength);
  },
  readRangeGroups = <Match extends RegExpMatchArray>(
    match: Readonly<Match>,
  ): { readonly endGroup: string; readonly startGroup: string } | undefined => {
    const endGroup = match.groups?.["end"],
      startGroup = match.groups?.["start"];
    if (startGroup === undefined || endGroup === undefined) {
      return undefined;
    }
    return { endGroup, startGroup };
  },
  readRangeMatch = (
    range: string,
  ): { readonly endGroup: string; readonly startGroup: string } | undefined => {
    const match = /^bytes=(?<start>\d*)-(?<end>\d*)$/u.exec(range);
    if (match === null || range.includes(",")) {
      return undefined;
    }
    return readRangeGroups(match);
  },
  resolveRangedAssetResponse = <Asset extends StoredAsset>({
    baseHeaders,
    etag,
    request,
    storedAsset,
  }: Readonly<{
    readonly baseHeaders: Headers;
    readonly etag: string;
    readonly request: ReadonlyTransportRequest;
    readonly storedAsset: Readonly<Asset>;
  }>): Response => {
    const range = request.headers.get("range");
    if (
      range !== null &&
      request.headers.get("if-range") !== null &&
      request.headers.get("if-range") !== etag
    ) {
      return assetFullResponse(storedAsset, baseHeaders, request.method);
    }
    if (range !== null) {
      return assetRangeResponse({ baseHeaders, range, request, storedAsset });
    }
    return assetFullResponse(storedAsset, baseHeaders, request.method);
  },
  responseHeaders = (
    requestId: string,
    fingerprint?: string,
    cacheControl = "no-store",
  ): Headers => {
    const headers = new Headers({ "cache-control": cacheControl, "x-request-id": requestId });
    if (fingerprint !== undefined) {
      headers.set("cms-definition-fingerprint", fingerprint);
    }
    return headers;
  },
  sliceAssetRange = <Asset extends StoredAsset>(
    storedAsset: Readonly<Asset>,
    bounds: { readonly end: number; readonly start: number },
  ): { readonly boundedEnd: number; readonly content: Asset["content"] } => {
    const boundedEnd = Math.min(bounds.end, storedAsset.metadata.byteLength - 1),
      content = storedAsset.content.pipe(
        Stream.mapAccum(
          () => 0,
          (offset, bytes) => {
            const chunkEnd = offset + bytes.byteLength,
              selectedEnd = Math.min(bytes.byteLength, boundedEnd - offset + 1),
              selectedStart = Math.max(0, bounds.start - offset);
            return [
              chunkEnd,
              [
                {
                  bytes: bytes.slice(selectedStart, Math.max(selectedStart, selectedEnd)),
                  reachedEnd: chunkEnd > boundedEnd,
                },
              ],
            ] as const;
          },
        ),
        Stream.takeUntil((chunk) => chunk.reachedEnd),
        Stream.map((chunk) => chunk.bytes),
        Stream.filter((bytes) => bytes.byteLength > 0),
      );
    return { boundedEnd, content };
  };

export default {
  assetContentResponse,
  buildErrorDocument,
  responseHeaders,
};
