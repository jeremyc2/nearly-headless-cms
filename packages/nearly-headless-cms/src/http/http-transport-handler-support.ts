import {
  type DeliveryOperation,
  type ManagementOperation,
  headlessPrefix,
  managementPrefix,
} from "./http-contract.ts";
import type { Options, RouteHandlerContext } from "./http-transport-types.ts";
import {
  type ReadonlyTransportAbortSignal,
  type ReadonlyTransportHandlerRequest,
  type ReadonlyTransportRequest,
  type ReadonlyTransportUrl,
} from "./http-transport-readonly-types.ts";
import {
  defaultMaximumHeaderByteLength,
  defaultMaximumJsonBodyByteLength,
  defaultMaximumMultipartBodyByteLength,
  defaultMaximumMultipartFileByteLength,
  defaultMaximumMultipartMetadataByteLength,
  defaultMaximumUrlLength,
  defaultRequestTimeoutMilliseconds,
} from "./http-status-codes.ts";
import type { CmsError } from "../cms-error.ts";
import type { ServiceShape as CmsServiceShape } from "../cms.ts";
import type { CompiledSnapshot } from "../content-definition.ts";
import type { Effect } from "effect";
import transportOperation from "./http-transport-operation.ts";
import transportRequestParsing from "./http-transport-request-parsing.ts";
import transportResponse from "./http-transport-response.ts";

interface HandlerBodyLimits {
  readonly maximumJsonBodyByteLength: number;
  readonly maximumMultipartBodyByteLength: number;
  readonly maximumMultipartFileByteLength: number;
  readonly maximumMultipartMetadataByteLength: number;
}

interface ResolvedHandlerOptions {
  readonly deliveryOperations: readonly DeliveryOperation[];
  readonly limits: HandlerBodyLimits;
  readonly managementOperations: readonly ManagementOperation[];
  readonly maximumHeaderByteLength: number;
  readonly maximumUrlLength: number;
  readonly operationMatchers: readonly {
    readonly expression: RegExp;
    readonly names: readonly string[];
    readonly operation: DeliveryOperation;
  }[];
  readonly requestIdentifier: () => string;
  readonly requestTimeoutMilliseconds: number;
}

interface ResolveActiveSnapshotInput {
  readonly cms: Readonly<CmsServiceShape>;
  readonly request: ReadonlyTransportRequest;
  readonly requestId: string;
  readonly signal: ReadonlyTransportAbortSignal;
}

interface BuildRouteContextInput {
  readonly cms: Readonly<CmsServiceShape>;
  readonly limits: Readonly<HandlerBodyLimits>;
  readonly request: ReadonlyTransportHandlerRequest;
  readonly requestId: string;
  readonly requestUrl: ReadonlyTransportUrl;
  readonly signal: ReadonlyTransportAbortSignal;
  readonly snapshot: Readonly<CompiledSnapshot>;
}

interface EnsureSnapshotFingerprintInput {
  readonly request: ReadonlyTransportRequest;
  readonly requestId: string;
  readonly signal: ReadonlyTransportAbortSignal;
  readonly snapshot: Readonly<CompiledSnapshot>;
}

interface ReadInterruptibleValueInput<Value> {
  readonly effect: Effect.Effect<Value, CmsError>;
  readonly missingValueMessage: string;
  readonly operationFailureMessage: string;
  readonly requestId: string;
  readonly signal: ReadonlyTransportAbortSignal;
}

const { errorResponse, respondWithOutcome, runOperationInterruptibly } = transportResponse,
  { compilePath, ensureFingerprint } = transportOperation,
  { parseJson } = transportRequestParsing,
  buildRouteContext = <Input extends BuildRouteContextInput>(
    input: Readonly<Input>,
  ): RouteHandlerContext => {
    const { cms, limits, request, requestId, requestUrl, signal, snapshot } = input;
    return {
      cms,
      fingerprint: snapshot.fingerprint,
      managementBase: `${managementPrefix}/definition-spaces/${encodeURIComponent(snapshot.definitionSpaceId)}`,
      maximumJsonBodyByteLength: limits.maximumJsonBodyByteLength,
      maximumMultipartBodyByteLength: limits.maximumMultipartBodyByteLength,
      maximumMultipartFileByteLength: limits.maximumMultipartFileByteLength,
      maximumMultipartMetadataByteLength: limits.maximumMultipartMetadataByteLength,
      parseJson,
      request,
      requestId,
      requestUrl,
      signal,
      snapshot,
      withOutcome: <Value>(
        effect: (_void: void) => Effect.Effect<Value, CmsError>,
        operationRequestId: string,
        success: (value: Readonly<Value>) => Response,
      ): Promise<Response> =>
        respondWithOutcome({ effect, requestId: operationRequestId, signal, success }),
    };
  },
  compileOperationMatcher = <Operation extends DeliveryOperation>(operation: Operation) => {
    const compiled = compilePath(`${headlessPrefix}${operation.path}`);
    return { expression: compiled.expression, names: compiled.names, operation };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- fingerprint validation awaits interruptible Effect execution.
  ensureSnapshotFingerprint = async <Input extends EnsureSnapshotFingerprintInput>(
    input: Readonly<Input>,
  ): Promise<Response | undefined> => {
    const { request, requestId, signal, snapshot } = input,
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
    return undefined;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- interruptible outcomes are awaited before routing continues.
  readInterruptibleValue = async <Value, Input extends ReadInterruptibleValueInput<Value>>({
    effect,
    missingValueMessage,
    operationFailureMessage,
    requestId,
    signal,
  }: Readonly<Input>): Promise<Value | Response> => {
    const outcome = await runOperationInterruptibly(effect, signal);
    if (!outcome.success) {
      if (outcome.error === undefined) {
        throw new Error(operationFailureMessage);
      }
      return errorResponse(outcome.error, requestId);
    }
    if (outcome.value === undefined) {
      throw new Error(missingValueMessage);
    }
    return outcome.value;
  },
  // oxlint-disable-next-line effecttsgo/async-function -- snapshot resolution awaits interruptible Effect execution before routing.
  resolveActiveSnapshot = async <Input extends ResolveActiveSnapshotInput>(
    input: Readonly<Input>,
  ): Promise<CompiledSnapshot | Response> => {
    const { cms, request, requestId, signal } = input,
      snapshotResult = await readInterruptibleValue({
        effect: cms.activeDefinitionSnapshot(),
        missingValueMessage: "Operation succeeded without a value",
        operationFailureMessage: "Operation failed without an error",
        requestId,
        signal,
      });
    if (snapshotResult instanceof Response) {
      return snapshotResult;
    }
    return (
      (await ensureSnapshotFingerprint({
        request,
        requestId,
        signal,
        snapshot: snapshotResult,
      })) ?? snapshotResult
    );
  },
  resolveHandlerOptions = <OptionsType extends Options>(
    options: Readonly<OptionsType>,
  ): ResolvedHandlerOptions => {
    const deliveryOperations = options.deliveryOperations ?? [],
      managementOperations = options.managementOperations ?? [];
    return {
      deliveryOperations,
      limits: {
        maximumJsonBodyByteLength:
          options.maximumJsonBodyByteLength ?? defaultMaximumJsonBodyByteLength,
        maximumMultipartBodyByteLength:
          options.maximumMultipartBodyByteLength ?? defaultMaximumMultipartBodyByteLength,
        maximumMultipartFileByteLength:
          options.maximumMultipartFileByteLength ?? defaultMaximumMultipartFileByteLength,
        maximumMultipartMetadataByteLength:
          options.maximumMultipartMetadataByteLength ?? defaultMaximumMultipartMetadataByteLength,
      },
      managementOperations,
      maximumHeaderByteLength: options.maximumHeaderByteLength ?? defaultMaximumHeaderByteLength,
      maximumUrlLength: options.maximumUrlLength ?? defaultMaximumUrlLength,
      operationMatchers: deliveryOperations.map((operation) => compileOperationMatcher(operation)),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- default request IDs are generated synchronously before Effect execution.
      requestIdentifier: options.requestIdentifier ?? (() => crypto.randomUUID()),
      requestTimeoutMilliseconds:
        options.requestTimeoutMilliseconds ?? defaultRequestTimeoutMilliseconds,
    };
  };

export type { CompiledSnapshot } from "../content-definition.ts";

export default {
  buildRouteContext,
  resolveActiveSnapshot,
  resolveHandlerOptions,
};

export type { HandlerBodyLimits, ResolvedHandlerOptions };
