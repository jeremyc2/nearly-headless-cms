import { expect, test } from "bun:test";
import { Effect } from "effect";
import { makeGeneratedClient } from "../../src/generated/management-openapi-client.ts";

test("generated JSON requests send their declared media type", () => {
  let receivedContentType: string | null = null;
  const server = Bun.serve({
    fetch: (request) => {
      receivedContentType = request.headers.get("content-type");
      return Response.json({ items: [] });
    },
    port: 0,
  });

  return makeGeneratedClient(server.url.href)
    .queryEntries({
      body: { pageSize: 1 },
      path: { contentTypeId: "post", definitionSpaceId: "example-blog" },
    })
    .pipe(
      Effect.tap(() =>
        Effect.sync(() => {
          expect(receivedContentType).toBe("application/json");
        }),
      ),
      Effect.ensuring(Effect.promise(() => server.stop(true))),
      Effect.runPromise,
    );
});
