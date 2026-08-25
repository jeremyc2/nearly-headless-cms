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
import type {
  JsonResponseInput,
  OperationOutcome,
  RespondWithOutcomeInput,
} from "./http-transport-types.ts";
import {
  type ReadonlyTransportAbortSignal,
  toAbortSignal,
} from "./http-transport-readonly-types.ts";
import {
  httpStatusBadRequest,
  httpStatusConflict,
  httpStatusForbidden,
  httpStatusInternalServerError,
  httpStatusNotFound,
  httpStatusPreconditionFailed,
  httpStatusServiceUnavailable,
  httpStatusUnprocessableEntity,
} from "./http-status-codes.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
import responseSupport from "./http-transport-response-support.ts";

export { httpStatusNotFound } from "./http-status-codes.ts";

const { assetContentResponse, buildErrorDocument, responseHeaders } = responseSupport,
  bodylessResponse = (status: number, requestId: string, fingerprint?: string): Response =>
    new Response(null, { headers: responseHeaders(requestId, fingerprint), status }),
  encodeChunk = <Chunk extends Uint8Array | string>(chunk: Readonly<Chunk>): Uint8Array => {
    if (typeof chunk === "string") {
      return new TextEncoder().encode(chunk);
    }
    return chunk;
  },
  errorResponse = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
    requestId: string,
  ): Response => {
    const document = buildErrorDocument(error, requestId),
      headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    if (Schema.is(InfrastructureFailure)(error) && error.retryable) {
      headers.set("retry-after", "1");
    }
    return Response.json(document, { headers, status: errorStatus(error) });
  },
  errorStatus = <ErrorType extends CmsError>(error: Readonly<ErrorType>): number => {
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
    return httpStatusInternalServerError;
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
  }: Readonly<JsonResponseInput>): Response => {
    const headers = responseHeaders(requestId, fingerprint, cacheControl);
    headers.set("content-type", "application/json; charset=utf-8");
    return Response.json(value, { headers, status });
  },
  readConflictStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (
      Schema.is(Conflict)(error) ||
      Schema.is(AssetReferenced)(error) ||
      Schema.is(ReferenceBlockedDeletion)(error) ||
      Schema.is(IdempotencyConflict)(error)
    ) {
      return httpStatusConflict;
    }
    return undefined;
  },
  readDefinitionSnapshotChangedStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (Schema.is(DefinitionSnapshotChanged)(error)) {
      return httpStatusPreconditionFailed;
    }
    return undefined;
  },
  readForbiddenStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (Schema.is(Forbidden)(error)) {
      return httpStatusForbidden;
    }
    return undefined;
  },
  readInfrastructureFailureStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (!Schema.is(InfrastructureFailure)(error)) {
      return undefined;
    }
    if (error.retryable) {
      return httpStatusServiceUnavailable;
    }
    return httpStatusInternalServerError;
  },
  readInvalidInputStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (Schema.is(InvalidInput)(error)) {
      return httpStatusBadRequest;
    }
    return undefined;
  },
  readNotFoundStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (Schema.is(NotFound)(error)) {
      return httpStatusNotFound;
    }
    return undefined;
  },
  readUnsupportedQueryStatus = <ErrorType extends CmsError>(
    error: Readonly<ErrorType>,
  ): number | undefined => {
    if (Schema.is(UnsupportedQueryCapability)(error) || Schema.is(ExportTooLarge)(error)) {
      return httpStatusUnprocessableEntity;
    }
    return undefined;
  },
  requestFailureResponse = <FailureType extends RequestFailureError>(
    failure: Readonly<FailureType>,
    requestId: string,
  ): Response => {
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
  }: Readonly<RespondWithOutcomeInput<Value>>): Promise<Response> => {
    const outcome = await runOperationInterruptibly(effect(), signal);
    if (outcome.success) {
      return success(outcome.value);
    }
    return errorResponse(outcome.error, requestId);
  },
  runOperationInterruptibly = <
    Value,
    SignalType extends ReadonlyTransportAbortSignal,
    EffectType extends Effect.Effect<Value, CmsError>,
  >(
    effect: EffectType,
    signal?: Readonly<SignalType>,
  ): Promise<OperationOutcome<Effect.Success<EffectType>>> => {
    let runOptions: { signal: AbortSignal } | undefined = undefined;
    if (signal !== undefined) {
      runOptions = { signal: toAbortSignal(signal) };
    }
    return Effect.runPromise(
      effect.pipe(
        Effect.match({
          onFailure: (operationError): OperationOutcome<Value> => ({
            error: operationError,
            success: false,
          }),
          onSuccess: (value): OperationOutcome<Value> => ({ success: true, value }),
        }),
      ),
      runOptions,
    );
  };

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
