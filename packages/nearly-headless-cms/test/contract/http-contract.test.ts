import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { ContentDefinition } from "../../src/index.ts";
import * as HttpApiContract from "../../src/http/http-api.ts";
import { HttpTransport, OpenApi } from "../../src/http/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const snapshot = ContentDefinition.compile({
  definitionSpaceId: "example-blog",
  definitions: [
    {
      fields: [{ key: "title", label: "Title", required: true, kind: { kind: "text" } }],
      id: "post",
      kind: "contentType",
      name: "Post",
    },
  ],
  snapshotId: "initial",
});

describe("HTTP contract", () => {
  test("serves versioned Management operations while keeping Headless CRUD absent", async () => {
    const handler = await Effect.runPromise(
        HttpTransport.makeHandler().pipe(Effect.provide(DevelopmentCms.layer({ snapshot }))),
      ),
      created = await handler(
        new Request(
          "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries",
          {
            body: JSON.stringify({ values: { title: "Hello" } }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      );
    expect(created.status).toBe(201);
    expect(created.headers.get("cms-definition-fingerprint")).toBe(snapshot.fingerprint);
    expect(((await created.json()) as { values: { title: string } }).values.title).toBe("Hello");

    const unrestrictedHeadless = await handler(
      new Request("http://cms.test/api/v1/headless/content-types/post/entries"),
    );
    expect(unrestrictedHeadless.status).toBe(404);
    expect(OpenApi.management().openapi).toBe("3.1.0");
    expect(OpenApi.headless([]).paths).not.toHaveProperty("/content-types/{contentTypeId}/entries");
  });

  test("mounts each declared operation through the portable Effect HttpApi route Layer", async () => {
    const routes = HttpTransport.layer({
        deliveryOperations: [
          {
            definitionRequirements: [],
            execute: () => Effect.succeed({ available: true }),
            identifier: "checkAvailability",
            method: "GET",
            path: "/availability",
            reachableContentTypeIds: ["post"],
            schemas: {
              request: Schema.Struct({}),
              response: Schema.Struct({ available: Schema.Boolean }),
            },
          },
        ],
      }).pipe(
        Layer.provide(DevelopmentCms.layer({ snapshot })),
        Layer.provide(HttpServer.layerServices),
      ),
      webHandler = HttpRouter.toWebHandler(routes);
    try {
      const response = await webHandler.handler(
        new Request("http://cms.test/api/v1/headless/availability"),
      );
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ available: true });
    } finally {
      await webHandler.dispose();
    }
  });

  test("maps transport limits, media, and methods to their stable HTTP failures", async () => {
    const handler = await Effect.runPromise(
      HttpTransport.makeHandler({
        deliveryOperations: [
          {
            definitionRequirements: [],
            execute: () => Effect.succeed({ accepted: true }),
            identifier: "submit",
            method: "POST",
            path: "/submissions",
            reachableContentTypeIds: ["post"],
            schemas: {
              request: Schema.Struct({}),
              response: Schema.Struct({ accepted: Schema.Boolean }),
            },
          },
        ],
        maximumHeaderByteLength: 100,
        maximumJsonBodyByteLength: 24,
        maximumUrlLength: 120,
      }).pipe(Effect.provide(DevelopmentCms.layer({ snapshot }))),
    );

    const oversizedBody = await handler(
      new Request(
        "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries",
        {
          body: JSON.stringify({ values: { title: "This body is deliberately too large" } }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
    );
    expect(oversizedBody.status).toBe(413);
    expect(((await oversizedBody.json()) as { code: string }).code).toBe("PayloadTooLarge");

    const unsupportedMedia = await handler(
      new Request("http://cms.test/api/v1/headless/submissions", {
        body: "plain text",
        headers: { "content-type": "text/plain" },
        method: "POST",
      }),
    );
    expect(unsupportedMedia.status).toBe(415);

    const wrongMethod = await handler(new Request("http://cms.test/api/v1/headless/submissions"));
    expect(wrongMethod.status).toBe(405);
    const longUrl = await handler(
      new Request(`http://cms.test/api/v1/headless/${"x".repeat(150)}`),
    );
    expect(longUrl.status).toBe(414);
    const largeHeaders = await handler(
      new Request("http://cms.test/api/v1/headless/schema", {
        headers: { "x-large": "x".repeat(120) },
      }),
    );
    expect(largeHeaders.status).toBe(431);

    const unacceptable = await handler(
      new Request("http://cms.test/api/v1/headless/schema", {
        headers: { accept: "text/csv" },
      }),
    );
    expect(unacceptable.status).toBe(406);
    expect(((await unacceptable.json()) as { code: string }).code).toBe("NotAcceptable");

    const timeoutHandler = await Effect.runPromise(
        HttpTransport.makeHandler({
          deliveryOperations: [
            {
              definitionRequirements: [],
              execute: () => Effect.never,
              identifier: "waitForever",
              method: "GET",
              path: "/wait-forever",
              reachableContentTypeIds: ["post"],
              schemas: { request: Schema.Struct({}), response: Schema.Struct({}) },
            },
          ],
          requestTimeoutMilliseconds: 5,
        }).pipe(Effect.provide(DevelopmentCms.layer({ snapshot }))),
      ),
      timedOut = await timeoutHandler(new Request("http://cms.test/api/v1/headless/wait-forever"));
    expect(timedOut.status).toBe(408);
    expect(((await timedOut.json()) as { code: string }).code).toBe("RequestTimeout");
  });

  test("derives stable OpenAPI request, success, parameter, and declared error schemas", () => {
    const operations = [
        {
          definitionRequirements: [],
          execute: () => Effect.succeed({ status: "pending" }),
          identifier: "submitComment",
          method: "POST",
          path: "/posts/{postId}/comments",
          reachableContentTypeIds: ["post", "comment"],
          schemas: {
            pathParameters: { postId: Schema.String },
            request: Schema.Struct({ body: Schema.String }),
            requestBody: Schema.Struct({ body: Schema.String }),
            response: Schema.Struct({ status: Schema.Literal("pending") }),
          },
          successStatus: 201,
        },
      ] as const,
      document = OpenApi.headless(operations),
      api = HttpApiContract.headless(operations);
    expect(JSON.stringify(HttpApiContract.headlessDocument(operations))).toBe(
      JSON.stringify(document),
    );
    expect(api.groups.headless?.endpoints["submitComment"]?.path).toBe(
      "/api/v1/headless/posts/:postId/comments",
    );
    const commentSubmissionPath = document.paths["/api/v1/headless/posts/{postId}/comments"];
    expect(commentSubmissionPath).toMatchObject({
      post: {
        operationId: "submitComment",
        parameters: expect.arrayContaining([
          { in: "path", name: "postId", required: true, schema: { type: "string" } },
        ]),
        requestBody: {
          content: {
            "application/json": {
              schema: {
                additionalProperties: false,
                properties: { body: { type: "string" } },
                required: ["body"],
                type: "object",
              },
            },
          },
          required: true,
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: {
                  additionalProperties: false,
                  properties: { status: { enum: ["pending"], type: "string" } },
                  required: ["status"],
                  type: "object",
                },
              },
            },
          },
          "400": { description: "Invalid input" },
          "409": { description: "Conflict" },
          "503": { description: "Retryable infrastructure failure" },
        },
      },
    });
    expect(
      JSON.stringify(document.paths["/api/v1/headless/posts/{postId}/comments"]),
    ).not.toContain('"default"');

    expect(
      OpenApi.management().paths[
        "/api/v1/management/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries"
      ],
    ).toMatchObject({
      post: {
        requestBody: {
          content: {
            "application/json": {
              schema: {
                properties: { values: { $ref: "#/components/schemas/JsonObject" } },
              },
            },
          },
        },
        responses: {
          "201": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/MutationResult" },
              },
            },
          },
        },
      },
    });
  });
});
