import { Effect } from "effect";
import type { IngestInput } from "../Asset.ts";
import { Service as CmsService } from "../Cms.ts";
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
} from "../CmsError.ts";
import type { JsonObject, JsonValue } from "../internal/json.ts";
import {
  type DeliveryOperation,
  type ErrorDocument,
  type ManagementOperation,
  discovery,
  headlessPrefix,
  managementPrefix,
} from "./HttpContract.ts";
import * as OpenApi from "./OpenApi.ts";

export interface Options {
  readonly deliveryOperations?: readonly DeliveryOperation[];
  readonly managementOperations?: readonly ManagementOperation[];
  readonly maximumHeaderByteLength?: number;
  readonly maximumJsonBodyByteLength?: number;
  readonly maximumUrlLength?: number;
  readonly requestTimeoutMilliseconds?: number;
  readonly requestIdentifier?: () => string;
  readonly cors?: {
    readonly origins: readonly string[];
    readonly methods: readonly string[];
    readonly headers: readonly string[];
  };
}

export type Handler = (request: Request) => Promise<Response>;

interface OperationOutcome<Value> {
  readonly success: boolean;
  readonly value?: Value;
  readonly error?: CmsError;
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

const run = async <Value>(
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
    if (error instanceof InvalidInput) {
      return 400;
    }
    if (error instanceof Forbidden) {
      return 403;
    }
    if (error instanceof NotFound) {
      return 404;
    }
    if (error instanceof DefinitionSnapshotChanged) {
      return 412;
    }
    if (error instanceof UnsupportedQueryCapability || error instanceof ExportTooLarge) {
      return 422;
    }
    if (error instanceof InfrastructureFailure) {
      return error.retryable ? 503 : 500;
    }
    if (
      error instanceof Conflict ||
      error instanceof AssetReferenced ||
      error instanceof ReferenceBlockedDeletion ||
      error instanceof IdempotencyConflict
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
    const details =
        error instanceof InvalidInput && error.issues !== undefined
          ? ({
              issues: error.issues.map((issue: ValidationIssue) => ({
                path: issue.path,
                reason: issue.reason,
              })),
            } as unknown as JsonValue)
          : undefined,
      document: ErrorDocument = {
        code: errorCode(error),
        message: error.message,
        requestId,
        ...(details === undefined ? {} : { details }),
      },
      headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    if (error instanceof InfrastructureFailure && error.retryable) {
      headers.set("retry-after", "1");
    }
    return new Response(JSON.stringify(document), { headers, status: errorStatus(error) });
  },
  requestFailureResponse = (failure: RequestFailure, requestId: string): Response => {
    const headers = responseHeaders(requestId);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(
      JSON.stringify({ code: failure.code, message: failure.message, requestId }),
      { headers, status: failure.status },
    );
  },
  invalidRequestResponse = (error: unknown, fallbackMessage: string, requestId: string): Response =>
    error instanceof RequestFailure
      ? requestFailureResponse(error, requestId)
      : errorResponse(
          error instanceof InvalidInput ? error : new InvalidInput({ message: fallbackMessage }),
          requestId,
        ),
  jsonResponse = (
    value: unknown,
    status: number,
    requestId: string,
    fingerprint?: string,
    cacheControl?: string,
  ): Response => {
    const headers = responseHeaders(requestId, fingerprint, cacheControl);
    headers.set("content-type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(value), { headers, status });
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
      throw new InvalidInput({ message: "Malformed JSON request body" });
    }
    if (value === null || Array.isArray(value) || typeof value !== "object") {
      throw new InvalidInput({ message: "JSON request body must be an object" });
    }
    return value as JsonObject;
  },
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
          new DefinitionSnapshotChanged({ message: "The active Definition Snapshot changed" }),
        )
      : Effect.void;
  },
  respondWithOutcome = async <Value>(
    effect: Effect.Effect<Value, CmsError>,
    requestId: string,
    success: (value: Value) => Response,
    signal?: AbortSignal,
  ): Promise<Response> => {
    const outcome = await run(effect, signal);
    return outcome.success
      ? success(outcome.value as Value)
      : errorResponse(outcome.error!, requestId);
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
      const start =
          match[1] === ""
            ? Math.max(0, storedAsset.bytes.byteLength - Number(match[2]))
            : Number(match[1]),
        end =
          match[1] === ""
            ? storedAsset.bytes.byteLength - 1
            : match[2] === ""
              ? storedAsset.bytes.byteLength - 1
              : Number(match[2]);
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

export const makeHandler = (options: Options = {}): Effect.Effect<Handler, never, CmsService> =>
  Effect.gen(function* makeHandler() {
    const cms = yield* CmsService,
      operations = options.deliveryOperations ?? [],
      managementOperations = options.managementOperations ?? [],
      operationMatchers = operations.map((operation) => ({
        operation,
        ...compilePath(`${headlessPrefix}${operation.path}`),
      })),
      maximumHeaderByteLength = options.maximumHeaderByteLength ?? 32_768,
      maximumJsonBodyByteLength = options.maximumJsonBodyByteLength ?? 1_000_000,
      maximumUrlLength = options.maximumUrlLength ?? 8_192,
      requestTimeoutMilliseconds = options.requestTimeoutMilliseconds ?? 30_000,
      requestIdentifier = options.requestIdentifier ?? (() => crypto.randomUUID());

    const handleRequest = async (
      request: Request,
      signal: AbortSignal,
      requestId: string,
    ): Promise<Response> => {
      const withOutcome = <Value>(
          effect: Effect.Effect<Value, CmsError>,
          operationRequestId: string,
          success: (value: Value) => Response,
        ): Promise<Response> => respondWithOutcome(effect, operationRequestId, success, signal),
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
          new RequestFailure("HeadersTooLarge", "Request headers exceed the configured limit", 431),
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
      const url = new URL(request.url),
        activeOutcome = await run(cms.activeDefinitionSnapshot, signal);
      if (!activeOutcome.success) {
        return errorResponse(activeOutcome.error!, requestId);
      }
      const snapshot = activeOutcome.value!,
        fingerprintOutcome = await run(ensureFingerprint(request, snapshot.fingerprint), signal);
      if (!fingerprintOutcome.success) {
        return errorResponse(fingerprintOutcome.error!, requestId);
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

      if (url.pathname === `${managementPrefix}/openapi.json` && request.method === "GET") {
        return jsonResponse(
          OpenApi.management(managementOperations),
          200,
          requestId,
          snapshot.fingerprint,
        );
      }
      if (url.pathname === `${headlessPrefix}/openapi.json` && request.method === "GET") {
        return jsonResponse(
          OpenApi.headless(operations),
          200,
          requestId,
          snapshot.fingerprint,
          "no-cache",
        );
      }
      if (url.pathname === `${headlessPrefix}/schema` && request.method === "GET") {
        const headers = responseHeaders(requestId, snapshot.fingerprint, "no-cache");
        headers.set("content-type", "application/json; charset=utf-8");
        headers.set("etag", `"${snapshot.fingerprint}"`);
        if (request.headers.get("if-none-match") === `"${snapshot.fingerprint}"`) {
          return new Response(null, { headers, status: 304 });
        }
        return new Response(JSON.stringify(discovery(snapshot, operations)), {
          headers,
          status: 200,
        });
      }

      const managementBase = `${managementPrefix}/definition-spaces/${encodeURIComponent(snapshot.definitionSpaceId)}`;
      if (url.pathname === `${managementBase}/definition-snapshot` && request.method === "GET") {
        return jsonResponse(
          { ...snapshot.input, fingerprint: snapshot.fingerprint },
          200,
          requestId,
          snapshot.fingerprint,
        );
      }

      if (url.pathname === `${managementBase}/definitions` && request.method === "GET") {
        return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
          jsonResponse(
            {
              catalogVersion: state.version,
              items: state.active.input.definitions,
            },
            200,
            requestId,
            snapshot.fingerprint,
          ),
        );
      }

      const definitionMatch = matchPath(
        `${managementBase}/definitions/{definitionId}`,
        url.pathname,
      );
      if (definitionMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.readDefinitionCatalog.pipe(
            Effect.flatMap((state) => {
              const definitionId = definitionMatch["definitionId"]!;
              const definition = state.active.input.definitions.find(
                (candidate) => candidate.id === definitionId,
              );
              return definition === undefined
                ? Effect.fail(new NotFound({ message: `Definition ${definitionId} was not found` }))
                : Effect.succeed({
                    catalogVersion: state.version,
                    definition,
                    retired: state.retiredDefinitionIds.has(definitionId),
                  });
            }),
          ),
          requestId,
          (value) => jsonResponse(value, 200, requestId, snapshot.fingerprint),
        );
      }

      const definitionRevisionsMatch = matchPath(
        `${managementBase}/definitions/{definitionId}/revisions`,
        url.pathname,
      );
      if (definitionRevisionsMatch !== undefined) {
        const definitionId = definitionRevisionsMatch["definitionId"]!;
        if (request.method === "GET") {
          return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
            jsonResponse(
              {
                catalogVersion: state.version,
                items: state.revisions.filter((revision) => revision.definitionId === definitionId),
              },
              200,
              requestId,
              snapshot.fingerprint,
            ),
          );
        }
        if (request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              { definition } = body;
            const { expectedCatalogVersion } = body;
            if (
              definition === null ||
              Array.isArray(definition) ||
              typeof definition !== "object" ||
              (definition as { readonly id?: unknown }).id !== definitionId ||
              !Number.isSafeInteger(expectedCatalogVersion)
            ) {
              throw new InvalidInput({
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
                jsonResponse(
                  { catalogVersion: state.version },
                  201,
                  requestId,
                  snapshot.fingerprint,
                ),
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
        url.pathname,
      );
      if (retirementMatch !== undefined && request.method === "POST") {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength),
            { expectedCatalogVersion } = body;
          if (!Number.isSafeInteger(expectedCatalogVersion)) {
            throw new InvalidInput({
              message: "Definition retirement requires expectedCatalogVersion",
            });
          }
          return await withOutcome(
            cms.retireDefinition({
              definitionId: retirementMatch["definitionId"]!,
              expectedCatalogVersion: expectedCatalogVersion as number,
              source: "management-http",
            }),
            requestId,
            (state) =>
              jsonResponse({ catalogVersion: state.version }, 201, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Definition retirement request", requestId);
        }
      }

      if (url.pathname === `${managementBase}/definition-snapshots` && request.method === "GET") {
        return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
          jsonResponse(
            {
              catalogVersion: state.version,
              items: state.snapshots.map((snapshotRecord) => ({
                ...snapshotRecord.input,
                fingerprint: snapshotRecord.compiled.fingerprint,
                activatedAt: snapshotRecord.activatedAt,
              })),
            },
            200,
            requestId,
            snapshot.fingerprint,
          ),
        );
      }

      const definitionSnapshotMatch = matchPath(
        `${managementBase}/definition-snapshots/{snapshotId}`,
        url.pathname,
      );
      if (definitionSnapshotMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.readDefinitionCatalog.pipe(
            Effect.flatMap((state) => {
              const snapshotRecord = state.snapshots.find(
                (candidate) =>
                  candidate.compiled.snapshotId === definitionSnapshotMatch["snapshotId"]!,
              );
              return snapshotRecord === undefined
                ? Effect.fail(
                    new NotFound({
                      message: `Definition Snapshot ${definitionSnapshotMatch["snapshotId"]!} was not found`,
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
          (value) => jsonResponse(value, 200, requestId, snapshot.fingerprint),
        );
      }

      if (
        url.pathname === `${managementBase}/definition-snapshot-activations` &&
        request.method === "POST"
      ) {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength),
            targetSnapshot = body["snapshot"],
            { expectedCatalogVersion } = body,
            migrationPreparationId = body["migrationPreparationId"];
          if (
            targetSnapshot === null ||
            Array.isArray(targetSnapshot) ||
            typeof targetSnapshot !== "object" ||
            !Number.isSafeInteger(expectedCatalogVersion)
          ) {
            throw new InvalidInput({
              message: "Definition activation requires snapshot and expectedCatalogVersion",
            });
          }
          const activation =
            typeof migrationPreparationId !== "string"
              ? cms.activateDefinitionSnapshot({
                  expectedCatalogVersion: expectedCatalogVersion as number,
                  snapshot: targetSnapshot as never,
                  source: "management-http",
                })
              : cms.readDefinitionCatalog.pipe(
                  Effect.flatMap((state) => {
                    const preparation = state.migrationPreparations.find(
                      (candidate) => candidate.id === migrationPreparationId,
                    );
                    return preparation === undefined
                      ? Effect.fail(
                          new NotFound({
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
                );
          return await withOutcome(activation, requestId, (result) =>
            jsonResponse(
              {
                catalogVersion: result.catalogVersion,
                fingerprint: result.snapshot.fingerprint,
                migratedEntryCount: result.migratedEntryCount,
                snapshotId: result.snapshot.snapshotId,
              },
              201,
              requestId,
              result.snapshot.fingerprint,
            ),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Definition activation request", requestId);
        }
      }

      if (url.pathname === `${managementBase}/catalog-events` && request.method === "GET") {
        return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
          jsonResponse(
            { catalogVersion: state.version, items: state.events },
            200,
            requestId,
            snapshot.fingerprint,
          ),
        );
      }
      if (url.pathname === `${managementBase}/migration-manifests`) {
        if (request.method === "GET") {
          return withOutcome(cms.readDefinitionCatalog, requestId, (state) =>
            jsonResponse(
              { catalogVersion: state.version, items: state.migrationManifests },
              200,
              requestId,
              snapshot.fingerprint,
            ),
          );
        }
        if (request.method === "POST") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              manifest = body["manifest"],
              expectedCatalogVersion = body["expectedCatalogVersion"];
            if (
              manifest === null ||
              Array.isArray(manifest) ||
              typeof manifest !== "object" ||
              !Number.isSafeInteger(expectedCatalogVersion)
            ) {
              throw new InvalidInput({
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
                jsonResponse(
                  { catalogVersion: state.version },
                  201,
                  requestId,
                  snapshot.fingerprint,
                ),
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
        url.pathname,
      );
      if (migrationManifestMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.readDefinitionCatalog.pipe(
            Effect.flatMap((state) => {
              const manifest = state.migrationManifests.find(
                (candidate) => candidate.id === migrationManifestMatch["migrationManifestId"]!,
              );
              return manifest === undefined
                ? Effect.fail(new NotFound({ message: "Migration Manifest was not found" }))
                : Effect.succeed(manifest);
            }),
          ),
          requestId,
          (value) => jsonResponse(value, 200, requestId, snapshot.fingerprint),
        );
      }
      const migrationPreparationMatch = matchPath(
        `${managementBase}/migration-preparations/{migrationPreparationId}`,
        url.pathname,
      );
      if (migrationPreparationMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.readDefinitionCatalog.pipe(
            Effect.flatMap((state) => {
              const preparation = state.migrationPreparations.find(
                (candidate) =>
                  candidate.id === migrationPreparationMatch["migrationPreparationId"]!,
              );
              return preparation === undefined
                ? Effect.fail(new NotFound({ message: "Migration Preparation was not found" }))
                : Effect.succeed(preparation);
            }),
          ),
          requestId,
          (value) => jsonResponse(value, 200, requestId, snapshot.fingerprint),
        );
      }
      if (
        url.pathname === `${managementBase}/migration-preparations` &&
        request.method === "POST"
      ) {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength),
            manifestId = body["manifestId"],
            targetSnapshot = body["snapshot"],
            expectedCatalogVersion = body["expectedCatalogVersion"];
          if (
            typeof manifestId !== "string" ||
            targetSnapshot === null ||
            Array.isArray(targetSnapshot) ||
            typeof targetSnapshot !== "object" ||
            !Number.isSafeInteger(expectedCatalogVersion)
          ) {
            throw new InvalidInput({
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
            (preparation) => jsonResponse(preparation, 200, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Migration Preparation request", requestId);
        }
      }

      const createMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries`,
        url.pathname,
      );
      if (createMatch !== undefined && request.method === "POST") {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength),
            { values } = body;
          if (values === null || Array.isArray(values) || typeof values !== "object") {
            throw new InvalidInput({ message: "Entry create requires values" });
          }
          return await withOutcome(
            cms.createEntry({
              contentTypeId: createMatch["contentTypeId"]!,
              values: values as JsonObject,
            }),
            requestId,
            (result) => jsonResponse(result, 201, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Entry create request", requestId);
        }
      }

      const queryMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/query`,
        url.pathname,
      );
      if (queryMatch !== undefined && request.method === "POST") {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength);
          return await withOutcome(
            cms.queryEntries({ ...body, contentTypeId: queryMatch["contentTypeId"]! } as never),
            requestId,
            (result) => jsonResponse(result, 200, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Entry Query request", requestId);
        }
      }

      const readMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/read`,
        url.pathname,
      );
      if (readMatch !== undefined && request.method === "POST") {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength),
            { projection } = body;
          const { expansion } = body;
          if (
            projection !== undefined &&
            (!Array.isArray(projection) || !projection.every((path) => typeof path === "string"))
          ) {
            throw new InvalidInput({ message: "Projection must be an array of Field Paths" });
          }
          if (
            expansion !== undefined &&
            (!Array.isArray(expansion) || !expansion.every((path) => typeof path === "string"))
          ) {
            throw new InvalidInput({ message: "Expansion must be an array of Relationship paths" });
          }
          return await withOutcome(
            cms.getEntry({
              contentTypeId: readMatch["contentTypeId"]!,
              entryId: readMatch["entryId"]!,
              expansion: expansion,
              projection: projection,
            }),
            requestId,
            (entry) => jsonResponse(entry, 200, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid structured Entry read request", requestId);
        }
      }

      const entryMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}`,
        url.pathname,
      );
      if (entryMatch !== undefined) {
        const contentTypeId = entryMatch["contentTypeId"]!,
          entryId = entryMatch["entryId"]!;
        if (request.method === "GET") {
          return withOutcome(cms.getEntry({ contentTypeId, entryId }), requestId, (entry) =>
            jsonResponse(entry, 200, requestId, snapshot.fingerprint),
          );
        }
        if (request.method === "PUT") {
          try {
            const body = await parseJson(request, maximumJsonBodyByteLength),
              { values } = body;
            if (values === null || Array.isArray(values) || typeof values !== "object") {
              throw new InvalidInput({ message: "Entry replacement requires values" });
            }
            return await withOutcome(
              cms.updateEntry({
                contentTypeId,
                entryId,
                values: values as JsonObject,
                writeToken: request.headers.get("cms-write-token") ?? undefined,
              }),
              requestId,
              (result) => jsonResponse(result, 200, requestId, snapshot.fingerprint),
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
            () => bodylessResponse(204, requestId, snapshot.fingerprint),
          );
        }
        return jsonResponse(
          { code: "MethodNotAllowed", message: "Method not allowed", requestId },
          405,
          requestId,
        );
      }

      const stateMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/state`,
        url.pathname,
      );
      if (stateMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.getCurrentEntryState({
            contentTypeId: stateMatch["contentTypeId"]!,
            entryId: stateMatch["entryId"]!,
          }),
          requestId,
          (state) => jsonResponse(state, 200, requestId, snapshot.fingerprint),
        );
      }

      const revisionsMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/revisions`,
        url.pathname,
      );
      if (revisionsMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.listEntryRevisions({
            contentTypeId: revisionsMatch["contentTypeId"]!,
            cursor: url.searchParams.get("cursor") ?? undefined,
            entryId: revisionsMatch["entryId"]!,
            pageSize: Number(url.searchParams.get("pageSize") ?? "20"),
          }),
          requestId,
          (page) => jsonResponse(page, 200, requestId, snapshot.fingerprint),
        );
      }

      const revisionMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/revisions/{revisionNumber}`,
        url.pathname,
      );
      if (revisionMatch !== undefined && request.method === "GET") {
        return withOutcome(
          cms.inspectEntryRevision({
            contentTypeId: revisionMatch["contentTypeId"]!,
            entryId: revisionMatch["entryId"]!,
            revisionNumber: Number(revisionMatch["revisionNumber"]!),
          }),
          requestId,
          (revision) => jsonResponse(revision, 200, requestId, snapshot.fingerprint),
        );
      }

      const restorationMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/restorations`,
        url.pathname,
      );
      if (restorationMatch !== undefined && request.method === "POST") {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength);
          if (
            !Number.isSafeInteger(body["revisionNumber"]) ||
            typeof body["writeToken"] !== "string"
          ) {
            throw new InvalidInput({
              message: "Entry restoration requires revisionNumber and writeToken",
            });
          }
          return await withOutcome(
            cms.restoreEntryRevision({
              contentTypeId: restorationMatch["contentTypeId"]!,
              entryId: restorationMatch["entryId"]!,
              revisionNumber: body["revisionNumber"] as number,
              writeToken: body["writeToken"],
            }),
            requestId,
            (state) => jsonResponse(state, 201, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Entry restoration request", requestId);
        }
      }

      const purgeMatch = matchPath(
        `${managementBase}/content-types/{contentTypeId}/entries/{entryId}/purges`,
        url.pathname,
      );
      if (purgeMatch !== undefined && request.method === "POST") {
        try {
          const body = await parseJson(request, maximumJsonBodyByteLength);
          if (typeof body["writeToken"] !== "string") {
            throw new InvalidInput({ message: "Permanent Purge requires writeToken" });
          }
          return await withOutcome(
            cms.permanentlyPurgeEntry({
              contentTypeId: purgeMatch["contentTypeId"]!,
              entryId: purgeMatch["entryId"]!,
              writeToken: body["writeToken"],
            }),
            requestId,
            () => bodylessResponse(204, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid Permanent Purge request", requestId);
        }
      }

      const assetMatch = matchPath(`${managementBase}/assets/{assetId}`, url.pathname);
      if (assetMatch !== undefined) {
        const assetId = assetMatch["assetId"]!;
        if (request.method === "GET") {
          return withOutcome(cms.getAsset(assetId), requestId, (asset) =>
            jsonResponse(asset, 200, requestId, snapshot.fingerprint),
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
        url.pathname,
      );
      if (
        assetContentMatch !== undefined &&
        (request.method === "GET" || request.method === "HEAD")
      ) {
        return withOutcome(cms.readAsset(assetContentMatch["assetId"]!), requestId, (asset) =>
          assetContentResponse(asset, request, requestId),
        );
      }

      if (url.pathname === `${managementBase}/assets` && request.method === "POST") {
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
          const form = await request.formData();
          if (
            [...form.keys()].some((key) => key !== "metadata" && key !== "content") ||
            form.getAll("metadata").length !== 1 ||
            form.getAll("content").length !== 1
          ) {
            throw new InvalidInput({
              message: "Asset upload requires exactly metadata and content parts",
            });
          }
          const metadataPart = form.get("metadata"),
            contentPart = form.get("content");
          if (typeof metadataPart !== "string" || !(contentPart instanceof File)) {
            throw new InvalidInput({ message: "Asset upload parts have invalid media" });
          }
          const metadata = JSON.parse(metadataPart) as Omit<IngestInput, "content">;
          return await withOutcome(
            cms.ingestAsset({
              ...metadata,
              content: new Uint8Array(await contentPart.arrayBuffer()),
            }),
            requestId,
            (asset) => jsonResponse(asset, 201, requestId, snapshot.fingerprint),
          );
        } catch (error) {
          return invalidRequestResponse(error, "Invalid multipart Asset upload", requestId);
        }
      }

      for (const managementOperation of managementOperations) {
        const parameters = matchPath(`${managementBase}${managementOperation.path}`, url.pathname);
        if (parameters === undefined) {
          continue;
        }
        if (request.method !== managementOperation.method) {
          return jsonResponse(
            { code: "MethodNotAllowed", message: "Method not allowed", requestId },
            405,
            requestId,
          );
        }
        return withOutcome(
          managementOperation.execute({ cms, parameters, request, requestId, snapshot }),
          requestId,
          (value) =>
            value instanceof Response
              ? value
              : value === undefined
                ? bodylessResponse(204, requestId, snapshot.fingerprint)
                : jsonResponse(value, 200, requestId, snapshot.fingerprint),
        );
      }

      for (const matcher of operationMatchers) {
        const match = matcher.expression.exec(url.pathname);
        if (match === null) {
          continue;
        }
        if (request.method !== matcher.operation.method) {
          continue;
        }
        if (
          request.method === "POST" &&
          !(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")
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
          matcher.operation.requiresIdempotencyKey &&
          !request.headers.get("idempotency-key")?.length
        ) {
          return errorResponse(
            new InvalidInput({ message: "Idempotency-Key is required" }),
            requestId,
          );
        }
        const parameters = Object.fromEntries(
          matcher.names.map((name, index) => [name, decodeURIComponent(match[index + 1] ?? "")]),
        );
        return withOutcome(
          matcher.operation.execute({ cms, parameters, request, requestId, snapshot }),
          requestId,
          (value) =>
            value instanceof Response
              ? value
              : value === undefined
                ? bodylessResponse(204, requestId, snapshot.fingerprint)
                : jsonResponse(
                    value,
                    matcher.operation.successStatus ?? 200,
                    requestId,
                    snapshot.fingerprint,
                    matcher.operation.cacheControl ?? "no-cache",
                  ),
        );
      }

      if (operationMatchers.some((matcher) => matcher.expression.test(url.pathname))) {
        return jsonResponse(
          { code: "MethodNotAllowed", message: "Method not allowed", requestId },
          405,
          requestId,
        );
      }

      return jsonResponse(
        { code: "NotFound", message: "Route not found", requestId },
        404,
        requestId,
      );
    };

    return async (request): Promise<Response> => {
      const requestId = requestIdentifier(),
        controller = new AbortController(),
        onClientAbort = (): void => controller.abort(request.signal.reason),
        timeout = setTimeout(
          () => controller.abort(new Error("request timeout")),
          requestTimeoutMilliseconds,
        );
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
              () =>
                resolve(
                  requestFailureResponse(
                    new RequestFailure(
                      "RequestTimeout",
                      "The request was interrupted or exceeded its configured duration",
                      408,
                    ),
                    requestId,
                  ),
                ),
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
