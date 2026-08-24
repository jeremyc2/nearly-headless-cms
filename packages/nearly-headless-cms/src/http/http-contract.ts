import type { Effect, Schema } from "effect";
import type { CmsError } from "../cms-error.ts";
import type { ServiceShape as CmsService } from "../cms.ts";
import type { CompiledSnapshot } from "../content-definition.ts";
import type { DefinitionRequirement } from "../operation.ts";
import type { JsonValue } from "../internal/json.ts";

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
export type OperationSchema = Schema.Codec<unknown, unknown>;

/** Request, parameter, header, response, and media schemas for one HTTP operation. */
export interface OperationSchemas {
  readonly request: OperationSchema;
  readonly response: OperationSchema;
  readonly requestBody?: OperationSchema;
  readonly pathParameters?: Readonly<Record<string, OperationSchema>>;
  readonly queryParameters?: Readonly<Record<string, OperationSchema>>;
  readonly requestHeaders?: Readonly<Record<string, OperationSchema>>;
  readonly requestMediaType?: string;
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
  readonly successStatus?: typeof successfulResponseStatus | typeof createdResponseStatus;
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
    readonly reachableContentTypeIds: readonly string[];
    readonly requiresIdempotencyKey: boolean;
  }[];
  readonly assetDeliveryUrlTemplate?: string;
  readonly openApiUrl: string;
}

export interface DiscoveryInput {
  readonly operations: readonly DeliveryOperation[];
  readonly snapshot: CompiledSnapshot;
}

const apiContractVersion = 1,
  createdResponseStatus = 201,
  definitionFormatVersion = 1,
  fieldKindVersion = 1,
  headlessPrefix = "/api/v1/headless",
  managementPrefix = "/api/v1/management",
  richTextFormatVersion = 1,
  successfulResponseStatus = 200,
  zDiscovery = ({ operations, snapshot }: DiscoveryInput): DiscoveryDocument => {
    const document: DiscoveryDocument = {
      apiContractVersion,
      compilerFormatVersion: snapshot.compilerFormatVersion,
      definitionFingerprint: snapshot.fingerprint,
      definitionFormatVersion,
      definitionSnapshotId: snapshot.snapshotId,
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
      ].map((identifier) => ({ identifier, version: fieldKindVersion })),
      openApiUrl: `${headlessPrefix}/openapi.json`,
      operations: operations.map((operation) => ({
        identifier: operation.identifier,
        method: operation.method,
        path: operation.path,
        reachableContentTypeIds: operation.reachableContentTypeIds,
        requiresIdempotencyKey: operation.requiresIdempotencyKey ?? false,
      })),
      richText: {
        extensions: [],
        format: "nearly-headless-cms/rich-text",
        version: richTextFormatVersion,
      },
    };
    if (operations.some((operation) => operation.path === "/assets/{assetId}")) {
      return {
        assetDeliveryUrlTemplate: `${headlessPrefix}/assets/{assetId}`,
        ...document,
      };
    }
    return document;
  };

/** Stable HTTP contract constants and public discovery derivation. */
export { apiContractVersion, headlessPrefix, managementPrefix, zDiscovery as discovery };
