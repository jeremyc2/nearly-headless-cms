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
} from "../cms-error.ts";
import { Effect, Schema } from "effect";
import type { JsonResponseInput, OperationOutcome, RespondWithOutcomeInput } from "./http-transport-types.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import responseSupport from "./http-transport-response-support.ts";

const { assetContentResponse, buildErrorDocument, responseHeaders } = responseSupport,
  bodylessResponse = (status: number, requestId: string, fingerprint?: string): Response =>
    new Response(null, { headers: responseHeaders(requestId, fingerprint), status }),
  encodeChunk = (chunk: Uint8Array | string): Uint8Array => {
    if (typeof chunk === "string") {
      return new TextEncoder().encode(chunk);
    }
    return chunk;
  },
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
    const knownStatus =
      readConflictStatus(error) ??
      readDefinitionSnapshotChangedStatus(error) ??
      readForbiddenStatus(error) ??
      readInfrastructureFailureStatus(error) ??
      readInvalidInputStatus(error) ??
      readNotFoundStatus(error) ??
      readUnsupportedQueryStatus(error);
    if (knownStatus !== undefined) {
      return knownStatus;
    }
    return 500;
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
  readConflictStatus = (error: CmsError): number | undefined => {
    if (
      Schema.is(Conflict)(error) ||
      Schema.is(AssetReferenced)(error) ||
      Schema.is(ReferenceBlockedDeletion)(error) ||
      Schema.is(IdempotencyConflict)(error)
    ) {
      return 409;
    }
    return undefined;
  },
  readDefinitionSnapshotChangedStatus = (error: CmsError): number | undefined => {
    if (Schema.is(DefinitionSnapshotChanged)(error)) {
      return 412;
    }
    return undefined;
  },
  readForbiddenStatus = (error: CmsError): number | undefined => {
    if (Schema.is(Forbidden)(error)) {
      return 403;
    }
    return undefined;
  },
  readInfrastructureFailureStatus = (error: CmsError): number | undefined => {
    if (!Schema.is(InfrastructureFailure)(error)) {
      return undefined;
    }
    if (error.retryable) {
      return 503;
    }
    return 500;
  },
  readInvalidInputStatus = (error: CmsError): number | undefined => {
    if (Schema.is(InvalidInput)(error)) {
      return 400;
    }
    return undefined;
  },
  readNotFoundStatus = (error: CmsError): number | undefined => {
    if (Schema.is(NotFound)(error)) {
      return 404;
    }
    return undefined;
  },
  readUnsupportedQueryStatus = (error: CmsError): number | undefined => {
    if (Schema.is(UnsupportedQueryCapability)(error) || Schema.is(ExportTooLarge)(error)) {
      return 422;
    }
    return undefined;
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
      return success(outcome.value);
    }
    return errorResponse(outcome.error, requestId);
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
