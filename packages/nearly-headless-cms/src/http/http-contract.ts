import type { ServiceShape as CmsService } from "../cms.ts";
import type { CmsError } from "../cms-error.ts";
import type { CompiledSnapshot } from "../content-definition.ts";
import type { JsonValue } from "../internal/json.ts";
import type { Effect } from "effect";
import type { Schema } from "effect";
import type { DefinitionRequirement } from "../operation.ts";

/** Stable major-version URL prefix for the complete Management API. */
export const managementPrefix = "/api/v1/management";
/** Stable major-version URL prefix for Builder-selected Headless operations. */
export const headlessPrefix = "/api/v1/headless";
/** Current major API Contract Version, independent of Definition versions. */
export const apiContractVersion = 1;

/** Safe tagged JSON failure representation returned by HTTP endpoints. */
export interface ErrorDocument {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: JsonValue;
}

/** Request, CMS service, active snapshot, and parameters supplied to an operation. */
export interface OperationContext {
  readonly request: Request;
  readonly parameters: Readonly<Record<string, string>>;
  readonly cms: CmsService;
  readonly snapshot: CompiledSnapshot;
  readonly requestId: string;
}

/** Effect Schemas used for runtime decoding and OpenAPI generation. */
/** Effect Schema codec accepted at a transport operation boundary. */
export type OperationSchema = Schema.Codec<unknown, unknown, never, never>;

/** Request, parameter, header, response, and media schemas for one HTTP operation. */
export interface OperationSchemas {
  readonly request: OperationSchema;
  readonly response: OperationSchema;
  readonly requestBody?: OperationSchema;
  readonly pathParameters?: Readonly<Record<string, OperationSchema>>;
  readonly queryParameters?: Readonly<Record<string, OperationSchema>>;
  readonly requestHeaders?: Readonly<Record<string, OperationSchema>>;
  readonly responseMediaType?: string;
}

/** A fixed composition-time Headless Delivery Query or Command declaration. */
export interface DeliveryOperation {
  readonly definitionRequirements: readonly DefinitionRequirement[];
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: `/${string}`;
  readonly reachableContentTypeIds: readonly string[];
  readonly requiresIdempotencyKey?: boolean;
  readonly cacheControl?: string;
  readonly schemas: OperationSchemas;
  readonly successStatus?: 200 | 201;
  readonly execute: (context: OperationContext) => Effect.Effect<unknown, CmsError>;
}

/** A fixed composition-time Builder-specific Management operation declaration. */
export interface ManagementOperation {
  readonly definitionRequirements: readonly DefinitionRequirement[];
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: `/${string}`;
  readonly schemas: OperationSchemas;
  readonly execute: (context: OperationContext) => Effect.Effect<unknown, CmsError>;
}

/** Public runtime Definition and operation capabilities advertised to Content Clients. */
export interface DiscoveryDocument {
  readonly apiContractVersion: number;
  readonly definitionSnapshotId: string;
  readonly definitionFingerprint: string;
  readonly definitionFormatVersion: number;
  readonly compilerFormatVersion: number;
  readonly definitions: CompiledSnapshot["input"]["definitions"];
  readonly fieldKinds: readonly { readonly identifier: string; readonly version: number }[];
  readonly richText: {
    readonly format: string;
    readonly version: number;
    readonly extensions: readonly string[];
  };
  readonly operations: readonly {
    readonly identifier: string;
    readonly method: string;
    readonly path: string;
    readonly reachableContentTypeIds: ReadonlyArray<string>;
    readonly requiresIdempotencyKey: boolean;
  }[];
  readonly assetDeliveryUrlTemplate?: string;
  readonly openApiUrl: string;
}

/** Derives public discovery without executable schemas or unreachable definitions. */
export const discovery = (
  snapshot: CompiledSnapshot,
  operations: readonly DeliveryOperation[],
): DiscoveryDocument => ({
  apiContractVersion,
  definitionSnapshotId: snapshot.snapshotId,
  definitionFingerprint: snapshot.fingerprint,
  definitionFormatVersion: 1,
  compilerFormatVersion: snapshot.compilerFormatVersion,
  definitions: snapshot.input.definitions.filter((definition) =>
    operations.some((operation) => operation.reachableContentTypeIds.includes(definition.id)),
  ),
  fieldKinds: [
    "text",
    "integer",
    "number",
    "boolean",
    "date",
    "datetime",
    "url",
    "email",
    "enum",
    "json",
    "asset",
    "relationship",
    "rich-text",
    "list",
  ].map((identifier) => ({ identifier, version: 1 })),
  richText: { extensions: [], format: "nearly-headless-cms/rich-text", version: 1 },
  operations: operations.map((operation) => ({
    identifier: operation.identifier,
    method: operation.method,
    path: operation.path,
    reachableContentTypeIds: operation.reachableContentTypeIds,
    requiresIdempotencyKey: operation.requiresIdempotencyKey ?? false,
  })),
  ...(operations.some((operation) => operation.path === "/assets/{assetId}")
    ? { assetDeliveryUrlTemplate: `${headlessPrefix}/assets/{assetId}` }
    : {}),
  openApiUrl: `${headlessPrefix}/openapi.json`,
});
