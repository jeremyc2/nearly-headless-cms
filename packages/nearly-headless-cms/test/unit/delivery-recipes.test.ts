import { compileSnapshot, Fields } from "../../src/content-definition.ts";
import {
  definitionRequirementFromContentType,
  publicEntryValue,
  publicExportArtifact,
} from "../../src/http/delivery-recipes/index.ts";
import { expect, test } from "bun:test";

const snapshot = compileSnapshot({
    definitionSpaceId: "delivery-recipes",
    definitions: [
      Fields.contentType({
        fields: [
          Fields.requiredTextField("title", "Title", { maxLength: 120 }),
          Fields.requiredSlugField("slug", "Slug"),
          { key: "excerpt", kind: Fields.text({ maxLength: 240 }), label: "Excerpt" },
        ],
        id: "post",
        name: "Post",
      }),
    ],
    snapshotId: "v1",
  }),
  postEntry = {
    contentTypeId: "post",
    id: "post-1",
    values: {
      excerpt: "Hello",
      slug: "hello",
      title: "Hello",
    },
  };

test("definitionRequirementFromContentType derives projectable fields", () => {
  const requirement = definitionRequirementFromContentType(snapshot, "post");
  expect(requirement.contentTypeId).toBe("post");
  expect(requirement.fields.map((field) => field.path)).toEqual(["title", "slug", "excerpt"]);
});

test("publicEntryValue projects camelCase wire fields", () => {
  expect(publicEntryValue(postEntry)).toEqual({
    excerpt: "Hello",
    id: "post-1",
    slug: "hello",
    title: "Hello",
  });
});

test("publicEntryValue fills configured nullable wire fields", () => {
  expect(
    publicEntryValue(postEntry, {
      nullableWireFields: { post: ["featuredAsset"] },
    }),
  ).toEqual({
    excerpt: "Hello",
    featuredAsset: null,
    id: "post-1",
    slug: "hello",
    title: "Hello",
  });
});

test("publicExportArtifact assembles grouped public collections", () => {
  expect(
    publicExportArtifact({
      assets: [],
      content: { posts: [postEntry] },
      definitionFingerprint: snapshot.fingerprint,
      generatedAt: "2026-01-01T00:00:00.000Z",
    }),
  ).toEqual({
    assets: [],
    definitionFingerprint: snapshot.fingerprint,
    generatedAt: "2026-01-01T00:00:00.000Z",
    posts: [
      {
        excerpt: "Hello",
        id: "post-1",
        slug: "hello",
        title: "Hello",
      },
    ],
  });
});
