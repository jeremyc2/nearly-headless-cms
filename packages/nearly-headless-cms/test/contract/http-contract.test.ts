import { describe, expect, test } from "bun:test";
import { Effect } from "effect";
import { ContentDefinition } from "../../src/index.ts";
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

  test("maps transport limits, media, and methods to their stable HTTP failures", async () => {
    const handler = await Effect.runPromise(
      HttpTransport.makeHandler({
        deliveryOperations: [
          {
            execute: () => Effect.succeed({ accepted: true }),
            identifier: "submit",
            method: "POST",
            path: "/submissions",
            reachableContentTypeIds: ["post"],
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
              execute: () => Effect.never,
              identifier: "waitForever",
              method: "GET",
              path: "/wait-forever",
              reachableContentTypeIds: ["post"],
            },
          ],
          requestTimeoutMilliseconds: 5,
        }).pipe(Effect.provide(DevelopmentCms.layer({ snapshot }))),
      ),
      timedOut = await timeoutHandler(new Request("http://cms.test/api/v1/headless/wait-forever"));
    expect(timedOut.status).toBe(408);
    expect(((await timedOut.json()) as { code: string }).code).toBe("RequestTimeout");
  });
});
