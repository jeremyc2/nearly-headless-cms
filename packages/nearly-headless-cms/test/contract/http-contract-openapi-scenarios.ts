import * as HttpApiContract from "../../src/http/http-api.ts";
import { Effect, Schema } from "effect";
import { acceptedStatus, isRecord } from "./http-contract-support.ts";
import { OpenApi } from "../../src/http/index.ts";
import { expect } from "bun:test";

type HeadlessOpenApiDocument = ReturnType<typeof OpenApi.headless>;

const commentSubmissionOperation = {
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
  } as const,
  commentSubmissionPath = "/api/v1/headless/posts/{postId}/comments",
  postIdPathParameter = {
    in: "path",
    name: "postId",
    required: true,
    schema: { type: "string" },
  } as const,
  verifyCommentSubmissionHeadlessApiPath = (): void => {
    const headlessApi = HttpApiContract.headless([commentSubmissionOperation]);
    expect(headlessApi.groups.headless?.endpoints["submitComment"]?.path).toBe(
      "/api/v1/headless/posts/:postId/comments",
    );
  },
  verifyCommentSubmissionOpenApiPath = (document: HeadlessOpenApiDocument): void => {
    const pathItem = document.paths[commentSubmissionPath],
      postOperation = pathItem?.["post"];
    expect(postOperation).toMatchObject({
      operationId: "submitComment",
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
    });
    if (!isRecord(postOperation)) {
      throw new TypeError("Expected OpenAPI post operation to be an object");
    }
    expect(postOperation["parameters"]).toContainEqual(postIdPathParameter);
    expect(JSON.stringify(document.paths[commentSubmissionPath])).not.toContain('"default"');
  },
  verifyHeadlessDocumentParity = (): HeadlessOpenApiDocument => {
    const document = OpenApi.headless([commentSubmissionOperation]);
    expect(JSON.stringify(HttpApiContract.headlessDocument([commentSubmissionOperation]))).toBe(
      JSON.stringify(document),
    );
    return document;
  },
  verifyManagementEntryCreationOpenApiPath = (): void => {
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
  },
  verifyManagementEntryDeletionOpenApiPath = (): void => {
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
  },
  verifyOpenApiSchemas = (): void => {
    const document = verifyHeadlessDocumentParity();
    verifyCommentSubmissionHeadlessApiPath();
    verifyCommentSubmissionOpenApiPath(document);
    verifyManagementEntryCreationOpenApiPath();
    verifyManagementEntryDeletionOpenApiPath();
  };

export { verifyOpenApiSchemas };
