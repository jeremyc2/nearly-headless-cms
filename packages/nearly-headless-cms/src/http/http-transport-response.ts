import {
  AssetReferenced,
  type CmsError,
  Conflict,
  DefinitionSnapshotChanged,
  ExportTooLarge,
  Forbidden,
  IdempotencyConflict,
  InfrastructureFailure,
  InvalidInput,
  NotFound,
  ReferenceBlockedDeletion,
  UnsupportedQueryCapability,
  type ValidationIssue,
} from "../cms-error.ts";
import type { Service as CmsService } from "../cms.ts";
import type { JsonValue } from "../internal/json.ts";
import { Effect, Schema } from "effect";
import type { ErrorDocument } from "./http-contract.ts";
import type {
  JsonResponseInput,
  OperationOutcome,
  RespondWithOutcomeInput,
} from "./http-transport-types.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";

type StoredAsset = Awaited<
  ReturnType<CmsService["Service"]["readAsset"]> extends Effect.Effect<infer Value, unknown>
    ? Value
    : never
>;

const assetContentResponse = (
    storedAsset: StoredAsset,
    request: Request,
    requestId: string,
  ): Response => {
    const baseHeaders = responseHeaders(requestId, undefined, "public, max-age=31536000, immutable"),
      etag = `"sha256-${storedAsset.metadata.digest}"`;
    baseHeaders.set("accept-ranges", "bytes");
    baseHeaders.set(
      "content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(storedAsset.metadata.filename)}`,
    );
    baseHeaders.set("content-type", storedAsset.metadata.mediaType);
    baseHeaders.set("etag", etag);
    if (request.headers.get("if-none-match") === etag) {
      return assetNotModifiedResponse(baseHeaders);
    }
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
  assetFullResponse = (
    storedAsset: StoredAsset,
    baseHeaders: Headers,
    requestMethod: string,
  ): Response => {
    baseHeaders.set("content-length", String(storedAsset.bytes.byteLength));
    let body: BodyInit | null = responseBody(storedAsset.bytes);
    if (requestMethod === "HEAD") {
      body = null;
    }
    return new Response(body, { headers: baseHeaders, status: 200 });
  },
  assetNotModifiedResponse = (baseHeaders: Headers): Response =>
    new Response(null, { headers: baseHeaders, status: 304 }),
  assetRangeResponse = ({
    baseHeaders,
    range,
    request,
    storedAsset,
  }: {
    readonly baseHeaders: Headers;
    readonly range: string;
    readonly request: Request;
    readonly storedAsset: StoredAsset;
  }): Response => {
    const bounds = parseRangeBounds(range, storedAsset.bytes.byteLength);
    if (bounds === undefined) {
      baseHeaders.set("content-range", `bytes */${storedAsset.bytes.byteLength}`);
      return new Response(null, { headers: baseHeaders, status: 416 });
    }
    const boundedEnd = Math.min(bounds.end, storedAsset.bytes.byteLength - 1),
      bytes = storedAsset.bytes.slice(bounds.start, boundedEnd + 1);
    baseHeaders.set(
      "content-range",
      `bytes ${bounds.start}-${boundedEnd}/${storedAsset.bytes.byteLength}`,
    );
    baseHeaders.set("content-length", String(bytes.byteLength));
    let body: BodyInit | null = responseBody(bytes);
    if (request.method === "HEAD") {
      body = null;
    }
    return new Response(body, { headers: baseHeaders, status: 206 });
  },
  bodylessResponse = (status: number, requestId: string, fingerprint?: string): Response =>
    new Response(null, { headers: responseHeaders(requestId, fingerprint), status }),
  buildErrorDocument = (error: CmsError, requestId: string): ErrorDocument => {
    const details = invalidInputDetails(error),
      document: ErrorDocument = {
        code: errorCode(error),
        message: error.message,
        requestId,
      };
    if (details === undefined) {
      return document;
    }
    return { ...document, details };
  },
  encodeChunk = (chunk: Uint8Array | string): Uint8Array => {
    if (typeof chunk === "string") {
      return new TextEncoder().encode(chunk);
    }
    return chunk;
  },
  errorCode = (error: CmsError): string => error.constructor.name,
  errorResponse = (error: CmsError, requestId: string): Response => {
    const document = buildErrorDocument(error, requestId),
      headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    if (Schema.is(InfrastructureFailure)(error) && error.retryable) {
      headers.set("retry-after", "1");
    }
    return Response.json(document, { headers, status: errorStatus(error) });
  },
  errorStatus = (error: CmsError): number => {
    if (Schema.is(InvalidInput)(error)) {
      return 400;
    }
    if (Schema.is(Forbidden)(error)) {
      return 403;
    }
    if (Schema.is(NotFound)(error)) {
      return 404;
    }
    if (Schema.is(DefinitionSnapshotChanged)(error)) {
      return 412;
    }
    if (Schema.is(UnsupportedQueryCapability)(error) || Schema.is(ExportTooLarge)(error)) {
      return 422;
    }
    if (Schema.is(InfrastructureFailure)(error)) {
      if (error.retryable) {
        return 503;
      }
      return 500;
    }
    if (
      Schema.is(Conflict)(error) ||
      Schema.is(AssetReferenced)(error) ||
      Schema.is(ReferenceBlockedDeletion)(error) ||
      Schema.is(IdempotencyConflict)(error)
    ) {
      return 409;
    }
    return 500;
  },
  invalidInputDetails = (error: CmsError): JsonValue | undefined => {
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
  invalidRequestResponse = (
    error: unknown,
    fallbackMessage: string,
    requestId: string,
  ): Response => {
    if (error instanceof RequestFailureError) {
      return requestFailureResponse(error, requestId);
    }
    if (Schema.is(InvalidInput)(error)) {
      return errorResponse(error, requestId);
    }
    return errorResponse(InvalidInput.make({ message: fallbackMessage }), requestId);
  },
  jsonResponse = ({
    cacheControl,
    fingerprint,
    requestId,
    status,
    value,
  }: JsonResponseInput): Response => {
    const headers = responseHeaders(requestId, fingerprint, cacheControl);
    headers.set("content-type", "application/json; charset=utf-8");
    return Response.json(value, { headers, status });
  },
  parseRangeBounds = (
    range: string,
    byteLength: number,
  ): { readonly end: number; readonly start: number } | undefined => {
    const match = /^bytes=(?<start>\d*)-(?<end>\d*)$/u.exec(range);
    if (match === null || range.includes(",")) {
      return undefined;
    }
    const endGroup = match.groups?.["end"],
      startGroup = match.groups?.["start"];
    if (startGroup === undefined || endGroup === undefined) {
      return undefined;
    }
    let end = 0,
      start = 0;
    if (startGroup === "") {
      start = Math.max(0, byteLength - Number(endGroup));
      end = byteLength - 1;
    } else {
      start = Number(startGroup);
      end = endGroup === "" ? byteLength - 1 : Number(endGroup);
    }
    if (
      !Number.isSafeInteger(start) ||
      !Number.isSafeInteger(end) ||
      start < 0 ||
      end < start ||
      start >= byteLength
    ) {
      return undefined;
    }
    return { end, start };
  },
  requestFailureResponse = (failure: RequestFailureError, requestId: string): Response => {
    const headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    return Response.json(
      { code: failure.code, message: failure.message, requestId },
      { headers, status: failure.status },
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function -- the public Web handler contract returns a Promise<Response>.
  respondWithOutcome = async <Value>({
    effect,
    requestId,
    signal,
    success,
  }: RespondWithOutcomeInput<Value>): Promise<Response> => {
    const outcome = await runOperationInterruptibly(effect, signal);
    if (outcome.success) {
      return success(outcome.value as Value);
    }
    if (outcome.error === undefined) {
      throw new Error("Operation failed without an error");
    }
    return errorResponse(outcome.error, requestId);
  },
  responseBody = (bytes: Uint8Array): ArrayBuffer => {
    const copy = new Uint8Array(bytes.byteLength);
    copy.set(bytes);
    return copy.buffer;
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
  runOperationInterruptibly = <Value>(
    effect: Effect.Effect<Value, CmsError>,
    signal?: AbortSignal,
  ): Promise<OperationOutcome<Value>> =>
    Effect.runPromise(
      effect.pipe(
        Effect.match({
          onFailure: (operationError): OperationOutcome<Value> => ({
            error: operationError,
            success: false,
          }),
          onSuccess: (value): OperationOutcome<Value> => ({ success: true, value }),
        }),
      ),
      { signal },
    );

export default {
  assetContentResponse,
  bodylessResponse,
  encodeChunk,
  errorResponse,
  invalidRequestResponse,
  jsonResponse,
  requestFailureResponse,
  respondWithOutcome,
  responseHeaders,
  runOperationInterruptibly,
};
