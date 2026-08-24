import type { ServiceShape as CmsService } from "../cms.ts";
import type { CmsError } from "../cms-error.ts";
import type { CompiledSnapshot } from "../content-definition.ts";
import type { JsonValue } from "../internal/json.ts";
import type { Effect } from "effect";

export const managementPrefix = "/api/v1/management";
export const headlessPrefix = "/api/v1/headless";
export const apiContractVersion = 1;

export interface ErrorDocument {
  readonly code: string;
  readonly message: string;
  readonly requestId: string;
  readonly details?: JsonValue;
}

export interface OperationContext {
  readonly request: Request;
  readonly parameters: Readonly<Record<string, string>>;
  readonly cms: CmsService;
  readonly snapshot: CompiledSnapshot;
  readonly requestId: string;
}

export interface DeliveryOperation {
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: `/${string}`;
  readonly reachableContentTypeIds: readonly string[];
  readonly requiresIdempotencyKey?: boolean;
  readonly cacheControl?: string;
  readonly successStatus?: 200 | 201;
  readonly execute: (context: OperationContext) => Effect.Effect<unknown, CmsError>;
}

export interface ManagementOperation {
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: `/${string}`;
  readonly execute: (context: OperationContext) => Effect.Effect<unknown, CmsError>;
}

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
