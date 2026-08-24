import { type CompiledSnapshot, compile } from "../../src/content-definition.ts";
import { expect, test } from "bun:test";
import { EntryQuery } from "../../src/index.ts";

const baseSnapshot: CompiledSnapshot = compile({
    definitionSpaceId: "example-blog",
    definitions: [
      {
        fields: [
          { key: "title", kind: { kind: "text" }, label: "Title", required: true },
          { key: "rank", kind: { kind: "integer" }, label: "Rank", nullable: true },
          {
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
  }),
  firstItemIndex = 0,
  groupedSnapshot: CompiledSnapshot = compile({
    definitionSpaceId: "nested-query",
    definitions: [
      {
        fields: [
          { key: "city", kind: { kind: "text" }, label: "City" },
          { key: "country", kind: { kind: "text" }, label: "Country" },
        ],
        id: "address",
        kind: "fieldGroup",
        name: "Address",
      },
      {
        fieldGroups: [
          { fieldGroupId: "address", key: "address", label: "Address", mode: "nested" },
        ],
        fields: [],
        id: "person",
        kind: "contentType",
        name: "Person",
      },
    ],
    snapshotId: "initial",
  }),
  queryEntries = [
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
  queryInput = {
    contentTypeId: "post",
    pageSize: 1,
    projection: ["title"],
    sort: [{ direction: "ascending", path: "rank" }],
    where: { operator: "equals", path: "status", value: "published" },
  } as const;

test("EntryQuery.evaluate filters, sorts, projects, and cursor-paginates Entries", () => {
  const firstPage = EntryQuery.evaluate({
    entries: queryEntries,
    options: { generation: 4 },
    query: queryInput,
    snapshot: baseSnapshot,
  });
  expect(firstPage.items).toEqual([
    { contentTypeId: "post", id: "post-a", values: { title: "First" } },
  ]);
  expect(firstPage.nextCursor).toBeString();
  expect(
    EntryQuery.evaluate({
      entries: queryEntries,
      options: { generation: 4 },
      query: { ...queryInput, cursor: firstPage.nextCursor },
      snapshot: baseSnapshot,
    }).items[firstItemIndex]?.id,
  ).toBe("post-c");
  expect(() =>
    EntryQuery.evaluate({
      entries: queryEntries,
      options: { generation: 5 },
      query: { ...queryInput, cursor: firstPage.nextCursor },
      snapshot: baseSnapshot,
    }),
  ).toThrow("stale");
});

test("EntryQuery.evaluate projects selected leaves from nested Field Groups", () => {
  const page = EntryQuery.evaluate({
    entries: [
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
    options: { generation: 1 },
    query: {
      contentTypeId: "person",
      pageSize: 10,
      projection: ["address.city"],
      where: { operator: "startsWith", path: "address.city", value: "P" },
    },
    snapshot: groupedSnapshot,
  });
  expect(page.items).toEqual([
    { contentTypeId: "person", id: "person-1", values: { address: { city: "Paris" } } },
  ]);
});
