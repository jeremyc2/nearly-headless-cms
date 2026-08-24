import { describe, expect, test } from "bun:test";
import { Effect, Layer, Schema } from "effect";
import { HttpRouter, HttpServer } from "effect/unstable/http";
import { ContentDefinition } from "../../src/index.ts";
import * as HttpApiContract from "../../src/http/http-api.ts";
import { HttpTransport, OpenApi } from "../../src/http/index.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  acceptedStatus = 201,
  badRequestStatus = 400,
  contentTooLargeStatus = 413,
  createdStatus = 201,
  headerLengthLimit = 120,
  headerTooLargeStatus = 431,
  maximumHeaderByteLength = 100,
  maximumJsonBodyByteLength = 24,
  methodNotAllowedStatus = 405,
  noContentStatus = 204,
  notAcceptableStatus = 406,
  notFoundStatus = 404,
  payloadByteFive = 5,
  payloadByteFour = 4,
  payloadByteOne = 1,
  payloadByteSix = 6,
  payloadByteThree = 3,
  payloadByteTwo = 2,
  requestTimeoutMilliseconds = 5,
  requestTimeoutStatus = 408,
  successStatus = 200,
  unsupportedMediaTypeStatus = 415,
  uriTooLongStatus = 414,
  urlLengthLimit = 150,
  snapshot = ContentDefinition.compile({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
        id: "post",
        kind: "contentType",
        name: "Post",
      },
    ],
    snapshotId: "initial",
  });

describe("HTTP contract", () => {
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  test("streams bounded multipart Asset uploads and rejects unexpected metadata", async () => {
    const handler = await Effect.runPromise(
        HttpTransport.makeHandler({
          maximumMultipartFileByteLength: payloadByteFive,
          maximumMultipartMetadataByteLength: 256,
        }).pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(DevelopmentCms.layer({ snapshot })),
        ),
      ),
      assetUrl = "http://cms.test/api/v1/management/definition-spaces/example-blog/assets",
      metadata = JSON.stringify({ filename: "pixel.bin", mediaType: "application/octet-stream" }),
      oversizedForm = new FormData();
    oversizedForm.set("metadata", metadata);
    oversizedForm.set(
      "content",
      new File(
        [
          new Uint8Array([
            payloadByteOne,
            payloadByteTwo,
            payloadByteThree,
            payloadByteFour,
            payloadByteFive,
            payloadByteSix,
          ]),
        ],
        "pixel.bin",
        {
          type: "application/octet-stream",
        },
      ),
    );
    const oversized = await handler(new Request(assetUrl, { body: oversizedForm, method: "POST" }));
    expect(oversized.status).toBe(contentTooLargeStatus);
    expect(((await oversized.json()) as { code: string }).code).toBe("PayloadTooLarge");

    const unexpectedMetadataForm = new FormData();
    unexpectedMetadataForm.set(
      "metadata",
      JSON.stringify({ digest: "client-owned", ...JSON.parse(metadata) }),
    );
    unexpectedMetadataForm.set(
      "content",
      new File([new Uint8Array([payloadByteOne, payloadByteTwo, payloadByteThree])], "pixel.bin", {
        type: "application/octet-stream",
      }),
    );
    const unexpectedMetadata = await handler(
      new Request(assetUrl, { body: unexpectedMetadataForm, method: "POST" }),
    );
    expect(unexpectedMetadata.status).toBe(badRequestStatus);

    const acceptedForm = new FormData();
    acceptedForm.set("metadata", metadata);
    acceptedForm.set(
      "content",
      new File(
        [
          new Uint8Array([
            payloadByteOne,
            payloadByteTwo,
            payloadByteThree,
            payloadByteFour,
            payloadByteFive,
          ]),
        ],
        "pixel.bin",
        {
          type: "application/octet-stream",
        },
      ),
    );
    const accepted = await handler(new Request(assetUrl, { body: acceptedForm, method: "POST" }));
    expect(accepted.status).toBe(acceptedStatus);
    expect(await accepted.json()).toMatchObject({
      metadata: {
        byteLength: payloadByteFive,
        filename: "pixel.bin",
        mediaType: "application/octet-stream",
      },
    });
  });

  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  test("returns a deletion receipt only for history-enabled Entries", async () => {
    const deletionSnapshot = ContentDefinition.compile({
        definitionSpaceId: "delete-contract",
        definitions: [
          {
            fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
            history: true,
            id: "historical-note",
            kind: "contentType",
            name: "Historical Note",
          },
          {
            fields: [{ key: "title", kind: { kind: "text" }, label: "Title", required: true }],
            id: "temporary-note",
            kind: "contentType",
            name: "Temporary Note",
          },
        ],
        snapshotId: "initial",
      }),
      handler = await Effect.runPromise(
        HttpTransport.makeHandler().pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(DevelopmentCms.layer({ snapshot: deletionSnapshot })),
        ),
      ),
      // The helper awaits the native Response body before returning its validated payload.
      // oxlint-disable-next-line effecttsgo/async-function -- helper intentionally awaits a native HTTP promise.
      createEntry = async (contentTypeId: string): Promise<Readonly<Record<string, unknown>>> => {
        const response = await handler(
            new Request(
              `http://cms.test/api/v1/management/definition-spaces/delete-contract/content-types/${contentTypeId}/entries`,
              {
                body: JSON.stringify({ values: { title: "Delete me" } }),
                headers: { "content-type": "application/json" },
                method: "POST",
              },
            ),
          ),
          body: unknown = await response.json();
        if (!isRecord(body)) {
          throw new Error("Expected an Entry creation object");
        }
        return body;
      },
      historicalCreation = await createEntry("historical-note"),
      historicalEntry = historicalCreation["entry"],
      historicalWriteToken = historicalCreation["writeToken"];
    if (
      !isRecord(historicalEntry) ||
      typeof historicalEntry["id"] !== "string" ||
      typeof historicalWriteToken !== "string"
    ) {
      throw new Error("Expected history state from Entry creation");
    }
    const historicalDeletion = await handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/delete-contract/content-types/historical-note/entries/${historicalEntry["id"]}`,
          { headers: { "cms-write-token": historicalWriteToken }, method: "DELETE" },
        ),
      ),
      historicalDeletionBody: unknown = await historicalDeletion.json();
    expect(historicalDeletion.status).toBe(successStatus);
    expect(historicalDeletionBody).toMatchObject({
      contentTypeId: "historical-note",
      entryId: historicalEntry["id"],
      latestRevisionNumber: payloadByteOne,
    });

    const temporaryCreation = await createEntry("temporary-note"),
      temporaryEntryId = temporaryCreation["id"];
    if (typeof temporaryEntryId !== "string") {
      throw new TypeError("Expected ordinary Entry from creation");
    }
    const temporaryDeletion = await handler(
      new Request(
        `http://cms.test/api/v1/management/definition-spaces/delete-contract/content-types/temporary-note/entries/${temporaryEntryId}`,
        { method: "DELETE" },
      ),
    );
    expect(temporaryDeletion.status).toBe(noContentStatus);
    expect(await temporaryDeletion.text()).toBe("");
  });

  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  test("serves versioned Management operations while keeping Headless CRUD absent", async () => {
    const handler = await Effect.runPromise(
        HttpTransport.makeHandler().pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(DevelopmentCms.layer({ snapshot })),
        ),
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
    expect(created.status).toBe(createdStatus);
    expect(created.headers.get("cms-definition-fingerprint")).toBe(snapshot.fingerprint);
    expect(((await created.json()) as { values: { title: string } }).values.title).toBe("Hello");

    const unrestrictedHeadless = await handler(
      new Request("http://cms.test/api/v1/headless/content-types/post/entries"),
    );
    expect(unrestrictedHeadless.status).toBe(notFoundStatus);
    expect(OpenApi.management().openapi).toBe("3.1.0");
    expect(OpenApi.headless([]).paths).not.toHaveProperty("/content-types/{contentTypeId}/entries");
  });

  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
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
      expect(response.status).toBe(successStatus);
      expect(await response.json()).toEqual({ available: true });
    } finally {
      await webHandler.dispose();
    }
  });

  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
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
          maximumHeaderByteLength,
          maximumJsonBodyByteLength,
          maximumUrlLength: headerLengthLimit,
        }).pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(DevelopmentCms.layer({ snapshot })),
        ),
      ),
      oversizedBody = await handler(
        new Request(
          "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries",
          {
            body: JSON.stringify({ values: { title: "This body is deliberately too large" } }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      );
    expect(oversizedBody.status).toBe(contentTooLargeStatus);
    expect(((await oversizedBody.json()) as { code: string }).code).toBe("PayloadTooLarge");

    const unsupportedMedia = await handler(
      new Request("http://cms.test/api/v1/headless/submissions", {
        body: "plain text",
        headers: { "content-type": "text/plain" },
        method: "POST",
      }),
    );
    expect(unsupportedMedia.status).toBe(unsupportedMediaTypeStatus);

    const wrongMethod = await handler(new Request("http://cms.test/api/v1/headless/submissions"));
    expect(wrongMethod.status).toBe(methodNotAllowedStatus);
    const longUrl = await handler(
      new Request(`http://cms.test/api/v1/headless/${"x".repeat(urlLengthLimit)}`),
    );
    expect(longUrl.status).toBe(uriTooLongStatus);
    const largeHeaders = await handler(
      new Request("http://cms.test/api/v1/headless/schema", {
        headers: { "x-large": "x".repeat(headerLengthLimit) },
      }),
    );
    expect(largeHeaders.status).toBe(headerTooLargeStatus);

    const unacceptable = await handler(
      new Request("http://cms.test/api/v1/headless/schema", {
        headers: { accept: "text/csv" },
      }),
    );
    expect(unacceptable.status).toBe(notAcceptableStatus);
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
          requestTimeoutMilliseconds,
        }).pipe(
          // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
          Effect.provide(DevelopmentCms.layer({ snapshot })),
        ),
      ),
      timedOut = await timeoutHandler(new Request("http://cms.test/api/v1/headless/wait-forever"));
    expect(timedOut.status).toBe(requestTimeoutStatus);
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
          successStatus: acceptedStatus,
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

    expect(
      OpenApi.management().paths[
        "/api/v1/management/definition-spaces/{definitionSpaceId}/content-types/{contentTypeId}/entries/{entryId}"
      ],
    ).toMatchObject({
      delete: {
        responses: {
          "200": {
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/DeletionRecord" },
              },
            },
          },
          "204": { description: "Operation completed without a response body" },
        },
      },
    });
  });
});
