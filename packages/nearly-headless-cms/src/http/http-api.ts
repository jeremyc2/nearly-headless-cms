import {
  HttpApi,
  HttpApiEndpoint,
  HttpApiGroup,
  OpenApi as EffectOpenApi,
} from "effect/unstable/httpapi";
import type { DeliveryOperation, ManagementOperation } from "./http-contract.ts";
import * as ContractOpenApi from "./open-api.ts";

const operationRecord = (value: unknown): Record<string, unknown> => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      throw new Error("Every OpenAPI path operation must be an object");
    }
    return Object.fromEntries(Object.entries(value));
  },
  endpointPath = (openApiPath: string): `/${string}` => {
    if (!openApiPath.startsWith("/")) {
      throw new Error(`OpenAPI path must begin with a slash: ${openApiPath}`);
    }
    return `/${openApiPath.slice(1).replaceAll(/\{([^}]+)\}/gu, ":$1")}`;
  },
  endpointFor = (method: string, identifier: string, path: `/${string}`) => {
    switch (method) {
      case "delete":
        return HttpApiEndpoint.delete(identifier, path);
      case "get":
        return HttpApiEndpoint.get(identifier, path);
      case "head":
        return HttpApiEndpoint.head(identifier, path);
      case "post":
        return HttpApiEndpoint.post(identifier, path);
      case "put":
        return HttpApiEndpoint.put(identifier, path);
      default:
        throw new Error(`Unsupported HTTP method in the OpenAPI contract: ${method}`);
    }
  },
  makeGroup = <const Identifier extends string>(
    identifier: Identifier,
    document: ContractOpenApi.Document,
  ) => {
    const endpoints: Array<ReturnType<typeof endpointFor>> = [];
    for (const [openApiPath, pathItem] of Object.entries(document.paths)) {
      for (const [method, value] of Object.entries(pathItem)) {
        const operation = operationRecord(value),
          operationIdentifier = operation["operationId"];
        if (typeof operationIdentifier !== "string" || operationIdentifier.length === 0) {
          throw new Error(
            `OpenAPI operation ${method.toUpperCase()} ${openApiPath} needs an operationId`,
          );
        }
        endpoints.push(
          endpointFor(method, operationIdentifier, endpointPath(openApiPath)).annotate(
            EffectOpenApi.Override,
            operation,
          ),
        );
      }
    }
    const firstEndpoint = endpoints[0];
    if (firstEndpoint === undefined) {
      throw new Error(`The ${identifier} API group must declare at least one endpoint`);
    }
    return HttpApiGroup.make(identifier).add(firstEndpoint, ...endpoints.slice(1));
  },
  makeApi = <const Identifier extends string, const GroupIdentifier extends string>(
    identifier: Identifier,
    groupIdentifier: GroupIdentifier,
    document: ContractOpenApi.Document,
  ) =>
    HttpApi.make(identifier)
      .add(makeGroup(groupIdentifier, document))
      .annotate(EffectOpenApi.Transform, () => ({ ...document }));

/** Declares the complete version-one Management HTTP API for Effect routing and reflection. */
export const management = (operations: readonly ManagementOperation[] = []) =>
  makeApi("managementApi", "management", ContractOpenApi.management(operations));

/** Declares the Builder-selected version-one Headless HTTP API for Effect routing and reflection. */
export const headless = (operations: readonly DeliveryOperation[]) =>
  makeApi("headlessApi", "headless", ContractOpenApi.headless(operations));

/** Produces the canonical Management OpenAPI document from its Effect `HttpApi` declaration. */
export const managementDocument = (operations: readonly ManagementOperation[] = []) =>
  EffectOpenApi.fromApi(management(operations));

/** Produces the canonical Headless OpenAPI document from its Effect `HttpApi` declaration. */
export const headlessDocument = (operations: readonly DeliveryOperation[]) =>
  EffectOpenApi.fromApi(headless(operations));
