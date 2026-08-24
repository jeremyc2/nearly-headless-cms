import { useMutation, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { DateTime, Effect } from "effect";
import { useEffect, useState } from "react";
import {
  activeStatusClass,
  relatedContentType,
  sortDirectionValue,
  sortLabel,
  statusOptions,
} from "./main-labels.ts";
import { displayName, stringValue } from "./main-entry-support.ts";
import { contentTypes, managementClient, queryClient } from "./main-shared.ts";

export const ContentList = () => {
  const { contentTypeId } = useParams({ from: "/content/$contentTypeId" }),
    contentType = contentTypes.find((candidate) => candidate.identifier === contentTypeId),
    navigate = useNavigate(),
    [filterText, setFilterText] = useState(""),
    [statusFilter, setStatusFilter] = useState("all"),
    [sortDirection, setSortDirection] = useState<"ascending" | "descending">("descending"),
    [cursor, setCursor] = useState<string>(),
    [priorCursors, setPriorCursors] = useState<readonly (string | undefined)[]>([]);
  let filterPath = "name";
  if (contentTypeId === "post") {
    filterPath = "title";
  } else if (contentTypeId === "comment") {
    filterPath = "display-name";
  }
  const predicates: { operator: string; path: string; value: string }[] = [];
  if (filterText.trim().length > 0) {
    predicates.push({ operator: "contains", path: filterPath, value: filterText.trim() });
  }
  if (statusFilter !== "all") {
    predicates.push({ operator: "equals", path: "status", value: statusFilter });
  }
  let sortPath = "name";
  if (contentTypeId === "comment") {
    sortPath = "created-at";
  } else if (contentTypeId === "post") {
    sortPath = "published-at";
  }
  const queryOptions = {
    pageSize: 20,
    sort: [{ direction: sortDirection, path: sortPath }],
  } as {
    cursor?: string;
    pageSize: number;
    sort: readonly { direction: "ascending" | "descending"; path: string }[];
    where?: unknown;
  };
  if (cursor !== undefined) {
    queryOptions.cursor = cursor;
  }
  if (predicates.length === 1) {
    queryOptions.where = predicates[0];
  } else if (predicates.length > 1) {
    queryOptions.where = { all: predicates };
  }
  const entries = useQuery({
      queryFn: () => Effect.runPromise(managementClient.queryEntries(contentTypeId, queryOptions)),
      queryKey: ["entries", contentTypeId, cursor, filterText, sortDirection, statusFilter],
    }),
    createEntry = useMutation({
      // oxlint-disable-next-line effecttsgo(async-function) -- React query mutation must bridge browser fetch.
      // oxlint-disable-next-line effecttsgo/async-function -- entry creation sequences dependent requests.
      mutationFn: async () => {
        // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- browser UI labels need a synchronous local identifier.
        const suffix = crypto.randomUUID().slice(0, 8),
          relatedContentTypeId = relatedContentType(contentTypeId);
        let related: { items: readonly { id: string }[] } | undefined;
        if (contentTypeId === "post" || contentTypeId === "comment") {
          related = await Effect.runPromise(
            managementClient.queryEntries(relatedContentTypeId, { pageSize: 1 }),
          );
        }
        const relatedEntryId = related?.items[0]?.id;
        let values: Readonly<Record<string, unknown>>;
        if (contentTypeId === "post") {
          values = {
            author: relatedEntryId,
            body: {
              children: [{ children: [{ text: "", type: "text" }], type: "paragraph" }],
              format: "nearly-headless-cms/rich-text",
              version: 1,
            },
            categories: [],
            excerpt: "Draft excerpt",
            slug: `untitled-${suffix}`,
            status: "draft",
            tags: [],
            title: `Untitled ${suffix}`,
          };
        } else if (contentTypeId === "author") {
          values = {
            biography: "Biography to be completed.",
            "external-links": [],
            name: `Untitled ${suffix}`,
            slug: `untitled-${suffix}`,
          };
        } else if (contentTypeId === "comment") {
          values = {
            body: "Comment awaiting editing.",
            "created-at": DateTime.formatIso(DateTime.nowUnsafe()),
            "display-name": `Reader ${suffix}`,
            post: relatedEntryId,
            status: "pending",
          };
        } else {
          values = { name: `Untitled ${suffix}`, slug: `untitled-${suffix}` };
        }
        if (
          relatedEntryId === undefined &&
          (contentTypeId === "post" || contentTypeId === "comment")
        ) {
          throw new Error(`Create a ${relatedContentTypeId} before creating this Entry`);
        }
        return Effect.runPromise(managementClient.createEntry(contentTypeId, values));
      },
      // oxlint-disable-next-line effecttsgo(async-function) -- React query callback sequences invalidation before navigation.
      // oxlint-disable-next-line effecttsgo/async-function -- cache invalidation must remain sequential.
      onSuccess: async (result) => {
        let entry;
        if ("entry" in result) {
          entry = result.entry;
        } else {
          entry = result;
        }
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await navigate({
          params: { contentTypeId, entryId: entry.id },
          to: "/content/$contentTypeId/$entryId",
        });
      },
    });
  useEffect(() => {
    setCursor(undefined);
    setPriorCursors([]);
  }, [contentTypeId, filterText, sortDirection, statusFilter]);
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Content</p>
          <h1>{contentType?.label ?? contentTypeId}</h1>
          <p>Manage complete Entries through the active Content Definition.</p>
        </div>
        <button
          className="primary-button"
          disabled={createEntry.isPending}
          onClick={() => {
            createEntry.mutate();
          }}
        >
          New {contentType?.label.slice(0, -1)}
        </button>
      </header>
      {createEntry.error && (
        <p className="error-state" role="alert">
          {createEntry.error.message}
        </p>
      )}
      <section className="panel list-panel">
        <div className="list-tools">
          <label>
            <span className="visually-hidden">Filter entries</span>
            <input
              value={filterText}
              onChange={(event) => {
                setFilterText(event.target.value);
              }}
              placeholder={`Filter ${contentType?.label.toLowerCase() ?? "entries"}`}
            />
          </label>
          {(contentTypeId === "post" || contentTypeId === "comment") && (
            <label>
              <span className="visually-hidden">Filter by status</span>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(event) => {
                  setStatusFilter(event.target.value);
                }}
              >
                <option value="all">Status: all</option>
                {statusOptions(contentTypeId).map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
          )}
          <label>
            <span className="visually-hidden">Sort entries</span>
            <select
              aria-label="Sort entries"
              value={sortDirection}
              onChange={(event) => {
                setSortDirection(sortDirectionValue(event.target.value));
              }}
            >
              <option value="descending">{sortLabel(contentTypeId, true)}</option>
              <option value="ascending">{sortLabel(contentTypeId, false)}</option>
            </select>
          </label>
        </div>
        {entries.isLoading && <p className="empty-state">Loading Entries…</p>}
        {entries.error && <p className="error-state">{entries.error.message}</p>}
        <div className="entry-list">
          {entries.data?.items.map((entry) => (
            <Link
              key={entry.id}
              className="entry-row"
              to="/content/$contentTypeId/$entryId"
              params={{ contentTypeId, entryId: entry.id }}
            >
              <span className="entry-monogram">{displayName(entry).slice(0, 1)}</span>
              <span className="entry-title">
                <strong>{displayName(entry)}</strong>
                <small>
                  {stringValue(entry.values["slug"] ?? entry.values["status"], entry.id)}
                </small>
              </span>
              <span className={`status-pill ${activeStatusClass(entry.values["status"])}`}>
                {stringValue(entry.values["status"], "active")}
              </span>
              <span>→</span>
            </Link>
          ))}
        </div>
        <nav className="pagination" aria-label="Entry pages">
          <button
            className="secondary-button"
            type="button"
            disabled={priorCursors.length === 0}
            onClick={() => {
              const previousCursor = priorCursors.at(-1);
              setPriorCursors((current) => current.slice(0, -1));
              setCursor(previousCursor);
            }}
          >
            Previous
          </button>
          <span>Page {priorCursors.length + 1}</span>
          <button
            className="secondary-button"
            type="button"
            disabled={entries.data?.nextCursor === undefined}
            onClick={() => {
              if (entries.data?.nextCursor !== undefined) {
                setPriorCursors((current) => [...current, cursor]);
                setCursor(entries.data.nextCursor);
              }
            }}
          >
            Next
          </button>
        </nav>
      </section>
    </div>
  );
}
