import { expect, test } from "bun:test";
import { generateClientSource, parseOpenApiDocument } from "./openapi-client-generator.ts";

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
} as const,

 generateExampleClient = () =>
  generateClientSource({
    ...parseOpenApiDocument(document),
    clientBasename: "example-openapi-client",
    formatVersion: 3,
  });

test("generates stable typed Effect methods", () => {
  const first = generateExampleClient(),
    runtimeSource =
      first.files.find((file) => file.filename.endsWith("-runtime-transport"))?.content ?? "";
  expect(generateExampleClient()).toEqual(first);
  expect(runtimeSource).toContain('createOperationMethod(baseAddress, "getGreeting")');
  expect(
    first.files.find((file) => file.filename.endsWith("-operation-responses-0"))?.content,
  ).toContain("readonly getGreeting: Greeting;");
  expect(runtimeSource).toContain("Effect.tryPromise");
});

test("rejects duplicate operation identifiers", () => {
  expect(() =>
    generateClientSource({
      ...parseOpenApiDocument({
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
      clientBasename: "example-openapi-client",
      formatVersion: 3,
    }),
  ).toThrow("Duplicate OpenAPI operation identifier");
});

test("generates response unions for operations with multiple successful statuses", () => {
  const generated = generateClientSource({
    ...parseOpenApiDocument({
      ...document,
      paths: {
        "/greetings/{name}": {
          get: {
            ...document.paths["/greetings/{name}"].get,
            responses: {
              ...document.paths["/greetings/{name}"].get.responses,
              "204": { description: "No greeting" },
            },
          },
        },
      },
    }),
    clientBasename: "example-openapi-client",
    formatVersion: 3,
  });
  expect(
    generated.files.find((file) => file.filename.endsWith("-operation-responses-0"))?.content,
  ).toContain("readonly getGreeting: Greeting | undefined;");
  expect(
    generated.files.find((file) => file.filename.endsWith("-specifications"))?.content,
  ).toContain('"status": 200');
  expect(
    generated.files.find((file) => file.filename.endsWith("-specifications"))?.content,
  ).toContain('"status": 204');
});
