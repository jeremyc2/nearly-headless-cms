import type { ConsistentReadSnapshot } from "../../cms.ts";
import { ExportTooLarge, type CmsError } from "../../cms-error.ts";
import type { JsonObject, JsonValue } from "../../content-definition-types.ts";
import { Effect, Schema } from "effect";
import type { DeliveryOperation, OperationSchema } from "../http-contract.ts";
import type { DefinitionRequirement } from "../../operation.ts";
import { readDeliverySchemas } from "./delivery-query.ts";
import { type PublicEntryValueOptions, publicEntryValue } from "./public-entry-value.ts";

/** Maximum Public Content Export size accepted by default builders. */
export const defaultMaximumPublicExportBytes = 5_000_000;

/** Input for assembling one Public Content Export artifact. */
export interface PublicExportArtifactInput {
  readonly assets: readonly ConsistentReadSnapshot["assets"][number][];
  readonly content: Readonly<Record<string, readonly ConsistentReadSnapshot["entries"][number][]>>;
  readonly definitionFingerprint: string;
  readonly generatedAt: string;
  readonly publicEntryValueOptions?: PublicEntryValueOptions;
}

/** Options for declaring one Public Content Export Delivery Query. */
export interface PublicExportDeliveryQueryOptions {
  readonly buildArtifact: (
    consistentSnapshot: ConsistentReadSnapshot,
  ) => Effect.Effect<JsonObject, CmsError>;
  readonly definitionRequirements: readonly DefinitionRequirement[];
  readonly identifier?: string;
  readonly maximumBytes?: number;
  readonly path?: `/${string}`;
  readonly reachableContentTypeIds: readonly string[];
  readonly request: OperationSchema;
  readonly response: OperationSchema;
}

// oxlint-disable-next-line eslint/one-var -- [EH-309] digest helpers stay grouped in one local const block below exported defaults.
const hexDigitWidth = 2,
  sha256Radix = 16,
  encodeExportArtifact = (artifact: Readonly<JsonObject>): Effect.Effect<Uint8Array> =>
    Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(artifact).pipe(
      Effect.map((json) => new TextEncoder().encode(json)),
      Effect.orDie,
    ),
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-313] SHA-256 digest accepts mutable byte buffers from TextEncoder output.
  sha256HexDigest = (bytes: Uint8Array): Effect.Effect<string> =>
    Effect.tryPromise({
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-312] Web Crypto digest failures are converted to defects via orDie at call sites.
      catch: () => undefined as never,
      try: () =>
        crypto.subtle.digest("SHA-256", new Uint8Array(bytes)).then((digestBuffer) =>
          [...new Uint8Array(digestBuffer)]
            .map((byte) => byte.toString(sha256Radix).padStart(hexDigitWidth, "0"))
            .join(""),
        ),
    }),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-296] Public Content Export assembly is intentionally a pure snapshot helper.
  publicExportArtifact = ({
    assets,
    content,
    definitionFingerprint,
    generatedAt,
    publicEntryValueOptions,
  }: Readonly<PublicExportArtifactInput>): JsonObject => {
    const artifact: Record<string, JsonValue> = {
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-311] Asset metadata is encoded as JSON without retaining class instances.
      assets: assets as unknown as JsonValue,
      definitionFingerprint,
      generatedAt,
    };
    for (const [collectionName, entries] of Object.entries(content)) {
      artifact[collectionName] = entries.map((entry) =>
        publicEntryValue(entry, publicEntryValueOptions),
      );
    }
    return artifact;
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-297] Public Content Export route declaration is intentionally a direct HTTP contract helper.
  publicExportDeliveryQuery = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-303] Delivery Query builders accept Effect Schema classes that are not deeply readonly.
    options: Readonly<PublicExportDeliveryQueryOptions>,
  ): DeliveryOperation => ({
    cacheControl: "no-cache",
    definitionRequirements: options.definitionRequirements,
    execute: ({ cms, request, requestId, snapshot }) =>
      Effect.gen(function* exportPublicContent() {
        const artifact = yield* options.buildArtifact(yield* cms.readConsistentSnapshot()),
          bytes = yield* encodeExportArtifact(artifact),
          maximumBytes = options.maximumBytes ?? defaultMaximumPublicExportBytes;
        if (bytes.byteLength > maximumBytes) {
          return yield* ExportTooLarge.make({
            message: `Public Content Export exceeds the configured ${maximumBytes}-byte bound`,
          });
        }
        // oxlint-disable-next-line eslint/one-var -- [EH-308] digest and response headers are derived after the size guard.
        const digest = yield* sha256HexDigest(bytes),
          etag = `"sha256-${digest}"`,
          headers = new Headers({
            "cache-control": "no-cache",
            "cms-definition-fingerprint": snapshot.fingerprint,
            "content-length": String(bytes.byteLength),
            "content-type": "application/json; charset=utf-8",
            etag,
            "x-request-id": requestId,
          });
        if (request.headers.get("if-none-match") === etag) {
          return new Response(null, { headers, status: 304 });
        }
        return new Response(new Uint8Array(bytes), { headers, status: 200 });
      }),
    identifier: options.identifier ?? "exportPublicContent",
    method: "GET",
    path: options.path ?? "/export",
    reachableContentTypeIds: options.reachableContentTypeIds,
    schemas: readDeliverySchemas({
      request: options.request,
      response: options.response,
    }),
  });

/** Assembles a Public Content Export artifact from grouped Entry collections. */
export { publicExportArtifact };

/** Declares one Public Content Export Delivery Query with bounded JSON encoding. */
export { publicExportDeliveryQuery };
