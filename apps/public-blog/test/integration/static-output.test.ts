import { describe, expect, test } from "bun:test";
import { join } from "node:path";

describe("Public Blog static output", () => {
  test("contains public routes and excludes the seeded draft route", async () => {
    const workspace = join(import.meta.dir, "..", "..");
    expect(await Bun.file(join(workspace, "dist", "index.html")).exists()).toBeTrue();
    expect(
      await Bun.file(
        join(workspace, "dist", "posts", "a-lighthouse-for-content", "index.html"),
      ).exists(),
    ).toBeTrue();
    expect(
      await Bun.file(join(workspace, "dist", "posts", "the-unfinished-map", "index.html")).exists(),
    ).toBeFalse();
    expect(await Bun.file(join(workspace, "dist", "feed.xml")).text()).not.toContain(
      "The Unfinished Map",
    );
  });
});
