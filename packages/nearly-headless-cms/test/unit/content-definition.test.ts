import { describe, expect, test } from "bun:test";
import { ContentDefinition } from "../../src/index.ts";

describe("ContentDefinition.compile", () => {
  test("compiles a complete snapshot and validates Entry values without coercion", () => {
    const snapshot = ContentDefinition.compile({
      definitionSpaceId: "example-blog",
      definitions: [
        {
          fields: [
            { key: "title", label: "Title", required: true, kind: { kind: "text", minLength: 1 } },
            {
              key: "status",
              label: "Status",
              defaultValue: "draft",
              kind: { kind: "enum", values: ["draft", "published"] },
            },
          ],
          id: "post",
          kind: "contentType",
          name: "Post",
        },
      ],
      snapshotId: "initial",
    });

    expect(snapshot.fingerprint).toMatch(/^[a-f\d]{64}$/);
    expect(snapshot.validateEntry("post", { title: "Hello" }, { applyDefaults: true })).toEqual({
      status: "draft",
      title: "Hello",
    });
    expect(() => snapshot.validateEntry("post", { title: 1 }, { applyDefaults: false })).toThrow(
      "title",
    );
  });

  test("validates nested and inline Field Groups as schemas rather than untyped JSON", () => {
    const snapshot = ContentDefinition.compile({
      definitionSpaceId: "field-groups",
      definitions: [
        {
          fields: [
            { key: "city", label: "City", required: true, kind: { kind: "text" } },
            { key: "country", label: "Country", defaultValue: "US", kind: { kind: "text" } },
          ],
          id: "address",
          kind: "fieldGroup",
          name: "Address",
        },
        {
          fields: [
            { key: "display-name", label: "Display name", required: true, kind: { kind: "text" } },
          ],
          id: "identity",
          kind: "fieldGroup",
          name: "Identity",
        },
        {
          fieldGroups: [
            { mode: "inline", fieldGroupId: "identity" },
            {
              mode: "nested",
              fieldGroupId: "address",
              key: "address",
              label: "Address",
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

    expect(
      snapshot.validateEntry(
        "person",
        { address: { city: "London" }, "display-name": "Ada" },
        { applyDefaults: true },
      ),
    ).toEqual({
      address: { city: "London", country: "US" },
      "display-name": "Ada",
    });
    expect(() =>
      snapshot.validateEntry(
        "person",
        { address: { city: "London", mystery: true }, "display-name": "Ada" },
        { applyDefaults: false },
      ),
    ).toThrow("address.mystery");
    expect(() =>
      ContentDefinition.compile({
        definitionSpaceId: "field-groups",
        definitions: [
          {
            fieldGroups: [{ mode: "inline", fieldGroupId: "second" }],
            fields: [],
            id: "first",
            kind: "fieldGroup",
            name: "First",
          },
          {
            fieldGroups: [{ mode: "inline", fieldGroupId: "first" }],
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

  test("validates ordered lists of reusable Field Groups", () => {
    const compiled = ContentDefinition.compile({
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
      compiled.validateEntry("page", { links: [{ unknown: true }] }, { applyDefaults: true }),
    ).toThrow("Entry validation failed");
  });
});
