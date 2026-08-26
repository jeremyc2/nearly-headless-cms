import * as ContractOpenApi from "./open-api.ts";
import type * as EffectSchema from "effect/Schema";
import type { DeliveryOperation, ManagementOperation } from "./http-contract.ts";
import {
  OpenApi as EffectOpenApi,
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  type HttpApiSchema,
} from "effect/unstable/httpapi";

type ContractEndpoint = HttpApiEndpoint.HttpApiEndpoint<
  string,
  "DELETE" | "GET" | "HEAD" | "POST" | "PUT",
  `/${string}`,
  never,
  never,
  never,
  never,
  EffectSchema.toCodecJson<typeof HttpApiSchema.NoContent>
>;
type ContractGroup<Identifier extends string> = HttpApiGroup.HttpApiGroup<
  Identifier,
  ContractEndpoint
>;
type ContractApi<Identifier extends string, GroupIdentifier extends string> = HttpApi.HttpApi<
  Identifier,
  ContractGroup<GroupIdentifier>
>;

const firstPathCharacterIndex = 0,
  minimumIdentifierLength = 1,
  operationRecord = (value: unknown): Record<string, unknown> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Every OpenAPI path operation must be an object");
    }
    return Object.fromEntries(Object.entries(value));
  },
  pathWithoutSlashIndex = 1,
  zEndpointFor = (method: string, identifier: string, path: `/${string}`): ContractEndpoint => {
    switch (method) {
      case "delete": {
        return HttpApiEndpoint.delete(identifier, path);
      }
      case "get": {
        return HttpApiEndpoint.get(identifier, path);
      }
      case "head": {
        return HttpApiEndpoint.head(identifier, path);
      }
      case "post": {
        return HttpApiEndpoint.post(identifier, path);
      }
      case "put": {
        return HttpApiEndpoint.put(identifier, path);
      }
      default: {
        throw new Error(`Unsupported HTTP method in the OpenAPI contract: ${method}`);
      }
    }
  },
  zEndpointPath = (openApiPath: string): `/${string}` => {
    if (!openApiPath.startsWith("/")) {
      throw new Error(`OpenAPI path must begin with a slash: ${openApiPath}`);
    }
    return `/${openApiPath
      .slice(pathWithoutSlashIndex)
      .replaceAll(/\{(?<parameterName>[^}]+)\}/gu, ":$<parameterName>")}`;
  },
  zEndpointsForPath = (
    openApiPath: string,
    pathItem: Readonly<Record<string, unknown>>,
  ): readonly ContractEndpoint[] => {
    const endpoints: ContractEndpoint[] = [];
    for (const [method, value] of Object.entries(pathItem)) {
      const operation = operationRecord(value),
        operationIdentifier = operation["operationId"];
      if (
        typeof operationIdentifier !== "string" ||
        operationIdentifier.length < minimumIdentifierLength
      ) {
        throw new Error(
          `OpenAPI operation ${method.toUpperCase()} ${openApiPath} needs an operationId`,
        );
      }
      endpoints.push(
        zEndpointFor(method, operationIdentifier, zEndpointPath(openApiPath)).annotate(
          EffectOpenApi.Override,
          operation,
        ),
      );
    }
    return endpoints;
  },
  zGroupFromDocument = <const Identifier extends string>(
    identifier: Identifier,
    document: ContractOpenApi.Document,
  ): ContractGroup<Identifier> => {
    const endpoints = Object.entries(document.paths).flatMap(([openApiPath, pathItem]) =>
        zEndpointsForPath(openApiPath, pathItem),
      ),
      [firstEndpoint] = endpoints;
    if (firstEndpoint === undefined) {
      throw new Error(`The ${identifier} API group must declare at least one endpoint`);
    }
    return HttpApiGroup.make(identifier).add(
      firstEndpoint,
      ...endpoints.slice(firstPathCharacterIndex + minimumIdentifierLength),
    );
  },
  zMakeApi = <const Identifier extends string, const GroupIdentifier extends string>(
    identifier: Identifier,
    groupIdentifier: GroupIdentifier,
    document: ContractOpenApi.Document,
  ): ContractApi<Identifier, GroupIdentifier> =>
    HttpApi.make(identifier)
      .add(zGroupFromDocument(groupIdentifier, document))
      .annotate(EffectOpenApi.Transform, (): ContractOpenApi.Document => ({ ...document })),
  zMakeHeadless = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-258] OpenAPI operation descriptors are read while building Effect HTTP API declarations.
    operations: readonly DeliveryOperation[],
  ): ContractApi<"headlessApi", "headless"> =>
    zMakeApi("headlessApi", "headless", ContractOpenApi.headless(operations)),
  zMakeHeadlessDocument = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-258] OpenAPI operation descriptors are read while building Effect HTTP API declarations.
    operations: readonly DeliveryOperation[],
  ): EffectOpenApi.OpenAPISpec => EffectOpenApi.fromApi(zMakeHeadless(operations)),
  zMakeManagement = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-258] OpenAPI operation descriptors are read while building Effect HTTP API declarations.
    operations: readonly ManagementOperation[],
  ): ContractApi<"managementApi", "management"> =>
    zMakeApi("managementApi", "management", ContractOpenApi.management(operations)),
  zMakeManagementDocument = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-258] OpenAPI operation descriptors are read while building Effect HTTP API declarations.
    operations: readonly ManagementOperation[],
  ): EffectOpenApi.OpenAPISpec => EffectOpenApi.fromApi(zMakeManagement(operations));

/** Effect HTTP API declarations and canonical OpenAPI documents. */
export {
  zMakeHeadless as headless,
  zMakeHeadlessDocument as headlessDocument,
  zMakeManagement as management,
  zMakeManagementDocument as managementDocument,
};
