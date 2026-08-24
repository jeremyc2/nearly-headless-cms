import { describe, expect, test } from "bun:test";
import { generateOpenApiClient } from "./openapi-client-generator.ts";

const document = {
  components: {
    schemas: {
      Greeting: {
        additionalProperties: false,
        properties: { message: { type: "string" } },
        required: ["message"],
        type: "object",
      },
    },
  },
  openapi: "3.1.0",
  paths: {
    "/greetings/{name}": {
      get: {
        operationId: "getGreeting",
        parameters: [{ in: "path", name: "name", required: true, schema: { type: "string" } }],
        responses: {
          "200": {
            content: {
              "application/json": { schema: { $ref: "#/components/schemas/Greeting" } },
            },
            description: "Greeting",
          },
        },
      },
    },
  },
} as const;

describe("OpenAPI client generator", () => {
  test("generates stable typed Effect methods", () => {
    const first = generateOpenApiClient(document),
      second = generateOpenApiClient(document);
    expect(first).toBe(second);
    expect(first).toContain(
      'getGreeting: (input: OperationInputs["getGreeting"], signal?: AbortSignal)',
    );
    expect(first).toContain("readonly getGreeting: Greeting;");
    expect(first).toContain("Effect.tryPromise");
  });

  test("rejects duplicate operation identifiers", () => {
    expect(() =>
      generateOpenApiClient({
        ...document,
        paths: {
          ...document.paths,
          "/other": {
            get: {
              ...document.paths["/greetings/{name}"].get,
              parameters: [],
            },
          },
        },
      }),
    ).toThrow("Duplicate OpenAPI operation identifier");
  });

  test("rejects ambiguous successful responses", () => {
    expect(() =>
      generateOpenApiClient({
        ...document,
        paths: {
          "/greetings/{name}": {
            get: {
              ...document.paths["/greetings/{name}"].get,
              responses: {
                ...document.paths["/greetings/{name}"].get.responses,
                "201": document.paths["/greetings/{name}"].get.responses["200"],
              },
            },
          },
        },
      }),
    ).toThrow("requires exactly one 2xx response");
  });
});
