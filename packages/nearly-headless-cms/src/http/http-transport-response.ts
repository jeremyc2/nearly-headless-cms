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

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readConflictStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (
    Schema.is(Conflict)(error) ||
    Schema.is(AssetReferenced)(error) ||
    Schema.is(ReferenceBlockedDeletion)(error) ||
    Schema.is(IdempotencyConflict)(error)
  ) {
    return httpStatusConflict;
  }
  return undefined;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readDefinitionSnapshotChangedStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (Schema.is(DefinitionSnapshotChanged)(error)) {
    return httpStatusPreconditionFailed;
  }
  return undefined;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readForbiddenStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (Schema.is(Forbidden)(error)) {
    return httpStatusForbidden;
  }
  return undefined;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readInfrastructureFailureStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (!Schema.is(InfrastructureFailure)(error)) {
    return undefined;
  }
  if (error.retryable) {
    return httpStatusServiceUnavailable;
  }
  return httpStatusInternalServerError;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readInvalidInputStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (Schema.is(InvalidInput)(error)) {
    return httpStatusBadRequest;
  }
  return undefined;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readNotFoundStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (Schema.is(NotFound)(error)) {
    return httpStatusNotFound;
  }
  return undefined;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function readUnsupportedQueryStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number | undefined {
  if (Schema.is(UnsupportedQueryCapability)(error) || Schema.is(ExportTooLarge)(error)) {
    return httpStatusUnprocessableEntity;
  }
  return undefined;
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function errorStatus(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
): number {
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
}

// oxlint-disable-next-line eslint/func-style -- [EH-113] error status helpers are function declarations to keep CmsError Schema narrowing readable.
function errorResponse(
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-159] CmsError tagged unions are inspected via Schema.is without mutation.
  error: Readonly<CmsError>,
  requestId: string,
): Response {
  const document = buildErrorDocument(error, requestId),
    headers = responseHeaders(requestId);
  headers.set("content-type", "application/json; charset=utf-8");
  if (Schema.is(InfrastructureFailure)(error) && error.retryable) {
    headers.set("retry-after", "1");
  }
  return Response.json(document, { headers, status: errorStatus(error) });
}

const { assetContentResponse, buildErrorDocument, responseHeaders } = responseSupport,
  bodylessResponse = (status: number, requestId: string, fingerprint?: string): Response =>
    new Response(null, { headers: responseHeaders(requestId, fingerprint), status }),
  encodeChunk = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-208] Uint8Array chunks are returned without mutation.
    chunk: Uint8Array | string,
  ): Uint8Array => {
    if (typeof chunk === "string") {
      return new TextEncoder().encode(chunk);
    }
    return chunk;
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
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-065] the public Web handler contract returns a Promise<Response>.
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
  runOperationInterruptibly = <Value>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-174] Effect programs are executed, not mutated, by runPromise.
    effect: Readonly<Effect.Effect<Value, CmsError>>,
    signal?: ReadonlyTransportAbortSignal,
  ): Promise<OperationOutcome<Value>> => {
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

/* oxlint-enable typescript/prefer-readonly-parameter-types */

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
