import { describe, expect, test } from "bun:test";
import { ContentDefinition, EntryQuery } from "../../src/index.ts";

const snapshot = ContentDefinition.compile({
  definitionSpaceId: "example-blog",
  definitions: [
    {
      fields: [
        { key: "title", label: "Title", required: true, kind: { kind: "text" } },
        { key: "rank", label: "Rank", nullable: true, kind: { kind: "integer" } },
        { key: "status", label: "Status", kind: { kind: "enum", values: ["draft", "published"] } },
      ],
      id: "post",
      kind: "contentType",
      name: "Post",
    },
  ],
  snapshotId: "initial",
});

describe("EntryQuery.evaluate", () => {
  test("filters, deterministically sorts, projects, and cursor-paginates Entries", () => {
    const entries = [
        {
          contentTypeId: "post",
          id: "post-c",
          values: { rank: null, status: "published", title: "Third" },
        },
        {
          contentTypeId: "post",
          id: "post-a",
          values: { rank: 2, status: "published", title: "First" },
        },
        {
          contentTypeId: "post",
          id: "post-b",
          values: { rank: 1, status: "draft", title: "Draft" },
        },
      ] as const,
      query = {
        contentTypeId: "post",
        pageSize: 1,
        projection: ["title"],
        sort: [{ direction: "ascending", path: "rank" }],
        where: { operator: "equals", path: "status", value: "published" },
      } as const,
      firstPage = EntryQuery.evaluate(entries, query, snapshot, { generation: 4 });
    expect(firstPage.items).toEqual([
      { contentTypeId: "post", id: "post-a", values: { title: "First" } },
    ]);
    expect(firstPage.nextCursor).toBeString();
    expect(
      EntryQuery.evaluate(entries, { ...query, cursor: firstPage.nextCursor }, snapshot, {
        generation: 4,
      }).items[0]?.id,
    ).toBe("post-c");
    expect(() =>
      EntryQuery.evaluate(entries, { ...query, cursor: firstPage.nextCursor }, snapshot, {
        generation: 5,
      }),
    ).toThrow("stale");
  });

  test("traverses nested Field Group objects while projecting only selected leaves", () => {
    const groupedSnapshot = ContentDefinition.compile({
        definitionSpaceId: "nested-query",
        definitions: [
          {
            fields: [
              { key: "city", label: "City", kind: { kind: "text" } },
              { key: "country", label: "Country", kind: { kind: "text" } },
            ],
            id: "address",
            kind: "fieldGroup",
            name: "Address",
          },
          {
            fieldGroups: [
              { mode: "nested", fieldGroupId: "address", key: "address", label: "Address" },
            ],
            fields: [],
            id: "person",
            kind: "contentType",
            name: "Person",
          },
        ],
        snapshotId: "initial",
      }),
      page = EntryQuery.evaluate(
        [
          {
            contentTypeId: "person",
            id: "person-1",
            values: { address: { city: "Paris", country: "FR" } },
          },
          {
            contentTypeId: "person",
            id: "person-2",
            values: { address: { city: "Oslo", country: "NO" } },
          },
        ],
        {
          contentTypeId: "person",
          pageSize: 10,
          projection: ["address.city"],
          where: { operator: "startsWith", path: "address.city", value: "P" },
        },
        groupedSnapshot,
        { generation: 1 },
      );
    expect(page.items).toEqual([
      { contentTypeId: "person", id: "person-1", values: { address: { city: "Paris" } } },
    ]);
  });
});
