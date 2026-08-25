import { type CmsError, DefinitionSnapshotChanged, InvalidInput } from "../cms-error.ts";
import type { DeliveryOperation, ManagementOperation, OperationSchema } from "./http-contract.ts";
import { Effect, Schema } from "effect";
import type { ReadonlyTransportRequest } from "./http-transport-readonly-types.ts";

const compilePath = (
    path: string,
  ): { readonly expression: RegExp; readonly names: readonly string[] } => {
    const names: string[] = [],
      pattern = path
        .split("/")
        .map((segment) => {
          const match = /^\{(?<parameterName>[^}]+)\}$/u.exec(segment),
            parameterName = match?.groups?.["parameterName"];
          if (parameterName !== undefined) {
            names.push(parameterName);
            return "([^/]+)";
          }
          return segment.replaceAll(/[.*+?^${}()|[\]\\]/gu, String.raw`\$&`);
        })
        .join("/");
    return { expression: new RegExp(`^${pattern}$`, "u"), names };
  },
  ensureFingerprint = (
    request: ReadonlyTransportRequest,
    fingerprint: string,
  ): Effect.Effect<void, DefinitionSnapshotChanged> => {
    const expected = request.headers.get("cms-expected-definition-fingerprint");
    if (expected !== null && expected !== fingerprint) {
      return Effect.fail(
        DefinitionSnapshotChanged.make({ message: "The active Definition Snapshot changed" }),
      );
    }
    return Effect.void;
  },
  executeOperation = <Operation extends DeliveryOperation | ManagementOperation>(
    operation: Readonly<Operation>,
    context: Readonly<Parameters<DeliveryOperation["execute"]>[0]>,
  ): Effect.Effect<unknown, CmsError> =>
    validateOperationRequest(operation, context.request, context.parameters).pipe(
      Effect.andThen(operation.execute(context)),
      Effect.flatMap((value) => {
        if (value instanceof Response || value === undefined) {
          return Effect.succeed(value);
        }
        return validateSchema(
          operation.schemas.response,
          value,
          `Response body for ${operation.identifier} violated its declared schema`,
        ).pipe(Effect.as(value));
      }),
    ),
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
  requiredPathParameter = (
    parameters: Readonly<Record<string, string | undefined>>,
    name: string,
  ): string => {
    const value = parameters[name];
    if (value === undefined) {
      throw new Error(`Missing path parameter: ${name}`);
    }
    return value;
  },
  validateOperationRequest = <Operation extends DeliveryOperation | ManagementOperation>(
    operation: Readonly<Operation>,
    request: ReadonlyTransportRequest,
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
        const body: unknown = yield* Effect.tryPromise({
          catch: () => InvalidInput.make({ message: "JSON request body is malformed" }),
          try: (): Promise<unknown> => request.clone().json(),
        });
        yield* validateSchema(
          operation.schemas.requestBody,
          body,
          `Request body for ${operation.identifier} is invalid`,
        );
      }
    }),
  validateSchema = <SchemaType extends OperationSchema>(
    schema: Readonly<SchemaType>,
    value: unknown,
    message: string,
  ): Effect.Effect<void, InvalidInput> =>
    Schema.decodeUnknownEffect(schema)(value).pipe(
      Effect.asVoid,
      Effect.mapError(() => InvalidInput.make({ message })),
    );

export default {
  compilePath,
  ensureFingerprint,
  executeOperation,
  matchPath,
  requiredPathParameter,
};
