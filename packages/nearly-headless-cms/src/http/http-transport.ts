import { createReadStream } from "node:fs";
import { mkdtemp, open, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Effect, Layer, Predicate, Schema, Stream } from "effect";
import { HttpRouter, HttpServerRequest, HttpServerResponse, Multipart } from "effect/unstable/http";
import { HttpApiBuilder } from "effect/unstable/httpapi";
import type { IngestInput } from "../asset.ts";
import { Service as CmsService } from "../cms.ts";
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
import type { JsonObject, JsonValue } from "../internal/json.ts";
import {
  type DeliveryOperation,
  type ErrorDocument,
  type ManagementOperation,
  type OperationSchema,
  discovery,
  headlessPrefix,
  managementPrefix,
} from "./http-contract.ts";
import * as HttpApiContract from "./http-api.ts";

const requiredPathParameter = (
  parameters: Readonly<Record<string, string | undefined>>,
  name: string,
): string => {
  const value = parameters[name];
  if (value === undefined) {
    throw new Error(`Missing path parameter: ${name}`);
  }
  return value;
};

/** Limits, CORS policy, and composed operation declarations for the HTTP Transport. */
export interface Options {
  readonly deliveryOperations?: readonly DeliveryOperation[];
  readonly managementOperations?: readonly ManagementOperation[];
  readonly maximumHeaderByteLength?: number;
  readonly maximumJsonBodyByteLength?: number;
  readonly maximumMultipartBodyByteLength?: number;
  readonly maximumMultipartFileByteLength?: number;
  readonly maximumMultipartMetadataByteLength?: number;
  readonly maximumUrlLength?: number;
  readonly requestTimeoutMilliseconds?: number;
  readonly requestIdentifier?: () => string;
  readonly cors?: {
    readonly origins: readonly string[];
    readonly methods: readonly string[];
    readonly headers: readonly string[];
  };
}

/** Portable Web-standard request handler used for in-memory contract testing. */
export type Handler = (request: Request) => Promise<Response>;

interface OperationOutcome<Value> {
  readonly success: boolean;
  readonly value?: Value;
  readonly error?: CmsError;
}

interface JsonResponseInput {
  readonly cacheControl?: string;
  readonly fingerprint?: string;
  readonly requestId: string;
  readonly status: number;
  readonly value: unknown;
}

interface RespondWithOutcomeInput<Value> {
  readonly effect: Effect.Effect<Value, CmsError>;
  readonly requestId: string;
  readonly signal?: AbortSignal;
  readonly success: (value: Value) => Response;
}

interface StagedAssetUpload {
  readonly cleanup: () => Promise<void>;
  readonly content: Stream.Stream<Uint8Array, InfrastructureFailure>;
  readonly metadata: Omit<IngestInput, "content">;
}

class RequestFailure extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

const runOperationInterruptibly = async <Value>(
    effect: Effect.Effect<Value, CmsError>,
    signal?: AbortSignal,
  ): Promise<OperationOutcome<Value>> =>
    Effect.runPromise(
      effect.pipe(
        Effect.match({
          onFailure: (error): OperationOutcome<Value> => ({ error, success: false }),
          onSuccess: (value): OperationOutcome<Value> => ({ success: true, value }),
        }),
      ),
      { signal },
    ),
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
  errorCode = (error: CmsError): string => error.constructor.name,
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
  errorResponse = (error: CmsError, requestId: string): Response => {
    let details: JsonValue | undefined;
    if (Schema.is(InvalidInput)(error) && error.issues !== undefined) {
      details = {
        issues: error.issues.map((issue: ValidationIssue) => ({
          path: issue.path,
          reason: issue.reason,
        })),
      };
    }
    const document: ErrorDocument = {
      code: errorCode(error),
      message: error.message,
      requestId,
    };
    if (details !== undefined) {
      Object.assign(document, { details });
    }
    const headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    if (Schema.is(InfrastructureFailure)(error) && error.retryable) {
      headers.set("retry-after", "1");
    }
    return Response.json(document, { headers, status: errorStatus(error) });
  },
  requestFailureResponse = (failure: RequestFailure, requestId: string): Response => {
    const headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    return Response.json(
      { code: failure.code, message: failure.message, requestId },
      { headers, status: failure.status },
    );
  },
  invalidRequestResponse = (
    error: unknown,
    fallbackMessage: string,
    requestId: string,
  ): Response => {
    if (error instanceof RequestFailure) {
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
  bodylessResponse = (status: number, requestId: string, fingerprint?: string): Response =>
    new Response(null, { headers: responseHeaders(requestId, fingerprint), status }),
  parseJson = async (request: Request, maximumByteLength: number): Promise<JsonObject> => {
    if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
      throw new RequestFailure(
        "UnsupportedMediaType",
        "Expected application/json request media",
        415,
      );
    }
    const bytes = new Uint8Array(await request.arrayBuffer());
    if (bytes.byteLength > maximumByteLength) {
      throw new RequestFailure(
        "PayloadTooLarge",
        "JSON request body exceeds the configured limit",
        413,
      );
    }
    let value: unknown;
    try {
      value = JSON.parse(new TextDecoder().decode(bytes));
    } catch {
      throw InvalidInput.make({ message: "Malformed JSON request body" });
    }
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      throw InvalidInput.make({ message: "JSON request body must be an object" });
    }
    return value as JsonObject;
  },
  parseAssetMetadata = (text: string): Omit<IngestInput, "content"> => {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw InvalidInput.make({ message: "Asset metadata must be valid JSON" });
    }
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      throw InvalidInput.make({ message: "Asset metadata must be a JSON object" });
    }
    const allowedKeys = new Set([
        "defaultAlternativeText",
        "filename",
        "height",
        "mediaType",
        "width",
      ]),
      unexpectedKey = Object.keys(parsed).find((key) => !allowedKeys.has(key));
    if (unexpectedKey !== undefined) {
      throw InvalidInput.make({
        message: `Asset metadata contains unexpected key ${unexpectedKey}`,
      });
    }
    const filename = Reflect.get(parsed, "filename"),
      mediaType = Reflect.get(parsed, "mediaType"),
      defaultAlternativeText = Reflect.get(parsed, "defaultAlternativeText"),
      width = Reflect.get(parsed, "width"),
      height = Reflect.get(parsed, "height");
    if (typeof filename !== "string" || typeof mediaType !== "string") {
      throw InvalidInput.make({ message: "Asset metadata requires filename and mediaType" });
    }
    if (defaultAlternativeText !== undefined && typeof defaultAlternativeText !== "string") {
      throw InvalidInput.make({ message: "Asset alternative text must be a string" });
    }
    if (width !== undefined && (!Number.isSafeInteger(width) || Number(width) <= 0)) {
      throw InvalidInput.make({ message: "Asset width must be a positive integer" });
    }
    if (height !== undefined && (!Number.isSafeInteger(height) || Number(height) <= 0)) {
      throw InvalidInput.make({ message: "Asset height must be a positive integer" });
    }
    return {
      filename,
      mediaType,
      ...(defaultAlternativeText === undefined ? {} : { defaultAlternativeText }),
      ...(width === undefined ? {} : { width: Number(width) }),
      ...(height === undefined ? {} : { height: Number(height) }),
    };
  },
  multipartFailure = (error: Multipart.MultipartError): RequestFailure | InvalidInput => {
    if (
      Predicate.isTagged(error.reason, "BodyTooLarge") ||
      Predicate.isTagged(error.reason, "FieldTooLarge") ||
      Predicate.isTagged(error.reason, "FileTooLarge") ||
      Predicate.isTagged(error.reason, "TooManyParts")
    ) {
      return new RequestFailure(
        "PayloadTooLarge",
        "Multipart request exceeds the configured limit",
        413,
      );
    }
    return Predicate.isTagged(error.reason, "InternalError")
      ? new RequestFailure("InternalError", "Multipart request processing failed", 500)
      : InvalidInput.make({ message: "Malformed multipart Asset upload" });
  },
  stagedContent = (path: string): Stream.Stream<Uint8Array, InfrastructureFailure> =>
    Stream.fromAsyncIterable(createReadStream(path), (cause) =>
      InfrastructureFailure.make({
        cause,
        message: "Staged multipart Asset read failed",
        retryable: false,
      }),
    ).pipe(
      Stream.map((chunk) =>
        typeof chunk === "string" ? new TextEncoder().encode(chunk) : new Uint8Array(chunk),
      ),
    ),
  stageFilePart = (
    part: Multipart.File,
    path: string,
    maximumByteLength: number,
  ): Effect.Effect<void, RequestFailure | InvalidInput> => {
    let byteLength = 0;
    return Effect.acquireUseRelease(
      Effect.tryPromise({
        catch: () => new RequestFailure("InternalError", "Upload staging failed", 500),
        try: () => open(path, "wx"),
      }),
      (handle) =>
        Stream.runForEach(part.content, (chunk) => {
          byteLength += chunk.byteLength;
          if (byteLength > maximumByteLength) {
            return Effect.fail(
              new RequestFailure(
                "PayloadTooLarge",
                "Multipart request exceeds the configured limit",
                413,
              ),
            );
          }
          return Effect.tryPromise({
            catch: () => new RequestFailure("InternalError", "Upload staging failed", 500),
            try: async () => {
              let offset = 0;
              while (offset < chunk.byteLength) {
                const result = await handle.write(chunk, offset, chunk.byteLength - offset, null);
                if (result.bytesWritten === 0) {
                  throw new Error("Upload staging write made no progress");
                }
                offset += result.bytesWritten;
              }
            },
          });
        }).pipe(
          Effect.mapError((error) =>
            error instanceof Multipart.MultipartError ? multipartFailure(error) : error,
          ),
        ),
      (handle) =>
        Effect.promise(async () => {
          await handle.close().catch(() => {});
        }),
    );
  },
  stageMultipartAsset = async (
    request: Request,
    signal: AbortSignal,
    limits: {
      readonly body: number;
      readonly file: number;
      readonly metadata: number;
    },
  ): Promise<StagedAssetUpload> => {
    const directory = await mkdtemp(join(tmpdir(), "nearly-headless-cms-upload-")),
      contentPath = join(directory, "content");
    try {
      let contentMediaType: string | undefined,
        contentSeen = false,
        metadata: Omit<IngestInput, "content"> | undefined;
      const parse = Stream.runForEach(
        HttpServerRequest.fromWeb(request).multipartStream,
        (part): Effect.Effect<void, RequestFailure | InvalidInput> => {
          if (Multipart.isField(part)) {
            if (part.key !== "metadata" || metadata !== undefined) {
              return Effect.fail(
                InvalidInput.make({
                  message: "Asset upload requires exactly one metadata field",
                }),
              );
            }
            return Effect.sync(() => {
              metadata = parseAssetMetadata(part.value);
            });
          }
          if (part.key !== "content" || contentSeen) {
            return Effect.fail(
              InvalidInput.make({ message: "Asset upload requires exactly one content file" }),
            );
          }
          contentSeen = true;
          contentMediaType = part.contentType;
          return stageFilePart(part, contentPath, limits.file);
        },
      ).pipe(
        Effect.provide(
          Multipart.limitsServices({
            fieldMimeTypes: ["application/json", "text/plain"],
            maxFieldSize: limits.metadata,
            maxParts: 3,
            maxTotalSize: limits.body,
          }),
        ),
        Effect.mapError((error) =>
          error instanceof Multipart.MultipartError ? multipartFailure(error) : error,
        ),
      );
      await Effect.runPromise(parse, { signal });
      if (metadata === undefined || !contentSeen) {
        throw InvalidInput.make({
          message: "Asset upload requires exactly metadata and content parts",
        });
      }
      if (contentMediaType !== metadata.mediaType) {
        throw InvalidInput.make({
          message: "Asset metadata mediaType must match the content part media type",
        });
      }
      return {
        cleanup: async () => rm(directory, { force: true, recursive: true }),
        content: stagedContent(contentPath),
        metadata,
      };
    } catch (error) {
      await rm(directory, { force: true, recursive: true }).catch(() => {});
      throw error;
    }
  },
  validateSchema = (
    schema: OperationSchema,
    value: unknown,
    message: string,
  ): Effect.Effect<void, InvalidInput> =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.asVoid,
      Effect.mapError(() => InvalidInput.make({ message })),
    ),
  validateOperationRequest = (
    operation: DeliveryOperation | ManagementOperation,
    request: Request,
    parameters: Readonly<Record<string, string>>,
  ): Effect.Effect<void, InvalidInput> =>
    Effect.gen(function* validateDeclaredOperationRequest() {
      for (const [name, schema] of Object.entries(operation.schemas.pathParameters ?? {})) {
        yield* validateSchema(schema, parameters[name], `Path parameter ${name} is invalid`);
      }
      for (const [name, schema] of Object.entries(operation.schemas.requestHeaders ?? {})) {
        yield* validateSchema(
          schema,
          request.headers.get(name) ?? undefined,
          `Request header ${name} is invalid`,
        );
      }
      if (
        operation.schemas.requestBody !== undefined &&
        (request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")
      ) {
        const body = yield* Effect.tryPromise({
          catch: () => InvalidInput.make({ message: "JSON request body is malformed" }),
          try: () => request.clone().json(),
        });
        yield* validateSchema(
          operation.schemas.requestBody,
          body,
          `Request body for ${operation.identifier} is invalid`,
        );
      }
    }),
  executeOperation = (
    operation: DeliveryOperation | ManagementOperation,
    context: Parameters<DeliveryOperation["execute"]>[0],
  ): Effect.Effect<unknown, CmsError> =>
    validateOperationRequest(operation, context.request, context.parameters).pipe(
      Effect.andThen(operation.execute(context)),
      Effect.flatMap((value) =>
        value instanceof Response || value === undefined
          ? Effect.succeed(value)
          : validateSchema(
              operation.schemas.response,
              value,
              `Response body for ${operation.identifier} violated its declared schema`,
            ).pipe(Effect.as(value)),
      ),
    ),
  compilePath = (
    path: string,
  ): { readonly expression: RegExp; readonly names: readonly string[] } => {
    const names: string[] = [],
      pattern = path
        .split("/")
        .map((segment) => {
          const match = /^\{([^}]+)\}$/u.exec(segment);
          if (match?.[1] !== undefined) {
            names.push(match[1]);
            return "([^/]+)";
          }
          return segment.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
        })
        .join("/");
    return { expression: new RegExp(`^${pattern}$`, "u"), names };
  },
  matchPath = (template: string, path: string): Readonly<Record<string, string>> | undefined => {
    const compiled = compilePath(template),
      match = compiled.expression.exec(path);
    if (match === null) {
      return undefined;
    }
    return Object.fromEntries(
      compiled.names.map((name, index) => [name, decodeURIComponent(match[index + 1] ?? "")]),
    );
  },
  ensureFingerprint = (
    request: Request,
    fingerprint: string,
  ): Effect.Effect<void, DefinitionSnapshotChanged> => {
    const expected = request.headers.get("cms-expected-definition-fingerprint");
    return expected !== null && expected !== fingerprint
      ? Effect.fail(
          DefinitionSnapshotChanged.make({ message: "The active Definition Snapshot changed" }),
        )
      : Effect.void;
  },
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
  assetContentResponse = (
    storedAsset: Awaited<
      ReturnType<CmsService["Service"]["readAsset"]> extends Effect.Effect<infer Value, unknown>
        ? Value
        : never
    >,
    request: Request,
    requestId: string,
  ): Response => {
    const etag = `"sha256-${storedAsset.metadata.digest}"`,
      baseHeaders = responseHeaders(requestId, undefined, "public, max-age=31536000, immutable");
    baseHeaders.set("etag", etag);
    baseHeaders.set("accept-ranges", "bytes");
    baseHeaders.set("content-type", storedAsset.metadata.mediaType);
    baseHeaders.set(
      "content-disposition",
      `inline; filename*=UTF-8''${encodeURIComponent(storedAsset.metadata.filename)}`,
    );
    if (request.headers.get("if-none-match") === etag) {
      return new Response(null, { headers: baseHeaders, status: 304 });
    }
    const range = request.headers.get("range");
    if (
      range !== null &&
      request.headers.get("if-range") !== null &&
      request.headers.get("if-range") !== etag
    ) {
      return new Response(request.method === "HEAD" ? null : responseBody(storedAsset.bytes), {
        headers: baseHeaders,
        status: 200,
      });
    }
    if (range !== null) {
      const match = /^bytes=(\d*)-(\d*)$/u.exec(range);
      if (match === null || range.includes(",")) {
        baseHeaders.set("content-range", `bytes */${storedAsset.bytes.byteLength}`);
        return new Response(null, { headers: baseHeaders, status: 416 });
      }
      let end: number, start: number;
      if (match[1] === "") {
        start = Math.max(0, storedAsset.bytes.byteLength - Number(match[2]));
        end = storedAsset.bytes.byteLength - 1;
      } else {
        start = Number(match[1]);
        end = match[2] === "" ? storedAsset.bytes.byteLength - 1 : Number(match[2]);
      }
      if (
        !Number.isSafeInteger(start) ||
        !Number.isSafeInteger(end) ||
        start < 0 ||
        end < start ||
        start >= storedAsset.bytes.byteLength
      ) {
        baseHeaders.set("content-range", `bytes */${storedAsset.bytes.byteLength}`);
        return new Response(null, { headers: baseHeaders, status: 416 });
      }
      const boundedEnd = Math.min(end, storedAsset.bytes.byteLength - 1),
        bytes = storedAsset.bytes.slice(start, boundedEnd + 1);
      baseHeaders.set(
        "content-range",
        `bytes ${start}-${boundedEnd}/${storedAsset.bytes.byteLength}`,
      );
      baseHeaders.set("content-length", String(bytes.byteLength));
      return new Response(request.method === "HEAD" ? null : responseBody(bytes), {
        headers: baseHeaders,
        status: 206,
      });
    }
    baseHeaders.set("content-length", String(storedAsset.bytes.byteLength));
    return new Response(request.method === "HEAD" ? null : responseBody(storedAsset.bytes), {
      headers: baseHeaders,
      status: 200,
    });
  };

/**
 * Creates an interruptible Web handler. It enforces transport limits, validates
 * declared schemas, sanitizes failures, and streams immutable Asset responses.
 */
export const makeHandler = (options: Options = {}): Effect.Effect<Handler, never, CmsService> =>
  Effect.gen(function* createHandler() {
    const cms = yield* CmsService,
      operations = options.deliveryOperations ?? [],
      managementOperations = options.managementOperations ?? [],
      operationMatchers = operations.map((operation) => ({
        operation,
        ...compilePath(`${headlessPrefix}${operation.path}`),
      })),
      maximumHeaderByteLength = options.maximumHeaderByteLength ?? 32_768,
      maximumJsonBodyByteLength = options.maximumJsonBodyByteLength ?? 1_000_000,
      maximumMultipartBodyByteLength = options.maximumMultipartBodyByteLength ?? 25_000_000,
      maximumMultipartFileByteLength = options.maximumMultipartFileByteLength ?? 20_000_000,
      maximumMultipartMetadataByteLength = options.maximumMultipartMetadataByteLength ?? 64_000,
      maximumUrlLength = options.maximumUrlLength ?? 8192,
      requestTimeoutMilliseconds = options.requestTimeoutMilliseconds ?? 30_000,
      requestIdentifier = options.requestIdentifier ?? (() => crypto.randomUUID()),
      handleRequest = async (
        request: Request,
        signal: AbortSignal,
        requestId: string,
      ): Promise<Response> => {
        const withOutcome = <Value>(
            effect: Effect.Effect<Value, CmsError>,
            operationRequestId: string,
            success: (value: Value) => Response,
          ): Promise<Response> =>
            respondWithOutcome({ effect, requestId: operationRequestId, signal, success }),
          headerByteLength = [...request.headers].reduce(
            (total, [name, value]) => total + name.length + value.length + 4,
            0,
          );
        if (request.url.length > maximumUrlLength) {
          return requestFailureResponse(
            new RequestFailure("UriTooLong", "Request URL exceeds the configured limit", 414),
            requestId,
          );
        }
        if (headerByteLength > maximumHeaderByteLength) {
          return requestFailureResponse(
            new RequestFailure(
              "HeadersTooLarge",
              "Request headers exceed the configured limit",
              431,
            ),
            requestId,
          );
        }
        const accept = request.headers.get("accept"),
          assetRequest =
            request.method === "GET" || request.method === "HEAD"
              ? /\/assets\/[^/]+$/u.test(new URL(request.url).pathname)
              : false;
        if (
          !assetRequest &&
          accept !== null &&
          !accept.split(",").some((mediaRange) => {
            const mediaType = mediaRange.split(";", 1)[0]?.trim().toLowerCase();
            return mediaType === "*/*" || mediaType === "application/json";
          })
        ) {
          return requestFailureResponse(
            new RequestFailure(
              "NotAcceptable",
              "The requested response media type is not available",
              406,
            ),
            requestId,
          );
        }
        const declaredBodyByteLength = Number(request.headers.get("content-length"));
        if (
          Number.isFinite(declaredBodyByteLength) &&
          declaredBodyByteLength > maximumJsonBodyByteLength
        ) {
          return requestFailureResponse(
            new RequestFailure("PayloadTooLarge", "Request body exceeds the configured limit", 413),
            requestId,
          );
        }
        const requestUrl = new URL(request.url),
          activeOutcome = await runOperationInterruptibly(cms.activeDefinitionSnapshot, signal);
        if (!activeOutcome.success) {
          if (activeOutcome.error === undefined) {
            throw new Error("Operation failed without an error");
          }
          return errorResponse(activeOutcome.error, requestId);
        }
        if (activeOutcome.value === undefined) {
          throw new Error("Operation succeeded without a value");
        }
        const snapshot = activeOutcome.value,
          fingerprintOutcome = await runOperationInterruptibly(
            ensureFingerprint(request, snapshot.fingerprint),
            signal,
          );
        if (!fingerprintOutcome.success) {
          if (fingerprintOutcome.error === undefined) {
            throw new Error("Fingerprint operation failed without an error");
          }
          return errorResponse(fingerprintOutcome.error, requestId);
        }

        if (request.method === "OPTIONS" && options.cors !== undefined) {
          const origin = request.headers.get("origin");
          if (origin === null || !options.cors.origins.includes(origin)) {
            return bodylessResponse(403, requestId);
          }
          return new Response(null, {
            headers: {
              "access-control-allow-headers": options.cors.headers.join(", "),
              "access-control-allow-methods": options.cors.methods.join(", "),
              "access-control-allow-origin": origin,
              vary: "Origin",
              "x-request-id": requestId,
            },
            status: 204,
          });
        }

        if (
          requestUrl.pathname === `${managementPrefix}/openapi.json` &&
          request.method === "GET"
        ) {
          return jsonResponse({
            fingerprint: snapshot.fingerprint,
            requestId,
            status: 200,
            value: HttpApiContract.managementDocument(managementOperations),
          });
        }
        if (requestUrl.pathname === `${headlessPrefix}/openapi.json` && request.method === "GET") {
          return jsonResponse({
            cacheControl: "no-cache",
            fingerprint: snapshot.fingerprint,
            requestId,
            status: 200,
            value: HttpApiContract.headlessDocument(operations),
          });
        }
        if (requestUrl.pathname === `${headlessPrefix}/schema` && request.method === "GET") {
          const headers = responseHeaders(requestId, snapshot.fingerprint, "no-cache");
          headers.set("content-type", "application/json; charset=utf-8");
          headers.set("etag", `"${snapshot.fingerprint}"`);
          if (request.headers.get("if-none-match") === `"${snapshot.fingerprint}"`) {
            return new Response(null, { headers, status: 304 });
          }
          return Response.json(discovery({ operations, snapshot }), {
            headers,
            status: 200,
          });
        }

        const managementBase = `${managementPrefix}/definition-spaces/${encodeURIComponent(snapshot.definitionSpaceId)}`;
        if (
          requestUrl.pathname === `${managementBase}/definition-snapshot` &&
          request.method === "GET"
        ) {
          return jsonResponse({
            fingerprint: snapshot.fingerprint,
            requestId,
            status: 200,
            value: { ...snapshot.input, fingerprint: snapshot.fingerprint },
          });
        }

        if (requestUrl.pathname === `${managementBase}/definitions` && request.method === "GET") {
          return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
            jsonResponse({
              fingerprint: snapshot.fingerprint,
              requestId,
              status: 200,
              value: {
                catalogVersion: state.version,
                items: state.active.input.definitions,
              },
            }),
          );
        }

        const definitionMatch = matchPath(
          `${managementBase}/definitions/{definitionId}`,
          requestUrl.pathname,
        );
        if (definitionMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.readDefinitionCatalog.pipe(
              Effect.flatMap((state) => {
                const definitionId = requiredPathParameter(definitionMatch, "definitionId"),
                  definition = state.active.input.definitions.find(
                    (candidate) => candidate.id === definitionId,
                  );
                return definition === undefined
                  ? Effect.fail(
                      NotFound.make({ message: `Definition ${definitionId} was not found` }),
                    )
                  : Effect.succeed({
                      catalogVersion: state.version,
                      definition,
                      retired: state.retiredDefinitionIds.has(definitionId),
                    });
              }),
            ),
            requestId,
            (value) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value,
              }),
          );
        }

        const definitionRevisionsMatch = matchPath(
          `${managementBase}/definitions/{definitionId}/revisions`,
          requestUrl.pathname,
        );
        if (definitionRevisionsMatch !== undefined) {
          const definitionId = requiredPathParameter(definitionRevisionsMatch, "definitionId");
          if (request.method === "GET") {
            return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: {
                  catalogVersion: state.version,
                  items: state.revisions.filter(
                    (revision) => revision.definitionId === definitionId,
                  ),
                },
              }),
            );
          }
          if (request.method === "POST") {
            try {
              const body = await parseJson(request, maximumJsonBodyByteLength),
                { definition } = body,
                { expectedCatalogVersion } = body;
              if (
                definition === null ||
                Array.isArray(definition) ||
                typeof definition !== "object" ||
                (definition as { readonly id?: unknown }).id !== definitionId ||
                !Number.isSafeInteger(expectedCatalogVersion)
              ) {
                throw InvalidInput.make({
                  message:
                    "Definition revision append requires a matching definition and expectedCatalogVersion",
                });
              }
              return await withOutcome(
                cms.appendDefinitionRevision({
                  definition: definition as never,
                  expectedCatalogVersion: expectedCatalogVersion as number,
                  source: "management-http",
                }),
                requestId,
                (state) =>
                  jsonResponse({
                    fingerprint: snapshot.fingerprint,
                    requestId,
                    status: 201,
                    value: { catalogVersion: state.version },
                  }),
              );
            } catch (error) {
              return invalidRequestResponse(
                error,
                "Invalid Definition revision append request",
                requestId,
              );
            }
          }
        }

        const retirementMatch = matchPath(
          `${managementBase}/definitions/{definitionId}/retirements`,
          requestUrl.pathname,
        );
        if (retirementMatch !== undefined && request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              { expectedCatalogVersion } = body;
            if (!Number.isSafeInteger(expectedCatalogVersion)) {
              throw InvalidInput.make({
                message: "Definition retirement requires expectedCatalogVersion",
              });
            }
            return await withOutcome(
              cms.retireDefinition({
                definitionId: requiredPathParameter(retirementMatch, "definitionId"),
                expectedCatalogVersion: expectedCatalogVersion as number,
                source: "management-http",
              }),
              requestId,
              (state) =>
                jsonResponse({
                  fingerprint: snapshot.fingerprint,
                  requestId,
                  status: 201,
                  value: { catalogVersion: state.version },
                }),
            );
          } catch (error) {
            return invalidRequestResponse(
              error,
              "Invalid Definition retirement request",
              requestId,
            );
          }
        }

        if (
          requestUrl.pathname === `${managementBase}/definition-snapshots` &&
          request.method === "GET"
        ) {
          return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
            jsonResponse({
              fingerprint: snapshot.fingerprint,
              requestId,
              status: 200,
              value: {
                catalogVersion: state.version,
                items: state.snapshots.map((snapshotRecord) => ({
                  ...snapshotRecord.input,
                  activatedAt: snapshotRecord.activatedAt,
                  fingerprint: snapshotRecord.compiled.fingerprint,
                })),
              },
            }),
          );
        }

        const definitionSnapshotMatch = matchPath(
          `${managementBase}/definition-snapshots/{snapshotId}`,
          requestUrl.pathname,
        );
        if (definitionSnapshotMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.readDefinitionCatalog.pipe(
              Effect.flatMap((state) => {
                const snapshotRecord = state.snapshots.find(
                  (candidate) =>
                    candidate.compiled.snapshotId ===
                    requiredPathParameter(definitionSnapshotMatch, "snapshotId"),
                );
                return snapshotRecord === undefined
                  ? Effect.fail(
                      NotFound.make({
                        message: `Definition Snapshot ${requiredPathParameter(definitionSnapshotMatch, "snapshotId")} was not found`,
                      }),
                    )
                  : Effect.succeed({
                      ...snapshotRecord.input,
                      activatedAt: snapshotRecord.activatedAt,
                      fingerprint: snapshotRecord.compiled.fingerprint,
                    });
              }),
            ),
            requestId,
            (value) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value,
              }),
          );
        }

        if (
          requestUrl.pathname === `${managementBase}/definition-snapshot-activations` &&
          request.method === "POST"
        ) {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              targetSnapshot = body["snapshot"],
              { expectedCatalogVersion } = body,
              { migrationPreparationId } = body;
            if (
              targetSnapshot === null ||
              Array.isArray(targetSnapshot) ||
              typeof targetSnapshot !== "object" ||
              !Number.isSafeInteger(expectedCatalogVersion)
            ) {
              throw InvalidInput.make({
                message: "Definition activation requires snapshot and expectedCatalogVersion",
              });
            }
            const activation =
              typeof migrationPreparationId === "string"
                ? cms.readDefinitionCatalog.pipe(
                    Effect.flatMap((state) => {
                      const preparation = state.migrationPreparations.find(
                        (candidate) => candidate.id === migrationPreparationId,
                      );
                      return preparation === undefined
                        ? Effect.fail(
                            NotFound.make({
                              message: `Migration Preparation ${migrationPreparationId} was not found`,
                            }),
                          )
                        : cms.activateDefinitionSnapshot({
                            expectedCatalogVersion: expectedCatalogVersion as number,
                            migration: {
                              manifest: preparation.manifest,
                              preparationId: preparation.id,
                            },
                            snapshot: targetSnapshot as never,
                            source: "management-http",
                          });
                    }),
                  )
                : cms.activateDefinitionSnapshot({
                    expectedCatalogVersion: expectedCatalogVersion as number,
                    snapshot: targetSnapshot as never,
                    source: "management-http",
                  });
            return await withOutcome(activation, requestId, (result) =>
              jsonResponse({
                fingerprint: result.snapshot.fingerprint,
                requestId,
                status: 201,
                value: {
                  catalogVersion: result.catalogVersion,
                  fingerprint: result.snapshot.fingerprint,
                  migratedEntryCount: result.migratedEntryCount,
                  snapshotId: result.snapshot.snapshotId,
                },
              }),
            );
          } catch (error) {
            return invalidRequestResponse(
              error,
              "Invalid Definition activation request",
              requestId,
            );
          }
        }

        if (
          requestUrl.pathname === `${managementBase}/catalog-events` &&
          request.method === "GET"
        ) {
          return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
            jsonResponse({
              fingerprint: snapshot.fingerprint,
              requestId,
              status: 200,
              value: { catalogVersion: state.version, items: state.events },
            }),
          );
        }
        if (requestUrl.pathname === `${managementBase}/migration-manifests`) {
          if (request.method === "GET") {
            return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: { catalogVersion: state.version, items: state.migrationManifests },
              }),
            );
          }
          if (request.method === "POST") {
            try {
              const body = await parseJson(request, maximumJsonBodyByteLength),
                { manifest } = body,
                { expectedCatalogVersion } = body;
              if (
                manifest === null ||
                Array.isArray(manifest) ||
                typeof manifest !== "object" ||
                !Number.isSafeInteger(expectedCatalogVersion)
              ) {
                throw InvalidInput.make({
                  message: "Migration Manifest append requires manifest and expectedCatalogVersion",
                });
              }
              return await withOutcome(
                cms.appendMigrationManifest({
                  expectedCatalogVersion: expectedCatalogVersion as number,
                  manifest: manifest as never,
                }),
                requestId,
                (state) =>
                  jsonResponse({
                    fingerprint: snapshot.fingerprint,
                    requestId,
                    status: 201,
                    value: { catalogVersion: state.version },
                  }),
              );
            } catch (error) {
              return invalidRequestResponse(
                error,
                "Invalid Migration Manifest append request",
                requestId,
              );
            }
          }
        }
        const migrationManifestMatch = matchPath(
          `${managementBase}/migration-manifests/{migrationManifestId}`,
          requestUrl.pathname,
        );
        if (migrationManifestMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.readDefinitionCatalog.pipe(
              Effect.flatMap((state) => {
                const manifest = state.migrationManifests.find(
                  (candidate) =>
                    candidate.id ===
                    requiredPathParameter(migrationManifestMatch, "migrationManifestId"),
                );
                return manifest === undefined
                  ? Effect.fail(NotFound.make({ message: "Migration Manifest was not found" }))
                  : Effect.succeed(manifest);
              }),
            ),
            requestId,
            (value) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value,
              }),
          );
        }
        const migrationPreparationMatch = matchPath(
          `${managementBase}/migration-preparations/{migrationPreparationId}`,
          requestUrl.pathname,
        );
        if (migrationPreparationMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.readDefinitionCatalog.pipe(
              Effect.flatMap((state) => {
                const preparation = state.migrationPreparations.find(
                  (candidate) =>
                    candidate.id ===
                    requiredPathParameter(migrationPreparationMatch, "migrationPreparationId"),
                );
                return preparation === undefined
                  ? Effect.fail(NotFound.make({ message: "Migration Preparation was not found" }))
                  : Effect.succeed(preparation);
              }),
            ),
            requestId,
            (value) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value,
              }),
          );
        }
        if (
          requestUrl.pathname === `${managementBase}/migration-preparations` &&
          request.method === "POST"
        ) {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              { manifestId } = body,
              targetSnapshot = body["snapshot"],
              { expectedCatalogVersion } = body;
            if (
              typeof manifestId !== "string" ||
              targetSnapshot === null ||
              Array.isArray(targetSnapshot) ||
              typeof targetSnapshot !== "object" ||
              !Number.isSafeInteger(expectedCatalogVersion)
            ) {
              throw InvalidInput.make({
                message:
                  "Migration Preparation requires manifestId, snapshot, and expectedCatalogVersion",
              });
            }
            return await withOutcome(
              cms.prepareDefinitionMigration({
                expectedCatalogVersion: expectedCatalogVersion as number,
                manifestId,
                snapshot: targetSnapshot as never,
              }),
              requestId,
              (preparation) =>
                jsonResponse({
                  fingerprint: snapshot.fingerprint,
                  requestId,
                  status: 200,
                  value: preparation,
                }),
            );
          } catch (error) {
            return invalidRequestResponse(
              error,
              "Invalid Migration Preparation request",
              requestId,
            );
          }
        }

        const createMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries`,
          requestUrl.pathname,
        );
        if (createMatch !== undefined && request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              { values } = body;
            if (values === null || Array.isArray(values) || typeof values !== "object") {
              throw InvalidInput.make({ message: "Entry create requires values" });
            }
            return await withOutcome(
              cms.createEntry({
                contentTypeId: requiredPathParameter(createMatch, "contentTypeId"),
                values: values as JsonObject,
              }),
              requestId,
              (result) =>
                jsonResponse({
                  fingerprint: snapshot.fingerprint,
                  requestId,
                  status: 201,
                  value: result,
                }),
            );
          } catch (error) {
            return invalidRequestResponse(error, "Invalid Entry create request", requestId);
          }
        }

        const queryMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/query`,
          requestUrl.pathname,
        );
        if (queryMatch !== undefined && request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength);
            return await withOutcome(
              cms.queryEntries({
                ...body,
                contentTypeId: requiredPathParameter(queryMatch, "contentTypeId"),
              } as never),
              requestId,
              (result) =>
                jsonResponse({
                  fingerprint: snapshot.fingerprint,
                  requestId,
                  status: 200,
                  value: result,
                }),
            );
          } catch (error) {
            return invalidRequestResponse(error, "Invalid Entry Query request", requestId);
          }
        }

        const readMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/read`,
          requestUrl.pathname,
        );
        if (readMatch !== undefined && request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              { projection } = body,
              { expansion } = body;
            if (
              projection !== undefined &&
              (!Array.isArray(projection) || !projection.every((path) => typeof path === "string"))
            ) {
              throw InvalidInput.make({ message: "Projection must be an array of Field Paths" });
            }
            if (
              expansion !== undefined &&
              (!Array.isArray(expansion) || !expansion.every((path) => typeof path === "string"))
            ) {
              throw InvalidInput.make({
                message: "Expansion must be an array of Relationship paths",
              });
            }
            return await withOutcome(
              cms.getEntry({
                contentTypeId: requiredPathParameter(readMatch, "contentTypeId"),
                entryId: requiredPathParameter(readMatch, "entryId"),
                expansion,
                projection,
              }),
              requestId,
              (entry) =>
                jsonResponse({
                  fingerprint: snapshot.fingerprint,
                  requestId,
                  status: 200,
                  value: entry,
                }),
            );
          } catch (error) {
            return invalidRequestResponse(
              error,
              "Invalid structured Entry read request",
              requestId,
            );
          }
        }

        const entryMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}`,
          requestUrl.pathname,
        );
        if (entryMatch !== undefined) {
          const contentTypeId = requiredPathParameter(entryMatch, "contentTypeId"),
            entryId = requiredPathParameter(entryMatch, "entryId");
          if (request.method === "GET") {
            return withOutcome(cms.getEntry({ contentTypeId, entryId }), requestId, (entry) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: entry,
              }),
            );
          }
          if (request.method === "PUT") {
            try {
              const body = await parseJson(request, maximumJsonBodyByteLength),
                { values } = body;
              if (values === null || Array.isArray(values) || typeof values !== "object") {
                throw InvalidInput.make({ message: "Entry replacement requires values" });
              }
              return await withOutcome(
                cms.updateEntry({
                  contentTypeId,
                  entryId,
                  values: values as JsonObject,
                  writeToken: request.headers.get("cms-write-token") ?? undefined,
                }),
                requestId,
                (result) =>
                  jsonResponse({
                    fingerprint: snapshot.fingerprint,
                    requestId,
                    status: 200,
                    value: result,
                  }),
              );
            } catch (error) {
              return invalidRequestResponse(error, "Invalid Entry replacement request", requestId);
            }
          }
          if (request.method === "DELETE") {
            return withOutcome(
              cms.deleteEntry({
                contentTypeId,
                entryId,
                writeToken: request.headers.get("cms-write-token") ?? undefined,
              }),
              requestId,
              (deletionRecord) =>
                deletionRecord === undefined
                  ? bodylessResponse(204, requestId, snapshot.fingerprint)
                  : jsonResponse({
                      fingerprint: snapshot.fingerprint,
                      requestId,
                      status: 200,
                      value: deletionRecord,
                    }),
            );
          }
          return jsonResponse({
            requestId,
            status: 405,
            value: { code: "MethodNotAllowed", message: "Method not allowed", requestId },
          });
        }

        const stateMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/state`,
          requestUrl.pathname,
        );
        if (stateMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.getCurrentEntryState({
              contentTypeId: requiredPathParameter(stateMatch, "contentTypeId"),
              entryId: requiredPathParameter(stateMatch, "entryId"),
            }),
            requestId,
            (state) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: state,
              }),
          );
        }

        const revisionsMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/revisions`,
          requestUrl.pathname,
        );
        if (revisionsMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.listEntryRevisions({
              contentTypeId: requiredPathParameter(revisionsMatch, "contentTypeId"),
              cursor: requestUrl.searchParams.get("cursor") ?? undefined,
              entryId: requiredPathParameter(revisionsMatch, "entryId"),
              pageSize: Number(requestUrl.searchParams.get("pageSize") ?? "20"),
            }),
            requestId,
            (page) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: page,
              }),
          );
        }

        const revisionMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/revisions/{revisionNumber}`,
          requestUrl.pathname,
        );
        if (revisionMatch !== undefined && request.method === "GET") {
          return withOutcome(
            cms.inspectEntryRevision({
              contentTypeId: requiredPathParameter(revisionMatch, "contentTypeId"),
              entryId: requiredPathParameter(revisionMatch, "entryId"),
              revisionNumber: Number(requiredPathParameter(revisionMatch, "revisionNumber")),
            }),
            requestId,
            (revision) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: revision,
              }),
          );
        }

        const restorationMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/restorations`,
          requestUrl.pathname,
        );
        if (restorationMatch !== undefined && request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength);
            if (
              !Number.isSafeInteger(body["revisionNumber"]) ||
              typeof body["writeToken"] !== "string"
            ) {
              throw InvalidInput.make({
                message: "Entry restoration requires revisionNumber and writeToken",
              });
            }
            return await withOutcome(
              cms.restoreEntryRevision({
                contentTypeId: requiredPathParameter(restorationMatch, "contentTypeId"),
                entryId: requiredPathParameter(restorationMatch, "entryId"),
                revisionNumber: body["revisionNumber"] as number,
                writeToken: body["writeToken"],
              }),
              requestId,
              (state) =>
                jsonResponse({
                  fingerprint: snapshot.fingerprint,
                  requestId,
                  status: 201,
                  value: state,
                }),
            );
          } catch (error) {
            return invalidRequestResponse(error, "Invalid Entry restoration request", requestId);
          }
        }

        const purgeMatch = matchPath(
          `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/purges`,
          requestUrl.pathname,
        );
        if (purgeMatch !== undefined && request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength);
            if (typeof body["writeToken"] !== "string") {
              throw InvalidInput.make({ message: "Permanent Purge requires writeToken" });
            }
            return await withOutcome(
              cms.permanentlyPurgeEntry({
                contentTypeId: requiredPathParameter(purgeMatch, "contentTypeId"),
                entryId: requiredPathParameter(purgeMatch, "entryId"),
                writeToken: body["writeToken"],
              }),
              requestId,
              () => bodylessResponse(204, requestId, snapshot.fingerprint),
            );
          } catch (error) {
            return invalidRequestResponse(error, "Invalid Permanent Purge request", requestId);
          }
        }

        const assetMatch = matchPath(`${managementBase}/assets/{assetId}`, requestUrl.pathname);
        if (assetMatch !== undefined) {
          const assetId = requiredPathParameter(assetMatch, "assetId");
          if (request.method === "GET") {
            return withOutcome(cms.getAsset(assetId), requestId, (asset) =>
              jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value: asset,
              }),
            );
          }
          if (request.method === "DELETE") {
            return withOutcome(cms.deleteAsset(assetId), requestId, () =>
              bodylessResponse(204, requestId, snapshot.fingerprint),
            );
          }
        }
        const assetContentMatch = matchPath(
          `${managementBase}/assets/{assetId}/content`,
          requestUrl.pathname,
        );
        if (
          assetContentMatch !== undefined &&
          (request.method === "GET" || request.method === "HEAD")
        ) {
          return withOutcome(
            cms.readAsset(requiredPathParameter(assetContentMatch, "assetId")),
            requestId,
            (asset) => assetContentResponse(asset, request, requestId),
          );
        }

        if (requestUrl.pathname === `${managementBase}/assets` && request.method === "POST") {
          try {
            if (
              !(request.headers.get("content-type") ?? "")
                .toLowerCase()
                .startsWith("multipart/form-data")
            ) {
              throw new RequestFailure(
                "UnsupportedMediaType",
                "Asset upload requires multipart/form-data",
                415,
              );
            }
            const stagedUpload = await stageMultipartAsset(request, signal, {
              body: maximumMultipartBodyByteLength,
              file: maximumMultipartFileByteLength,
              metadata: maximumMultipartMetadataByteLength,
            });
            try {
              return await withOutcome(
                cms.ingestAsset({ ...stagedUpload.metadata, content: stagedUpload.content }),
                requestId,
                (asset) =>
                  jsonResponse({
                    fingerprint: snapshot.fingerprint,
                    requestId,
                    status: 201,
                    value: asset,
                  }),
              );
            } finally {
              await stagedUpload.cleanup();
            }
          } catch (error) {
            return invalidRequestResponse(error, "Invalid multipart Asset upload", requestId);
          }
        }

        for (const managementOperation of managementOperations) {
          const parameters = matchPath(
            `${managementBase}${managementOperation.path}`,
            requestUrl.pathname,
          );
          if (parameters === undefined) {
            continue;
          }
          if (request.method !== managementOperation.method) {
            return jsonResponse({
              requestId,
              status: 405,
              value: { code: "MethodNotAllowed", message: "Method not allowed", requestId },
            });
          }
          return withOutcome(
            executeOperation(managementOperation, {
              cms,
              parameters,
              request,
              requestId,
              snapshot,
            }),
            requestId,
            (value) => {
              if (value instanceof Response) {
                return value;
              }
              if (value === undefined) {
                return bodylessResponse(204, requestId, snapshot.fingerprint);
              }
              return jsonResponse({
                fingerprint: snapshot.fingerprint,
                requestId,
                status: 200,
                value,
              });
            },
          );
        }

        for (const matcher of operationMatchers) {
          const match = matcher.expression.exec(requestUrl.pathname);
          if (match === null) {
            continue;
          }
          if (request.method !== matcher.operation.method) {
            continue;
          }
          if (
            request.method === "POST" &&
            !(request.headers.get("content-type") ?? "")
              .toLowerCase()
              .startsWith("application/json")
          ) {
            return requestFailureResponse(
              new RequestFailure(
                "UnsupportedMediaType",
                "Delivery command requires application/json",
                415,
              ),
              requestId,
            );
          }
          if (
            matcher.operation.requiresIdempotencyKey === true &&
            (request.headers.get("idempotency-key")?.length ?? 0) === 0
          ) {
            return errorResponse(
              InvalidInput.make({ message: "Idempotency-Key is required" }),
              requestId,
            );
          }
          const parameters = Object.fromEntries(
            matcher.names.map((name, index) => [name, decodeURIComponent(match[index + 1] ?? "")]),
          );
          return withOutcome(
            executeOperation(matcher.operation, { cms, parameters, request, requestId, snapshot }),
            requestId,
            (value) => {
              if (value instanceof Response) {
                return value;
              }
              if (value === undefined) {
                return bodylessResponse(204, requestId, snapshot.fingerprint);
              }
              return jsonResponse({
                cacheControl: matcher.operation.cacheControl ?? "no-cache",
                fingerprint: snapshot.fingerprint,
                requestId,
                status: matcher.operation.successStatus ?? 200,
                value,
              });
            },
          );
        }

        if (operationMatchers.some((matcher) => matcher.expression.test(requestUrl.pathname))) {
          return jsonResponse({
            requestId,
            status: 405,
            value: { code: "MethodNotAllowed", message: "Method not allowed", requestId },
          });
        }

        return jsonResponse({
          requestId,
          status: 404,
          value: { code: "NotFound", message: "Route not found", requestId },
        });
      };

    return async (request): Promise<Response> => {
      const requestId = requestIdentifier(),
        controller = new AbortController(),
        onClientAbort = (): void => {
          controller.abort(request.signal.reason);
        },
        timeout = setTimeout(() => {
          controller.abort(new Error("request timeout"));
        }, requestTimeoutMilliseconds);
      request.signal.addEventListener("abort", onClientAbort, { once: true });
      try {
        const scopedRequest = new Request(request, { signal: controller.signal });
        return await Promise.race([
          handleRequest(scopedRequest, controller.signal, requestId).catch((error: unknown) => {
            if (controller.signal.aborted) {
              return requestFailureResponse(
                new RequestFailure(
                  "RequestTimeout",
                  "The request was interrupted or exceeded its configured duration",
                  408,
                ),
                requestId,
              );
            }
            throw error;
          }),
          new Promise<Response>((resolve) => {
            controller.signal.addEventListener(
              "abort",
              () => {
                resolve(
                  requestFailureResponse(
                    new RequestFailure(
                      "RequestTimeout",
                      "The request was interrupted or exceeded its configured duration",
                      408,
                    ),
                    requestId,
                  ),
                );
              },
              { once: true },
            );
          }),
        ]);
      } finally {
        clearTimeout(timeout);
        request.signal.removeEventListener("abort", onClientAbort);
      }
    };
  });

const respond = (handler: Handler, request: HttpServerRequest.HttpServerRequest) =>
  HttpServerRequest.toWeb(request).pipe(
    Effect.orDie,
    Effect.flatMap((webRequest) => Effect.promise(() => handler(webRequest))),
    Effect.map(HttpServerResponse.fromWeb),
  );

/**
 * Creates the configurable, portable Effect HTTP Transport Layer. A CMS Builder
 * provides an Effect HTTP-server adapter when serving these routes.
 */
export const layer = (options: Options = {}) => {
  const managementApi = HttpApiContract.management(options.managementOperations),
    headlessApi = HttpApiContract.headless(options.deliveryOperations ?? []),
    managementHandlers = HttpApiBuilder.group(managementApi, "management", (handlers) =>
      makeHandler(options).pipe(
        Effect.map((handler) =>
          handlers.handleAll(
            Object.fromEntries(
              Object.keys(managementApi.groups["management"].endpoints).map((identifier) => [
                identifier,
                ({ request }: { readonly request: HttpServerRequest.HttpServerRequest }) =>
                  respond(handler, request),
              ]),
            ),
          ),
        ),
      ),
    ),
    headlessHandlers = HttpApiBuilder.group(headlessApi, "headless", (handlers) =>
      makeHandler(options).pipe(
        Effect.map((handler) =>
          handlers.handleAll(
            Object.fromEntries(
              Object.keys(headlessApi.groups["headless"].endpoints).map((identifier) => [
                identifier,
                ({ request }: { readonly request: HttpServerRequest.HttpServerRequest }) =>
                  respond(handler, request),
              ]),
            ),
          ),
        ),
      ),
    ),
    declaredRoutes = Layer.merge(
      HttpApiBuilder.layer(managementApi).pipe(Layer.provide(managementHandlers)),
      HttpApiBuilder.layer(headlessApi).pipe(Layer.provide(headlessHandlers)),
    ),
    crossCuttingRoutes = Layer.effectDiscard(
      Effect.gen(function* registerCrossCuttingRoutes() {
        const handler = yield* makeHandler(options),
          router = yield* HttpRouter.HttpRouter;
        yield* router.add("GET", `${managementPrefix}/openapi.json`, (request) =>
          respond(handler, request),
        );
        yield* router.add("GET", `${headlessPrefix}/openapi.json`, (request) =>
          respond(handler, request),
        );
        yield* router.add("OPTIONS", "/api/*", (request) => respond(handler, request));
      }),
    );
  return Layer.merge(declaredRoutes, crossCuttingRoutes);
};
