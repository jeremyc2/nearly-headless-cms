import { describe, expect, test } from "bun:test";
import { Effect } from "effect";

describe("Public Blog static output", () => {
  test("contains public routes and excludes the seeded draft route", (): Promise<void> =>
    Effect.runPromise(
      Effect.gen(function* verifyStaticOutput() {
        const workspace = `${import.meta.dir}/../..`,
          workspaceDraftPostExists = yield* Effect.promise(() =>
            Bun.file(`${workspace}/dist/posts/the-unfinished-map/index.html`).exists(),
          ),
          workspaceFeed = yield* Effect.promise(() =>
            Bun.file(`${workspace}/dist/feed.xml`).text(),
          ),
          workspaceIndexExists = yield* Effect.promise(() =>
            Bun.file(`${workspace}/dist/index.html`).exists(),
          ),
          workspacePublishedPostExists = yield* Effect.promise(() =>
            Bun.file(`${workspace}/dist/posts/a-lighthouse-for-content/index.html`).exists(),
          );
        expect(workspaceIndexExists).toBeTrue();
        expect(workspacePublishedPostExists).toBeTrue();
        expect(workspaceDraftPostExists).toBeFalse();
        expect(workspaceFeed).not.toContain("The Unfinished Map");
      }),
    ));
});
