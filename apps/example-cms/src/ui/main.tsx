import {
  QueryClient,
  QueryClientProvider,
  useMutation,
  useQueries,
  useQuery,
} from "@tanstack/react-query";
import {
  Link,
  Outlet,
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
  useNavigate,
  useParams,
} from "@tanstack/react-router";
import { Effect } from "effect";
import { type MouseEvent, StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { RichText } from "nearly-headless-cms";
import {
  type AssetRepresentation,
  type EntryRepresentation,
  ManagementClientFailure,
  makeManagementClient,
} from "../generated/management-client.ts";
import { BrowserAdapter, RichTextEditor } from "./rich-text-editor/index.ts";
import "./styles.css";

const managementClient = makeManagementClient(),
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, staleTime: 10_000 } },
  }),
  contentTypes = [
    { identifier: "post", label: "Posts", symbol: "P" },
    { identifier: "author", label: "Authors", symbol: "A" },
    { identifier: "category", label: "Categories", symbol: "C" },
    { identifier: "tag", label: "Tags", symbol: "T" },
    { identifier: "comment", label: "Comments", symbol: "M" },
  ] as const,
  preserveSelection = (event: MouseEvent<HTMLButtonElement>): void => {
    event.preventDefault();
  },
  richTextDocumentFrom = (value: unknown): RichText.Document | undefined => {
    try {
      return RichText.validate(value);
    } catch {
      return undefined;
    }
  };

function rebuildLabel(isPending: boolean): string {
  if (isPending) {
    return "Building…";
  }
  return "Rebuild demonstration";
}

function draftPluralSuffix(count: number): string {
  if (count === 1) {
    return "";
  }
  return "s";
}

function pendingCommentClass(count: number): string {
  if (count > 0) {
    return "attention";
  }
  return "";
}

function Workbench() {
  const pendingComments = useQuery({
    queryFn: async () =>
      Effect.runPromise(
        managementClient.queryEntries("comment", {
          pageSize: 100,
          where: { operator: "equals", path: "status", value: "pending" },
        }),
      ),
    queryKey: ["navigation", "pending-comments"],
  });
  return (
    <div className="workbench">
      <aside className="navigation" aria-label="Content navigation">
        <Link className="brand" to="/" aria-label="Nearly Headless CMS overview">
          <span className="brand-mark">N</span>
          <span>
            <strong>Nearly</strong>
            <small>Headless CMS</small>
          </span>
        </Link>
        <nav>
          <p className="navigation-label">Workbench</p>
          <Link to="/" activeOptions={{ exact: true }} className="navigation-link">
            <span className="navigation-symbol">⌂</span>
            <span>Overview</span>
          </Link>
          <p className="navigation-label">Content</p>
          {contentTypes.map((contentType) => (
            <Link
              key={contentType.identifier}
              to="/content/$contentTypeId"
              params={{ contentTypeId: contentType.identifier }}
              className="navigation-link"
            >
              <span className="navigation-symbol">{contentType.symbol}</span>
              <span>{contentType.label}</span>
              {contentType.identifier === "comment" &&
                (pendingComments.data?.items.length ?? 0) > 0 && (
                  <span className="count-badge">{pendingComments.data?.items.length}</span>
                )}
            </Link>
          ))}
          <Link to="/assets" className="navigation-link">
            <span className="navigation-symbol">◫</span>
            <span>Assets</span>
          </Link>
        </nav>
        <div className="navigation-footer">
          <span className="open-dot" /> Open-access CMS
        </div>
      </aside>
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function Overview() {
  const queries = useQueries({
      queries: contentTypes.map((contentType) => ({
        queryFn: async () =>
          Effect.runPromise(
            managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
          ),
        queryKey: ["count", contentType.identifier],
      })),
    }),
    assets = useQuery({
      queryFn: async () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    counts = Object.fromEntries(
      contentTypes.map((contentType, index) => [
        contentType.identifier,
        queries[index]?.data?.items.length ?? "—",
      ]),
    ),
    posts = queries[0]?.data?.items ?? [],
    comments = queries[4]?.data?.items ?? [],
    draftPostCount = posts.filter((post) => post.values["status"] === "draft").length,
    pendingCommentCount = comments.filter(
      (comment) => comment.values["status"] === "pending",
    ).length,
    recentCandidates = queries.flatMap((query) => query.data?.items ?? []).slice(0, 12),
    recentRevisionQueries = useQueries({
      queries: recentCandidates.map((entry) => ({
        queryFn: async () =>
          Effect.runPromise(managementClient.listRevisions(entry.contentTypeId, entry.id)),
        queryKey: ["overview-revisions", entry.contentTypeId, entry.id],
      })),
    }),
    recentEntries = recentCandidates
      .map((entry, index) => ({
        entry,
        recordedAt: recentRevisionQueries[index]?.data?.items[0]?.recordedAt,
      }))
      .filter(
        (
          candidate,
        ): candidate is { readonly entry: EntryRepresentation; readonly recordedAt: string } =>
          candidate.recordedAt !== undefined,
      )
      .toSorted((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .slice(0, 5),
    today = new Intl.DateTimeFormat(undefined, {
      dateStyle: "full",
    }).format(new Date()),
    rebuild = useMutation({
      mutationFn: async () => {
        const response = await fetch("/development/rebuild", { method: "POST" });
        if (!response.ok) {
          throw new Error("The demonstration build could not be started");
        }
        return response.text();
      },
    });
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{today}</p>
          <h1>Good afternoon</h1>
          <p>Your content is calm. Two things could use your attention.</p>
        </div>
        <a className="secondary-button" href="/api/v1/headless/openapi.json">
          Headless API
        </a>
      </header>
      <section className="signal-grid" aria-label="Overview counters">
        <article className="signal-card accent">
          <span className="signal-icon">✦</span>
          <div>
            <strong>{counts["post"]}</strong>
            <span>Posts</span>
          </div>
          <small>
            {draftPostCount} draft{draftPluralSuffix(draftPostCount)}
          </small>
        </article>
        <article className="signal-card">
          <span className="signal-icon">☵</span>
          <div>
            <strong>{counts["comment"]}</strong>
            <span>Comments</span>
          </div>
          <small className={pendingCommentClass(pendingCommentCount)}>
            {pendingCommentCount} pending
          </small>
        </article>
        <article className="signal-card">
          <span className="signal-icon">◫</span>
          <div>
            <strong>{assets.data?.length ?? "—"}</strong>
            <span>Assets</span>
          </div>
          <small>All healthy</small>
        </article>
        <article className="signal-card">
          <span className="signal-icon">↗</span>
          <div>
            <strong>v1</strong>
            <span>Public build</span>
          </div>
          <small>CMS has newer content</small>
        </article>
      </section>
      <div className="overview-grid">
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Needs attention</p>
              <h2>Focused queues</h2>
            </div>
          </div>
          <Link
            className="queue-row"
            to="/content/$contentTypeId"
            params={{ contentTypeId: "comment" }}
          >
            <span className="queue-symbol amber">M</span>
            <span>
              <strong>Moderate a new comment</strong>
              <small>Oldest pending submission is ready to review</small>
            </span>
            <span>→</span>
          </Link>
          <Link
            className="queue-row"
            to="/content/$contentTypeId"
            params={{ contentTypeId: "post" }}
          >
            <span className="queue-symbol green">P</span>
            <span>
              <strong>Finish “The Unfinished Map”</strong>
              <small>Draft saved in the CMS, not visible publicly</small>
            </span>
            <span>→</span>
          </Link>
        </section>
        <section className="panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Static boundary</p>
              <h2>Public Blog build</h2>
            </div>
            <span className="status-pill">Needs refresh</span>
          </div>
          <div className="build-card">
            <div className="build-orbit">
              <span>CMS</span>
              <i />
              <span>Blog</span>
            </div>
            <p>Published content becomes visible together at the next successful static refresh.</p>
            <button
              className="primary-button"
              type="button"
              disabled={rebuild.isPending}
              onClick={() => {
                rebuild.mutate();
              }}
            >
              {rebuildLabel(rebuild.isPending)}
            </button>
            {rebuild.isSuccess && <p role="status">The Public Blog static build completed.</p>}
            {rebuild.error && (
              <p role="alert" className="error-state">
                {rebuild.error.message}
              </p>
            )}
          </div>
        </section>
      </div>
      <section className="panel recent-panel" aria-labelledby="recently-edited-heading">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">History</p>
            <h2 id="recently-edited-heading">Recently edited content</h2>
          </div>
        </div>
        {recentEntries.length === 0 && <p className="empty-state">Loading recent revisions…</p>}
        <div className="entry-list">
          {recentEntries.map(({ entry, recordedAt }) => (
            <Link
              className="entry-row"
              key={entry.id}
              params={{ contentTypeId: entry.contentTypeId, entryId: entry.id }}
              to="/content/$contentTypeId/$entryId"
            >
              <span className="entry-monogram">{displayName(entry).slice(0, 1)}</span>
              <span className="entry-title">
                <strong>{displayName(entry)}</strong>
                <small>
                  {entry.contentTypeId} · {new Date(recordedAt).toLocaleString()}
                </small>
              </span>
              <span>→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

const stringValue = (value: unknown, fallback: string): string => {
    if (typeof value === "string") {
      return value;
    }
    return fallback;
  },
  suggestedSlug = (value: string): string =>
    value
      .normalize("NFKD")
      .toLocaleLowerCase()
      .replaceAll(/[^a-z0-9]+/gu, "-")
      .replaceAll(/^-|-$/gu, ""),
  displayName = (entry: EntryRepresentation): string =>
    stringValue(
      entry.values["title"] ?? entry.values["name"] ?? entry.values["display-name"],
      entry.id,
    );

interface EditorialIssue {
  readonly path: readonly (string | number)[];
  readonly reason: string;
}

const editorialIssues = (error: unknown): readonly EditorialIssue[] => {
    if (
      !(error instanceof ManagementClientFailure) ||
      error.details === null ||
      typeof error.details !== "object"
    ) {
      return [];
    }
    const candidates = Reflect.get(error.details, "issues");
    if (!Array.isArray(candidates)) {
      return [];
    }
    return candidates.flatMap((candidate) => {
      if (candidate === null || typeof candidate !== "object") {
        return [];
      }
      const path = Reflect.get(candidate, "path"),
        reason = Reflect.get(candidate, "reason");
      if (Array.isArray(path) && typeof reason === "string") {
        return [{ path, reason }];
      }
      return [];
    });
  },
  isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  deletionRecordFrom = (
    value: unknown,
  ):
    | {
        readonly contentTypeId: string;
        readonly entryId: string;
        readonly writeToken: string;
      }
    | undefined => {
    let candidate = value;
    if (isRecord(value) && isRecord(value["deletionRecord"])) {
      candidate = value["deletionRecord"];
    }
    if (
      isRecord(candidate) &&
      typeof candidate["contentTypeId"] === "string" &&
      typeof candidate["entryId"] === "string" &&
      typeof candidate["writeToken"] === "string"
    ) {
      return {
        contentTypeId: candidate["contentTypeId"],
        entryId: candidate["entryId"],
        writeToken: candidate["writeToken"],
      };
    }
    return undefined;
  },
  deletionConsequence = (contentTypeId: string): string => {
    switch (contentTypeId) {
      case "post": {
        return "This also deletes every Comment associated with the Post.";
      }
      case "author": {
        return "This also deletes the Author’s Posts and every Comment associated with them.";
      }
      case "category": {
        return "This detaches the Category from every Post before deleting it.";
      }
      case "tag": {
        return "This detaches the Tag from every Post before deleting it.";
      }
      default: {
        return "This removes the Entry from live content.";
      }
    }
  };

function ContentList() {
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
  const predicates = [
    ...(filterText.trim().length === 0
      ? []
      : [{ operator: "contains", path: filterPath, value: filterText.trim() }]),
    ...(statusFilter === "all"
      ? []
      : [{ operator: "equals", path: "status", value: statusFilter }]),
  ];
  let sortPath = "name";
  if (contentTypeId === "comment") {
    sortPath = "created-at";
  } else if (contentTypeId === "post") {
    sortPath = "published-at";
  }
  const entries = useQuery({
      queryFn: async () =>
        Effect.runPromise(
          managementClient.queryEntries(contentTypeId, {
            ...(cursor === undefined ? {} : { cursor }),
            pageSize: 20,
            sort: [{ direction: sortDirection, path: sortPath }],
            ...(predicates.length === 0
              ? {}
              : { where: predicates.length === 1 ? predicates[0] : { all: predicates } }),
          }),
        ),
      queryKey: ["entries", contentTypeId, cursor, filterText, sortDirection, statusFilter],
    }),
    createEntry = useMutation({
      mutationFn: async () => {
        const suffix = crypto.randomUUID().slice(0, 8),
          relatedContentTypeId = contentTypeId === "comment" ? "post" : "author",
          related =
            contentTypeId === "post" || contentTypeId === "comment"
              ? await Effect.runPromise(
                  managementClient.queryEntries(relatedContentTypeId, { pageSize: 1 }),
                )
              : undefined,
          relatedEntryId = related?.items[0]?.id;
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
            "created-at": new Date().toISOString(),
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
      onSuccess: async (result) => {
        const entry = "entry" in result ? result.entry : result;
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
                {(contentTypeId === "post"
                  ? ["draft", "published"]
                  : ["pending", "approved", "rejected"]
                ).map((status) => (
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
                setSortDirection(event.target.value === "ascending" ? "ascending" : "descending");
              }}
            >
              <option value="descending">
                {contentTypeId === "post" || contentTypeId === "comment"
                  ? "Newest first"
                  : "Name Z–A"}
              </option>
              <option value="ascending">
                {contentTypeId === "post" || contentTypeId === "comment"
                  ? "Oldest first"
                  : "Name A–Z"}
              </option>
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
              <span
                className={`status-pill ${entry.values["status"] === "published" || entry.values["status"] === "approved" ? "published" : ""}`}
              >
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

function EntryEditor() {
  const { contentTypeId, entryId } = useParams({ from: "/content/$contentTypeId/$entryId" }),
    navigate = useNavigate(),
    state = useQuery({
      queryFn: async () =>
        Effect.runPromise(managementClient.getCurrentState(contentTypeId, entryId)),
      queryKey: ["entry-state", contentTypeId, entryId],
    }),
    authors = useQuery({
      enabled: contentTypeId === "post",
      queryFn: async () =>
        Effect.runPromise(managementClient.queryEntries("author", { pageSize: 100 })),
      queryKey: ["relationship-options", "author"],
    }),
    categories = useQuery({
      enabled: contentTypeId === "post",
      queryFn: async () =>
        Effect.runPromise(managementClient.queryEntries("category", { pageSize: 100 })),
      queryKey: ["relationship-options", "category"],
    }),
    tags = useQuery({
      enabled: contentTypeId === "post",
      queryFn: async () =>
        Effect.runPromise(managementClient.queryEntries("tag", { pageSize: 100 })),
      queryKey: ["relationship-options", "tag"],
    }),
    assets = useQuery({
      enabled: contentTypeId === "post" || contentTypeId === "author",
      queryFn: async () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    loadedEntryIdentifier = useRef<string | null>(null),
    [values, setValues] = useState<Record<string, unknown>>({}),
    [confirmDeletion, setConfirmDeletion] = useState(false),
    [confirmPurge, setConfirmPurge] = useState(false),
    [editorialConfirmation, setEditorialConfirmation] = useState<
      "draft" | "published" | "approved" | "rejected"
    >(),
    [deletionRecord, setDeletionRecord] = useState<{
      readonly contentTypeId: string;
      readonly entryId: string;
      readonly writeToken: string;
    }>(),
    [conflict, setConflict] = useState<
      | {
          readonly latest: {
            readonly entry: EntryRepresentation;
            readonly revisionNumber: number;
            readonly writeToken: string;
          };
        }
      | undefined
    >();
  useEffect(() => {
    if (state.data !== undefined && loadedEntryIdentifier.current !== entryId) {
      loadedEntryIdentifier.current = entryId;
      setValues(structuredClone(state.data.entry.values));
      setConflict(undefined);
    }
  }, [entryId, state.data]);
  const save = useMutation({
      mutationFn: async ({
        replacementValues,
        writeToken,
      }: {
        readonly replacementValues: Readonly<Record<string, unknown>>;
        readonly writeToken?: string;
      }) =>
        Effect.runPromise(
          managementClient.replaceEntry({
            contentTypeId,
            entryId,
            values: replacementValues,
            writeToken,
          }),
        ),
      onError: async (error) => {
        if (error instanceof ManagementClientFailure && error.status === 409) {
          const latest = await Effect.runPromise(
            managementClient.getCurrentState(contentTypeId, entryId),
          );
          setConflict({ latest });
        }
      },
      onSuccess: async (result) => {
        const updatedState = "entry" in result ? result : { entry: result };
        setValues(structuredClone(updatedState.entry.values));
        setConflict(undefined);
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] });
      },
    }),
    editorialCommand = useMutation({
      mutationFn: async (status: "draft" | "published" | "approved" | "rejected") => {
        if (state.data === undefined || (contentTypeId !== "post" && contentTypeId !== "comment")) {
          throw new Error("Current Entry state is unavailable");
        }
        return Effect.runPromise(
          managementClient.runEditorialCommand({
            contentTypeId,
            entryId,
            status,
            writeToken: state.data.writeToken,
          }),
        );
      },
      onSuccess: async (result) => {
        setValues(structuredClone(result.entry.values));
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    }),
    deleteEntry = useMutation({
      mutationFn: async () => {
        if (
          state.data === undefined ||
          (contentTypeId !== "post" &&
            contentTypeId !== "author" &&
            contentTypeId !== "category" &&
            contentTypeId !== "tag" &&
            contentTypeId !== "comment")
        ) {
          throw new Error("Current Entry deletion state is unavailable");
        }
        const outcome = await Effect.runPromise(
            managementClient.deleteContentEntry(contentTypeId, entryId, state.data.writeToken),
          ),
          receipt = deletionRecordFrom(outcome);
        if (receipt === undefined) {
          throw new Error("The deletion did not return a retained deletion record");
        }
        return receipt;
      },
      onSuccess: async (receipt) => {
        setConfirmDeletion(false);
        setDeletionRecord(receipt);
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["navigation"] });
      },
    }),
    permanentlyPurge = useMutation({
      mutationFn: async () => {
        if (deletionRecord === undefined) {
          throw new Error("Deletion record is unavailable");
        }
        return Effect.runPromise(
          managementClient.permanentlyPurgeEntry(
            deletionRecord.contentTypeId,
            deletionRecord.entryId,
            deletionRecord.writeToken,
          ),
        );
      },
      onSuccess: async () => {
        await navigate({ params: { contentTypeId }, to: "/content/$contentTypeId" });
      },
    });
  let titleField = "display-name";
  if ("title" in values) {
    titleField = "title";
  } else if ("name" in values) {
    titleField = "name";
  }
  const title = stringValue(values[titleField], ""),
    bodyDocument = richTextDocumentFrom(values["body"]),
    profileDocument = richTextDocumentFrom(values["profile"]),
    updateField = (key: string, value: unknown) => {
      setValues((current) => {
        const replacement = { ...current, [key]: value };
        if (
          (key === "title" || key === "name") &&
          typeof value === "string" &&
          typeof current["slug"] === "string" &&
          (current["slug"] === suggestedSlug(stringValue(current[key], "")) ||
            current["slug"].startsWith("untitled-"))
        ) {
          return { ...replacement, slug: suggestedSlug(value) };
        }
        return replacement;
      });
    },
    saveValues = (replacementValues = values, writeToken = state.data?.writeToken) => {
      save.mutate({ replacementValues, writeToken });
    },
    setEditorialStatus = (status: "draft" | "published" | "approved" | "rejected") => {
      editorialCommand.mutate(status);
    };
  return (
    <div className="page editor-page">
      <header className="editor-header">
        <div>
          <Link to="/content/$contentTypeId" params={{ contentTypeId }} className="back-link">
            ← {contentTypeId}
          </Link>
          <h1>{title || "Entry"}</h1>
          <p>
            <span className="saved-dot" /> {save.isPending ? "Saving…" : "Saved in CMS"} · Revision{" "}
            {state.data?.revisionNumber ?? "—"}
          </p>
        </div>
        <div className="editor-actions">
          <button className="secondary-button" type="button">
            Preview readiness
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={save.isPending || state.data === undefined}
            onClick={() => {
              saveValues();
            }}
          >
            Save changes
          </button>
        </div>
      </header>
      {save.error && (
        <p className="error-state" role="alert">
          {save.error.message}
        </p>
      )}
      {conflict !== undefined && (
        <section className="conflict-panel" role="alert" aria-labelledby="conflict-title">
          <div>
            <p className="eyebrow">Conflict</p>
            <h2 id="conflict-title">A newer CMS revision exists</h2>
            <p>
              Your complete local draft is preserved. Compare it with revision{" "}
              {conflict.latest.revisionNumber}, then deliberately reapply or discard it.
            </p>
          </div>
          <div className="conflict-comparison">
            <details>
              <summary>Your local draft</summary>
              <pre>{JSON.stringify(values, null, 2)}</pre>
            </details>
            <details>
              <summary>Latest CMS revision</summary>
              <pre>{JSON.stringify(conflict.latest.entry.values, null, 2)}</pre>
            </details>
          </div>
          <div className="editor-actions">
            <button
              className="primary-button"
              type="button"
              disabled={save.isPending}
              onClick={() => {
                saveValues(values, conflict.latest.writeToken);
              }}
            >
              Reapply my draft
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setValues(structuredClone(conflict.latest.entry.values));
                queryClient.setQueryData(["entry-state", contentTypeId, entryId], conflict.latest);
                setConflict(undefined);
              }}
            >
              Discard my draft
            </button>
          </div>
        </section>
      )}
      {state.isLoading ? (
        <p>Loading current state…</p>
      ) : (
        <div className="editor-layout">
          <section className="story-canvas panel">
            <p className="eyebrow">Story canvas</p>
            <label className="field full">
              <span>Title or name</span>
              <input
                value={title}
                onChange={(event) => {
                  updateField(titleField, event.target.value);
                }}
              />
            </label>
            {"slug" in values && (
              <div className="field">
                <label htmlFor="entry-slug">Slug</label>
                <input
                  id="entry-slug"
                  value={String(values["slug"])}
                  onChange={(event) => {
                    updateField("slug", event.target.value);
                  }}
                />
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    updateField("slug", suggestedSlug(title));
                  }}
                >
                  Suggest from title or name
                </button>
              </div>
            )}
            {"excerpt" in values && (
              <label className="field full">
                <span>Excerpt</span>
                <textarea
                  value={String(values["excerpt"])}
                  onChange={(event) => {
                    updateField("excerpt", event.target.value);
                  }}
                  rows={4}
                />
              </label>
            )}
            {"biography" in values && (
              <label className="field full">
                <span>Short biography</span>
                <textarea
                  value={stringValue(values["biography"], "")}
                  onChange={(event) => {
                    updateField("biography", event.target.value);
                  }}
                  rows={5}
                />
              </label>
            )}
            {"description" in values && (
              <label className="field full">
                <span>Description</span>
                <textarea
                  value={stringValue(values["description"], "")}
                  onChange={(event) => {
                    updateField("description", event.target.value || null);
                  }}
                  rows={4}
                />
              </label>
            )}
            {"body" in values && typeof values["body"] === "string" && (
              <label className="field full">
                <span>Body</span>
                <textarea
                  value={values["body"]}
                  onChange={(event) => {
                    updateField("body", event.target.value);
                  }}
                  rows={8}
                />
              </label>
            )}
            {bodyDocument !== undefined && (
              <RichTextField
                value={bodyDocument}
                onChange={(document) => {
                  updateField("body", document);
                }}
              />
            )}
            {profileDocument !== undefined && (
              <div className="field full">
                <span>Author profile</span>
                <RichTextField
                  value={profileDocument}
                  onChange={(document) => {
                    updateField("profile", document);
                  }}
                />
              </div>
            )}
            {contentTypeId === "post" && (
              <fieldset className="field-group full">
                <legend>Featured image</legend>
                <label className="field">
                  <span>Immutable Asset</span>
                  <select
                    value={
                      typeof values["featured-asset"] === "string" ? values["featured-asset"] : ""
                    }
                    onChange={(event) => {
                      const assetIdentifier = event.target.value,
                        selectedAsset = assets.data?.find(
                          (candidate) => candidate.id === assetIdentifier,
                        );
                      updateField("featured-asset", assetIdentifier || null);
                      if (
                        selectedAsset?.metadata.defaultAlternativeText !== undefined &&
                        !values["featured-alternative-text"]
                      ) {
                        updateField(
                          "featured-alternative-text",
                          selectedAsset.metadata.defaultAlternativeText,
                        );
                      }
                    }}
                  >
                    <option value="">No featured Asset</option>
                    {assets.data?.map((asset) => (
                      <option value={asset.id} key={asset.id}>
                        {asset.metadata.filename} · {asset.metadata.mediaType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  <span>Featured image alternative text</span>
                  <input
                    id="field-featured-alternative-text"
                    value={stringValue(values["featured-alternative-text"], "")}
                    onChange={(event) => {
                      updateField("featured-alternative-text", event.target.value || null);
                    }}
                  />
                </label>
                {typeof values["featured-asset"] === "string" && (
                  <p className="field-help">
                    {assets.data?.find((asset) => asset.id === values["featured-asset"])?.metadata
                      .filename ?? "Selected immutable Asset"}
                  </p>
                )}
              </fieldset>
            )}
            {contentTypeId === "author" && (
              <fieldset className="field-group full">
                <legend>Portrait</legend>
                <label className="field">
                  <span>Immutable Asset</span>
                  <select
                    value={typeof values["portrait"] === "string" ? values["portrait"] : ""}
                    onChange={(event) => {
                      updateField("portrait", event.target.value || null);
                    }}
                  >
                    <option value="">No portrait</option>
                    {assets.data?.map((asset) => (
                      <option value={asset.id} key={asset.id}>
                        {asset.metadata.filename}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  <span>Portrait alternative text</span>
                  <input
                    value={stringValue(values["portrait-alternative-text"], "")}
                    onChange={(event) => {
                      updateField("portrait-alternative-text", event.target.value || null);
                    }}
                  />
                </label>
              </fieldset>
            )}
          </section>
          <aside className="editor-sidebar">
            <section className="panel">
              <p className="eyebrow">Publication</p>
              <h2>CMS state</h2>
              {contentTypeId === "post" && (
                <>
                  <label className="field">
                    <span>Author</span>
                    <select
                      value={stringValue(values["author"], "")}
                      onChange={(event) => {
                        updateField("author", event.target.value);
                      }}
                    >
                      {authors.data?.items.map((author) => (
                        <option value={author.id} key={author.id}>
                          {displayName(author)}
                        </option>
                      ))}
                    </select>
                    <small>The Author describes the content; it is not a login identity.</small>
                  </label>
                  <label className="field">
                    <span>Categories</span>
                    <select
                      multiple
                      value={
                        Array.isArray(values["categories"]) ? values["categories"].map(String) : []
                      }
                      onChange={(event) => {
                        updateField(
                          "categories",
                          [...event.currentTarget.selectedOptions].map((option) => option.value),
                        );
                      }}
                    >
                      {categories.data?.items.map((category) => (
                        <option value={category.id} key={category.id}>
                          {displayName(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <select
                      multiple
                      value={Array.isArray(values["tags"]) ? values["tags"].map(String) : []}
                      onChange={(event) => {
                        updateField(
                          "tags",
                          [...event.currentTarget.selectedOptions].map((option) => option.value),
                        );
                      }}
                    >
                      {tags.data?.items.map((tag) => (
                        <option value={tag.id} key={tag.id}>
                          {displayName(tag)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Publication time</span>
                    <input
                      type="datetime-local"
                      value={
                        typeof values["published-at"] === "string"
                          ? values["published-at"].slice(0, 16)
                          : ""
                      }
                      onChange={(event) => {
                        updateField(
                          "published-at",
                          event.target.value === ""
                            ? null
                            : new Date(event.target.value).toISOString(),
                        );
                      }}
                    />
                  </label>
                </>
              )}
              {"status" in values && (
                <div className="field">
                  <span>Status</span>
                  <output className="status-readout">
                    {stringValue(values["status"], "active")}
                  </output>
                  <small>Status changes only through the explicit editorial command below.</small>
                </div>
              )}
              <p className="boundary-note">
                Saving changes the CMS. Publishing makes a Post eligible for the next static build.
              </p>
              {editorialCommand.error && (
                <div className="error-state issue-summary" role="alert">
                  <strong>{editorialCommand.error.message}</strong>
                  {editorialIssues(editorialCommand.error).length > 0 && (
                    <ul>
                      {editorialIssues(editorialCommand.error).map((issue) => {
                        const rootField = String(issue.path[0] ?? "body"),
                          targetIdentifier =
                            rootField === "featured-alternative-text"
                              ? "field-featured-alternative-text"
                              : "field-body";
                        return (
                          <li key={`${issue.path.join(".")}-${issue.reason}`}>
                            <a href={`#${targetIdentifier}`}>
                              {issue.path.join(" → ")}: {issue.reason}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {contentTypeId === "post" && (
                <button
                  className="primary-button full-button"
                  disabled={editorialCommand.isPending}
                  type="button"
                  onClick={() => {
                    setEditorialConfirmation(
                      values["status"] === "published" ? "draft" : "published",
                    );
                  }}
                >
                  {values["status"] === "published" ? "Return to draft" : "Publish Post"}
                </button>
              )}
              {contentTypeId === "comment" && (
                <div className="editor-actions">
                  <button
                    className="primary-button"
                    disabled={editorialCommand.isPending}
                    type="button"
                    onClick={() => {
                      setEditorialConfirmation("approved");
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    disabled={editorialCommand.isPending}
                    type="button"
                    onClick={() => {
                      setEditorialConfirmation("rejected");
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </section>
            <HistoryPanel
              contentTypeId={contentTypeId}
              entryId={entryId}
              writeToken={state.data?.writeToken}
            />
            <section className="panel danger-panel">
              <p className="eyebrow">Danger zone</p>
              <h2>Delete this Entry</h2>
              <p>{deletionConsequence(contentTypeId)}</p>
              <button
                className="danger-button"
                type="button"
                disabled={deleteEntry.isPending || state.data === undefined}
                onClick={() => {
                  setConfirmDeletion(true);
                }}
              >
                Delete Entry…
              </button>
              {deleteEntry.error && (
                <p className="error-state" role="alert">
                  {deleteEntry.error.message}
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
      {editorialConfirmation !== undefined && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editorial-command-title"
          >
            <p className="eyebrow">Confirm editorial change</p>
            <h2 id="editorial-command-title">
              {editorialConfirmation === "published"
                ? "Publish this Post?"
                : editorialConfirmation === "draft"
                  ? "Return this Post to draft?"
                  : editorialConfirmation === "approved"
                    ? "Approve this Comment?"
                    : "Reject this Comment?"}
            </h2>
            <p>
              {editorialConfirmation === "published" || editorialConfirmation === "approved"
                ? "This content becomes public-eligible and appears after the next static refresh."
                : "This content stops being public-eligible; an existing static build changes only after refresh."}
            </p>
            <div className="editor-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditorialConfirmation(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={editorialCommand.isPending}
                onClick={() => {
                  setEditorialStatus(editorialConfirmation);
                  setEditorialConfirmation(undefined);
                }}
              >
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}
      {(confirmDeletion || deletionRecord !== undefined) && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog destructive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-deletion-title"
          >
            {deletionRecord === undefined ? (
              <>
                <p className="eyebrow">Confirm deletion</p>
                <h2 id="entry-deletion-title">Delete “{title || "this Entry"}”?</h2>
                <p>{deletionConsequence(contentTypeId)}</p>
                <p>The retained revisions can be restored until you permanently purge them.</p>
                <div className="editor-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setConfirmDeletion(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={deleteEntry.isPending}
                    onClick={() => {
                      deleteEntry.mutate();
                    }}
                  >
                    {deleteEntry.isPending ? "Deleting…" : "Delete Entry"}
                  </button>
                </div>
              </>
            ) : confirmPurge ? (
              <>
                <p className="eyebrow">Irreversible action</p>
                <h2 id="entry-deletion-title">Permanently purge retained history?</h2>
                <p>
                  This cannot be undone. Every retained revision and the restoration path vanish.
                </p>
                {permanentlyPurge.error && (
                  <p className="error-state" role="alert">
                    {permanentlyPurge.error.message}
                  </p>
                )}
                <div className="editor-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setConfirmPurge(false);
                    }}
                  >
                    Keep retained history
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={permanentlyPurge.isPending}
                    onClick={() => {
                      permanentlyPurge.mutate();
                    }}
                  >
                    {permanentlyPurge.isPending ? "Purging…" : "Permanently purge"}
                  </button>
                </div>
              </>
            ) : (
              <>
                <p className="eyebrow">Entry deleted</p>
                <h2 id="entry-deletion-title">The live Entry is gone</h2>
                <p>Its retained history remains available for restoration through the API.</p>
                <div className="editor-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      void navigate({ params: { contentTypeId }, to: "/content/$contentTypeId" });
                    }}
                  >
                    Return to list
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => {
                      setConfirmPurge(true);
                    }}
                  >
                    Permanently purge…
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function RichTextField({
  value,
  onChange,
}: {
  readonly value: RichText.Document;
  readonly onChange: (document: RichText.Document) => void;
}) {
  const host = useRef<HTMLDivElement>(null),
    toolbar = useRef<HTMLDivElement>(null),
    adapter = useRef<BrowserAdapter | null>(null),
    onChangeReference = useRef(onChange),
    initialValue = useMemo(() => value, []),
    [dialog, setDialog] = useState<
      | { readonly type: "link"; readonly label: string; readonly url: string }
      | { readonly type: "entry"; readonly entryId: string; readonly label: string }
      | {
          readonly type: "asset";
          readonly assetId: string;
          readonly alternativeText: string;
          readonly caption: string;
        }
    >(),
    assets = useQuery({
      queryFn: async () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    entryQueries = useQueries({
      queries: contentTypes.map((contentType) => ({
        queryFn: async () =>
          Effect.runPromise(
            managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
          ),
        queryKey: ["rich-text-entry-picker", contentType.identifier],
      })),
    }),
    entryOptions = contentTypes.flatMap((contentType, index) =>
      (entryQueries[index]?.data?.items ?? []).map((entry) => ({
        identifier: entry.id,
        label:
          typeof entry.values["title"] === "string"
            ? entry.values["title"]
            : typeof entry.values["name"] === "string"
              ? entry.values["name"]
              : entry.id,
        type: contentType.label,
      })),
    ),
    closeDialog = () => {
      setDialog(undefined);
      queueMicrotask(() => toolbar.current?.querySelector<HTMLButtonElement>("button")?.focus());
    };
  useEffect(() => {
    onChangeReference.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (host.current === null) {
      return;
    }
    const browserAdapter = new BrowserAdapter({
      host: host.current,
      initialState: RichTextEditor.create(initialValue),
      onChange: (document) => {
        onChangeReference.current(document);
      },
      onRequestLink: () => {
        setDialog({ label: "", type: "link", url: "" });
      },
    });
    adapter.current = browserAdapter;
    return () => {
      browserAdapter.destroy();
    };
  }, [initialValue]);
  return (
    <div className="rich-text-shell" id="field-body">
      <div ref={toolbar} className="rich-toolbar" role="toolbar" aria-label="Rich Text formatting">
        <label className="rich-block-picker">
          <span className="visually-hidden">Block type</span>
          <select
            aria-label="Block type"
            defaultValue="paragraph"
            onChange={(event) => {
              const blockType = event.target.value;
              if (
                blockType === "heading-2" ||
                blockType === "heading-3" ||
                blockType === "heading-4"
              ) {
                adapter.current?.dispatch({
                  blockType: "heading",
                  headingLevel:
                    Number(blockType.at(-1)) === 2 ? 2 : Number(blockType.at(-1)) === 3 ? 3 : 4,
                  type: "setBlockKind",
                });
              } else if (
                blockType === "paragraph" ||
                blockType === "quote" ||
                blockType === "code-block"
              ) {
                adapter.current?.dispatch({ blockType, type: "setBlockKind" });
              }
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="heading-2">Heading 2</option>
            <option value="heading-3">Heading 3</option>
            <option value="heading-4">Heading 4</option>
            <option value="quote">Quote</option>
            <option value="code-block">Code block</option>
          </select>
        </label>
        <button
          type="button"
          aria-label="Bold"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "bold", type: "toggleMark" })}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Italic"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "italic", type: "toggleMark" })}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          aria-label="Strikethrough"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "strikethrough", type: "toggleMark" })}
        >
          <s>S</s>
        </button>
        <button
          type="button"
          aria-label="Inline code"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "code", type: "toggleMark" })}
        >
          Code
        </button>
        <button
          type="button"
          aria-label="Unordered list"
          onMouseDown={preserveSelection}
          onClick={() =>
            adapter.current?.dispatch({ listType: "unordered-list", type: "toggleList" })
          }
        >
          • List
        </button>
        <button
          type="button"
          aria-label="Ordered list"
          onMouseDown={preserveSelection}
          onClick={() =>
            adapter.current?.dispatch({ listType: "ordered-list", type: "toggleList" })
          }
        >
          1. List
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => {
            setDialog({ label: "", type: "link", url: "" });
          }}
        >
          Link
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => {
            setDialog({ entryId: "", label: "", type: "entry" });
          }}
        >
          Entry reference
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => {
            setDialog({
              alternativeText: "",
              assetId: "",
              caption: "",
              type: "asset",
            });
          }}
        >
          Asset
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ type: "undo" })}
        >
          Undo
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ type: "redo" })}
        >
          Redo
        </button>
      </div>
      <div ref={host} className="rich-surface" aria-label="Rich Text content" />
      {dialog !== undefined && (
        <div
          className="rich-dialog-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeDialog();
            }
          }}
        >
          <div
            className="rich-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Insert ${dialog.type} reference`}
          >
            <h3>Insert {dialog.type === "entry" ? "Entry reference" : dialog.type}</h3>
            {dialog.type === "link" && (
              <>
                <label>
                  <span>URL</span>
                  <input
                    autoFocus
                    type="url"
                    value={dialog.url}
                    onChange={(event) => {
                      setDialog({ ...dialog, url: event.target.value });
                    }}
                  />
                </label>
                <label>
                  <span>Label for a collapsed selection</span>
                  <input
                    value={dialog.label}
                    onChange={(event) => {
                      setDialog({ ...dialog, label: event.target.value });
                    }}
                  />
                </label>
              </>
            )}
            {dialog.type === "entry" && (
              <>
                <label>
                  <span>Entry ID</span>
                  <select
                    autoFocus
                    value={dialog.entryId}
                    onChange={(event) => {
                      setDialog({ ...dialog, entryId: event.target.value });
                    }}
                  >
                    <option value="">Select an Entry</option>
                    {entryOptions.map((entry) => (
                      <option key={entry.identifier} value={entry.identifier}>
                        {entry.type} · {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Label for a collapsed selection</span>
                  <input
                    value={dialog.label}
                    onChange={(event) => {
                      setDialog({ ...dialog, label: event.target.value });
                    }}
                  />
                </label>
              </>
            )}
            {dialog.type === "asset" && (
              <>
                <label>
                  <span>Asset</span>
                  <select
                    autoFocus
                    value={dialog.assetId}
                    onChange={(event) => {
                      setDialog({ ...dialog, assetId: event.target.value });
                    }}
                  >
                    <option value="">Select an Asset</option>
                    {assets.data?.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.metadata.filename}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Alternative text</span>
                  <input
                    value={dialog.alternativeText}
                    onChange={(event) => {
                      setDialog({ ...dialog, alternativeText: event.target.value });
                    }}
                  />
                </label>
                <label>
                  <span>Caption (optional)</span>
                  <input
                    value={dialog.caption}
                    onChange={(event) => {
                      setDialog({ ...dialog, caption: event.target.value });
                    }}
                  />
                </label>
              </>
            )}
            <div className="editor-actions">
              <button className="secondary-button" type="button" onClick={closeDialog}>
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={
                  (dialog.type === "link" && dialog.url.length === 0) ||
                  (dialog.type === "entry" && dialog.entryId.length === 0) ||
                  (dialog.type === "asset" && dialog.assetId.length === 0)
                }
                onClick={() => {
                  if (dialog.type === "link") {
                    adapter.current?.dispatch({
                      label: dialog.label,
                      type: "wrapLink",
                      url: dialog.url,
                    });
                  } else if (dialog.type === "entry") {
                    adapter.current?.dispatch({
                      entryId: dialog.entryId,
                      label: dialog.label,
                      type: "insertEntryReference",
                    });
                  } else {
                    adapter.current?.dispatch({
                      alternativeText: dialog.alternativeText,
                      assetId: dialog.assetId,
                      ...(dialog.caption.length === 0 ? {} : { caption: dialog.caption }),
                      type: "insertAssetReference",
                    });
                  }
                  closeDialog();
                }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HistoryPanel({
  contentTypeId,
  entryId,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken?: string;
}) {
  const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<number>(),
    revisions = useQuery({
      queryFn: async () =>
        Effect.runPromise(managementClient.listRevisions(contentTypeId, entryId)),
      queryKey: ["revisions", contentTypeId, entryId],
    }),
    inspectedRevision = useQuery({
      enabled: selectedRevisionNumber !== undefined,
      queryFn: async () =>
        Effect.runPromise(
          managementClient.inspectRevision(contentTypeId, entryId, selectedRevisionNumber ?? 0),
        ),
      queryKey: ["revision", contentTypeId, entryId, selectedRevisionNumber],
    }),
    restore = useMutation({
      mutationFn: async (revisionNumber: number) => {
        if (writeToken === undefined) {
          throw new Error("Current Write Token is unavailable");
        }
        return Effect.runPromise(
          managementClient.restoreRevision({
            contentTypeId,
            entryId,
            revisionNumber,
            writeToken,
          }),
        );
      },
      onSuccess: async () => {
        setSelectedRevisionNumber(undefined);
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    });
  return (
    <section className="panel history-panel">
      <p className="eyebrow">History</p>
      <h2>Entry revisions</h2>
      {restore.error && (
        <p className="error-state" role="alert">
          {restore.error.message}
        </p>
      )}
      {revisions.data?.items.map((revision, index) => (
        <button
          className="revision-row"
          onClick={() => {
            setSelectedRevisionNumber(revision.revisionNumber);
          }}
          key={revision.revisionNumber}
        >
          <span className={index === 0 ? "revision-dot current" : "revision-dot"} />
          <span>
            <strong>Revision {revision.revisionNumber}</strong>
            <small>
              {index === 0 ? "Current · inspect · " : "Inspect · "}
              {new Date(revision.recordedAt).toLocaleString()}
            </small>
          </span>
        </button>
      ))}
      {selectedRevisionNumber !== undefined && (
        <div className="revision-inspection" role="dialog" aria-modal="true">
          <div className="revision-inspection-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Complete captured values</p>
                <h2>Revision {selectedRevisionNumber}</h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSelectedRevisionNumber(undefined);
                }}
              >
                Close
              </button>
            </div>
            {inspectedRevision.isLoading ? (
              <p>Loading revision…</p>
            ) : (
              <pre>{JSON.stringify(inspectedRevision.data?.values, null, 2)}</pre>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={restore.isPending || writeToken === undefined}
              onClick={() => {
                restore.mutate(selectedRevisionNumber);
              }}
            >
              Restore as a new revision
            </button>
          </div>
        </div>
      )}
    </section>
  );
}

function AssetsPage() {
  const input = useRef<HTMLInputElement>(null),
    replacementInput = useRef<HTMLInputElement>(null),
    [replacementAssetId, setReplacementAssetId] = useState<string>(),
    [replacementConfirmationAssetId, setReplacementConfirmationAssetId] = useState<string>(),
    [deletionAssetId, setDeletionAssetId] = useState<string>(),
    assets = useQuery({
      queryFn: async () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    upload = useMutation({
      mutationFn: async (file: File) => Effect.runPromise(managementClient.uploadAsset(file)),
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
      },
    }),
    replace = useMutation({
      mutationFn: async ({ assetId, file }: { readonly assetId: string; readonly file: File }) =>
        Effect.runPromise(
          managementClient.replaceImage(assetId, file, `replace-${crypto.randomUUID()}`),
        ),
      onSuccess: async () => {
        setReplacementAssetId(undefined);
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
        await queryClient.invalidateQueries({ queryKey: ["entry-state"] });
        await queryClient.invalidateQueries({ queryKey: ["entries"] });
      },
    }),
    deleteImage = useMutation({
      mutationFn: async (assetId: string) =>
        Effect.runPromise(
          managementClient.deleteImageAndClearAssignments(assetId, `delete-${crypto.randomUUID()}`),
        ),
      onSuccess: async () => {
        setDeletionAssetId(undefined);
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
        await queryClient.invalidateQueries({ queryKey: ["entry-state"] });
        await queryClient.invalidateQueries({ queryKey: ["entries"] });
      },
    }),
    chooseFile = () => {
      input.current?.click();
    };
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Assets</h1>
          <p>Immutable files referenced by Entries and Rich Text.</p>
        </div>
        <button className="primary-button" disabled={upload.isPending} onClick={chooseFile}>
          Upload Asset
        </button>
        <input
          ref={input}
          className="visually-hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              upload.mutate(file);
            }
          }}
        />
        <input
          ref={replacementInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined && replacementAssetId !== undefined) {
              replace.mutate({ assetId: replacementAssetId, file });
            }
            event.currentTarget.value = "";
          }}
        />
      </header>
      {upload.isSuccess && <p role="status">Asset uploaded successfully.</p>}
      {replace.isSuccess && (
        <p role="status">
          Replacement completed: {replace.data.reassignedEntryCount} Entries reassigned.
        </p>
      )}
      {deleteImage.isSuccess && (
        <p role="status">
          Image deleted after clearing {deleteImage.data.clearedPostCount} Post and{" "}
          {deleteImage.data.clearedAuthorCount} Author assignments.
        </p>
      )}
      {upload.error && (
        <p role="alert" className="error-state">
          {upload.error.message}
        </p>
      )}
      {(replace.error ?? deleteImage.error) !== null &&
        (replace.error ?? deleteImage.error) !== undefined && (
          <p role="alert" className="error-state">
            {(replace.error ?? deleteImage.error)?.message}
          </p>
        )}
      <section className="asset-grid">
        {assets.data?.map((asset: AssetRepresentation) => (
          <article className="asset-card" key={asset.id}>
            <div className="asset-preview">
              {asset.metadata.mediaType.startsWith("image/") ? (
                <img
                  src={`/api/v1/management/definition-spaces/example-blog/assets/${encodeURIComponent(asset.id)}/content`}
                  alt={asset.metadata.defaultAlternativeText ?? asset.metadata.filename}
                />
              ) : (
                <span aria-hidden="true">◫</span>
              )}
            </div>
            <strong>{asset.metadata.filename}</strong>
            <small>
              {asset.metadata.mediaType} · {asset.metadata.byteLength.toLocaleString()} bytes
              {asset.metadata.width === undefined
                ? ""
                : ` · ${asset.metadata.width} × ${asset.metadata.height ?? "?"}`}
            </small>
            <div className="asset-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={replace.isPending || deleteImage.isPending}
                onClick={() => {
                  setReplacementConfirmationAssetId(asset.id);
                }}
              >
                Replace…
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={replace.isPending || deleteImage.isPending}
                onClick={() => {
                  setDeletionAssetId(asset.id);
                }}
              >
                Delete…
              </button>
            </div>
          </article>
        ))}
        <button className="asset-upload" onClick={chooseFile}>
          ＋<span>Upload a new Asset</span>
        </button>
      </section>
      {replacementConfirmationAssetId !== undefined && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog destructive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-image-title"
          >
            <p className="eyebrow">Confirm replacement</p>
            <h2 id="replace-image-title">Replace this immutable image?</h2>
            <p>
              A new Asset will be ingested, every direct and Rich Text reference will be reassigned
              atomically, and the old Asset will be deleted last.
            </p>
            <div className="editor-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setReplacementConfirmationAssetId(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setReplacementAssetId(replacementConfirmationAssetId);
                  setReplacementConfirmationAssetId(undefined);
                  queueMicrotask(() => replacementInput.current?.click());
                }}
              >
                Choose replacement file
              </button>
            </div>
          </div>
        </div>
      )}
      {deletionAssetId !== undefined && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog destructive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-image-title"
          >
            <p className="eyebrow">Confirm deletion</p>
            <h2 id="delete-image-title">Delete this image Asset?</h2>
            <p>
              Optional featured-image and portrait assignments will be cleared automatically. Rich
              Text references still block deletion so authored content is never silently removed.
            </p>
            <div className="editor-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDeletionAssetId(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={deleteImage.isPending}
                onClick={() => {
                  deleteImage.mutate(deletionAssetId);
                }}
              >
                {deleteImage.isPending ? "Deleting…" : "Clear assignments and delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const rootRoute = createRootRoute({ component: Workbench }),
  overviewRoute = createRoute({ component: Overview, getParentRoute: () => rootRoute, path: "/" }),
  contentRoute = createRoute({
    component: ContentList,
    getParentRoute: () => rootRoute,
    path: "/content/$contentTypeId",
  }),
  entryRoute = createRoute({
    component: EntryEditor,
    getParentRoute: () => rootRoute,
    path: "/content/$contentTypeId/$entryId",
  }),
  assetsRoute = createRoute({
    component: AssetsPage,
    getParentRoute: () => rootRoute,
    path: "/assets",
  }),
  router = createRouter({
    context: { queryClient },
    routeTree: rootRoute.addChildren([overviewRoute, contentRoute, entryRoute, assetsRoute]),
  });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

const container = document.querySelector("#root");
if (container === null) {
  throw new Error("Example CMS root element is missing");
}
createRoot(container).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </StrictMode>,
);
