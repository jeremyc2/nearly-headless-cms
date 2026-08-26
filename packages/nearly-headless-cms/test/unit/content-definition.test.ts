import {
  type CompiledSnapshot,
  type JsonObject,
  compileSnapshot,
} from "../../src/content-definition.ts";
import { expect, test } from "bun:test";

const fieldGroupSnapshot: CompiledSnapshot = compileSnapshot({
  definitionSpaceId: "field-groups",
  definitions: [
    {
      fields: [
        { key: "city", kind: { kind: "text" }, label: "City", required: true },
        { defaultValue: "US", key: "country", kind: { kind: "text" }, label: "Country" },
      ],
      id: "address",
      kind: "fieldGroup",
      name: "Address",
    },
    {
      fields: [
        { key: "display-name", kind: { kind: "text" }, label: "Display name", required: true },
      ],
      id: "identity",
      kind: "fieldGroup",
      name: "Identity",
    },
    {
      fieldGroups: [
        { fieldGroupId: "identity", mode: "inline" },
        {
          fieldGroupId: "address",
          key: "address",
          label: "Address",
          mode: "nested",
          required: true,
        },
      ],
      fields: [],
      id: "person",
      kind: "contentType",
      name: "Person",
    },
  ],
  snapshotId: "initial",
});

test("ContentDefinition.compile compiles and validates Entry values without coercion", () => {
  const snapshot: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [
          { key: "title", kind: { kind: "text", minLength: 1 }, label: "Title", required: true },
          {
            defaultValue: "draft",
            key: "status",
            kind: { kind: "enum", values: ["draft", "published"] },
            label: "Status",
          },
        ],
        id: "post",
        kind: "contentType",
        name: "Post",
      },
    ],
    snapshotId: "initial",
  });

  expect(snapshot.fingerprint).toMatch(/^[a-f\d]{64}$/u);
  expect(snapshot.validateEntry("post", { title: "Hello" }, { applyDefaults: true })).toEqual({
    status: "draft",
    title: "Hello",
  });
  expect(() =>
    snapshot.validateEntry("post", { title: 1 } satisfies JsonObject, { applyDefaults: false }),
  ).toThrow("title");
});

test("ContentDefinition.compile validates nested and inline Field Groups", () => {
  expect(
    fieldGroupSnapshot.validateEntry(
      "person",
      { address: { city: "London" }, "display-name": "Ada" },
      { applyDefaults: true },
    ),
  ).toEqual({
    address: { city: "London", country: "US" },
    "display-name": "Ada",
  });
  expect(() =>
    fieldGroupSnapshot.validateEntry(
      "person",
      {
        address: { city: "London", mystery: true },
        "display-name": "Ada",
      } satisfies JsonObject,
      { applyDefaults: false },
    ),
  ).toThrow("address.mystery");
});

test("ContentDefinition.compile rejects cyclic Field Group composition", () => {
  expect(() =>
    compileSnapshot({
      definitionSpaceId: "field-groups",
      definitions: [
        {
          fieldGroups: [{ fieldGroupId: "second", mode: "inline" }],
          fields: [],
          id: "first",
          kind: "fieldGroup",
          name: "First",
        },
        {
          fieldGroups: [{ fieldGroupId: "first", mode: "inline" }],
          fields: [],
          id: "second",
          kind: "fieldGroup",
          name: "Second",
        },
      ],
      snapshotId: "cycle",
    }),
  ).toThrow("cycle");
});

test("ContentDefinition.compile validates ordered lists of reusable Field Groups", () => {
  const compiled: CompiledSnapshot = compileSnapshot({
    definitionSpaceId: "test-space",
    definitions: [
      {
        fields: [{ key: "label", kind: { kind: "text" }, label: "Label", required: true }],
        id: "link",
        kind: "fieldGroup",
        name: "Link",
      },
      {
        fields: [
          {
            key: "links",
            kind: {
              element: { fieldGroupId: "link", kind: "fieldGroup" },
              kind: "list",
              maximumLength: 2,
            },
            label: "Links",
          },
        ],
        id: "page",
        kind: "contentType",
        name: "Page",
      },
    ],
    snapshotId: "initial",
  });

  expect(
    compiled.validateEntry(
      "page",
      { links: [{ label: "First" }, { label: "Second" }] },
      { applyDefaults: true },
    ),
  ).toEqual({
    links: [{ label: "First" }, { label: "Second" }],
  });
  expect(() =>
    compiled.validateEntry("page", { links: [{ unknown: true }] } satisfies JsonObject, {
      applyDefaults: true,
    }),
  ).toThrow("Entry validation failed");
});
