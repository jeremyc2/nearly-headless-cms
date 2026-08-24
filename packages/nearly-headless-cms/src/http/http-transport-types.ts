import type {
  DeliveryOperation,
  ManagementOperation,
} from "./http-contract.ts";
import type { CmsError } from "../cms-error.ts";
import type { ServiceShape as CmsService } from "../cms.ts";
import type { CompiledSnapshot } from "../content-definition.ts";
import type { Effect } from "effect";
import type { JsonObject } from "../internal/json.ts";

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

export interface JsonResponseInput {
  readonly cacheControl?: string;
  readonly fingerprint?: string;
  readonly requestId: string;
  readonly status: number;
  readonly value: unknown;
}

export type OperationOutcome<Value> =
  | { readonly error: CmsError; readonly success: false }
  | { readonly success: true; readonly value: Value };

export interface RespondWithOutcomeInput<Value> {
  readonly effect: Effect.Effect<Value, CmsError>;
  readonly requestId: string;
  readonly signal?: AbortSignal;
  readonly success: (value: Value) => Response;
}

export interface RouteHandlerContext {
  readonly cms: CmsService;
  readonly fingerprint: string;
  readonly managementBase: string;
  readonly maximumJsonBodyByteLength: number;
  readonly maximumMultipartBodyByteLength: number;
  readonly maximumMultipartFileByteLength: number;
  readonly maximumMultipartMetadataByteLength: number;
  readonly parseJson: (request: Request, maximumByteLength: number) => Promise<JsonObject>;
  readonly request: Request;
  readonly requestId: string;
  readonly requestUrl: URL;
  readonly signal: AbortSignal;
  readonly snapshot: CompiledSnapshot;
  readonly withOutcome: <Value>(
    effect: Effect.Effect<Value, CmsError>,
    operationRequestId: string,
    success: (value: Value) => Response,
  ) => Promise<Response>;
}

/** Result of a route handler: a response when matched, otherwise undefined to continue routing. */
export type RouteHandlerResult = Response | undefined;
