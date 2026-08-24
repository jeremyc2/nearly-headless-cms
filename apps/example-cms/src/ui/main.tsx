import { QueryClient, QueryClientProvider, useMutation, useQuery } from "@tanstack/react-query";
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
import { StrictMode, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import type { RichText } from "nearly-headless-cms";
import { type EntryRepresentation, makeManagementClient } from "../generated/management-client.ts";
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
  ] as const;

function Workbench() {
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
              {contentType.identifier === "comment" && <span className="count-badge">1</span>}
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
  const queries = contentTypes.map((contentType) =>
      useQuery({
        queryFn: async () =>
          Effect.runPromise(
            managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
          ),
        queryKey: ["count", contentType.identifier],
      }),
    ),
    counts = Object.fromEntries(
      contentTypes.map((contentType, index) => [
        contentType.identifier,
        queries[index]?.data?.items.length ?? "—",
      ]),
    ),
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
          <p className="eyebrow">Sunday, August 23</p>
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
          <small>1 draft</small>
        </article>
        <article className="signal-card">
          <span className="signal-icon">☵</span>
          <div>
            <strong>{counts["comment"]}</strong>
            <span>Comments</span>
          </div>
          <small className="attention">1 pending</small>
        </article>
        <article className="signal-card">
          <span className="signal-icon">◫</span>
          <div>
            <strong>1</strong>
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
              {rebuild.isPending ? "Building…" : "Rebuild demonstration"}
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
    </div>
  );
}

const displayName = (entry: EntryRepresentation): string =>
  String(entry.values["title"] ?? entry.values["name"] ?? entry.values["display-name"] ?? entry.id);

function ContentList() {
  const { contentTypeId } = useParams({ from: "/content/$contentTypeId" }),
    contentType = contentTypes.find((candidate) => candidate.identifier === contentTypeId),
    navigate = useNavigate(),
    [filterText, setFilterText] = useState(""),
    entries = useQuery({
      queryFn: async () =>
        Effect.runPromise(
          managementClient.queryEntries(contentTypeId, {
            pageSize: 50,
            sort: [
              {
                direction: "descending",
                path:
                  contentTypeId === "comment"
                    ? "created-at"
                    : contentTypeId === "post"
                      ? "published-at"
                      : "name",
              },
            ],
          }),
        ),
      queryKey: ["entries", contentTypeId],
    }),
    visibleEntries = entries.data?.items.filter((entry) =>
      displayName(entry).toLocaleLowerCase().includes(filterText.trim().toLocaleLowerCase()),
    ),
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
          relatedEntryId = related?.items[0]?.id,
          values: Readonly<Record<string, unknown>> =
            contentTypeId === "post"
              ? {
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
                }
              : contentTypeId === "author"
                ? {
                    biography: "Biography to be completed.",
                    "external-links": [],
                    name: `Untitled ${suffix}`,
                    slug: `untitled-${suffix}`,
                  }
                : contentTypeId === "comment"
                  ? {
                      body: "Comment awaiting editing.",
                      "created-at": new Date().toISOString(),
                      "display-name": `Reader ${suffix}`,
                      post: relatedEntryId,
                      status: "pending",
                    }
                  : { name: `Untitled ${suffix}`, slug: `untitled-${suffix}` };
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
          <button className="secondary-button">Status: all</button>
          <button className="secondary-button">Newest first</button>
        </div>
        {entries.isLoading && <p className="empty-state">Loading Entries…</p>}
        {entries.error && <p className="error-state">{entries.error.message}</p>}
        <div className="entry-list">
          {visibleEntries?.map((entry) => (
            <Link
              key={entry.id}
              className="entry-row"
              to="/content/$contentTypeId/$entryId"
              params={{ contentTypeId, entryId: entry.id }}
            >
              <span className="entry-monogram">{displayName(entry).slice(0, 1)}</span>
              <span className="entry-title">
                <strong>{displayName(entry)}</strong>
                <small>{String(entry.values["slug"] ?? entry.values["status"] ?? entry.id)}</small>
              </span>
              <span
                className={`status-pill ${entry.values["status"] === "published" || entry.values["status"] === "approved" ? "published" : ""}`}
              >
                {String(entry.values["status"] ?? "active")}
              </span>
              <span>→</span>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}

function EntryEditor() {
  const { contentTypeId, entryId } = useParams({ from: "/content/$contentTypeId/$entryId" }),
    state = useQuery({
      queryFn: async () =>
        Effect.runPromise(managementClient.getCurrentState(contentTypeId, entryId)),
      queryKey: ["entry-state", contentTypeId, entryId],
    }),
    [values, setValues] = useState<Record<string, unknown>>({});
  useEffect(() => {
    if (state.data !== undefined) {
      setValues(structuredClone(state.data.entry.values));
    }
  }, [state.data]);
  const save = useMutation({
      mutationFn: async (replacementValues: Readonly<Record<string, unknown>>) =>
        Effect.runPromise(
          managementClient.replaceEntry(
            contentTypeId,
            entryId,
            replacementValues,
            state.data?.writeToken,
          ),
        ),
      onSuccess: async (result) => {
        const updatedState = "entry" in result ? result : { entry: result };
        setValues(structuredClone(updatedState.entry.values));
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
          managementClient.runEditorialCommand(
            contentTypeId,
            entryId,
            status,
            state.data.writeToken,
          ),
        );
      },
      onSuccess: async (result) => {
        setValues(structuredClone(result.entry.values));
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    }),
    titleField = "title" in values ? "title" : "name" in values ? "name" : "display-name";
  const title = String(values[titleField] ?? ""),
    updateField = (key: string, value: unknown) => {
      setValues((current) => ({ ...current, [key]: value }));
    },
    saveValues = (replacementValues = values) => {
      save.mutate(replacementValues);
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
            <span className="saved-dot" />{" "}
            {save.isPending ? "Saving…" : save.isSuccess ? "Saved in CMS" : "Saved in CMS"} ·
            Revision {state.data?.revisionNumber ?? "—"}
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
              <label className="field">
                <span>Slug</span>
                <input
                  value={String(values["slug"])}
                  onChange={(event) => {
                    updateField("slug", event.target.value);
                  }}
                />
              </label>
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
            {"body" in values && typeof values["body"] === "object" && (
              <RichTextField
                value={values["body"] as RichText.Document}
                onChange={(document) => {
                  updateField("body", document);
                }}
              />
            )}
          </section>
          <aside className="editor-sidebar">
            <section className="panel">
              <p className="eyebrow">Publication</p>
              <h2>CMS state</h2>
              {"status" in values && (
                <label className="field">
                  <span>Status</span>
                  <select
                    value={String(values["status"] ?? "active")}
                    onChange={(event) => {
                      updateField("status", event.target.value);
                    }}
                  >
                    <option>draft</option>
                    <option>published</option>
                    <option>pending</option>
                    <option>approved</option>
                    <option>rejected</option>
                  </select>
                </label>
              )}
              <p className="boundary-note">
                Saving changes the CMS. Publishing makes a Post eligible for the next static build.
              </p>
              {editorialCommand.error && (
                <p className="error-state" role="alert">
                  {editorialCommand.error.message}
                </p>
              )}
              {contentTypeId === "post" && (
                <button
                  className="primary-button full-button"
                  disabled={editorialCommand.isPending}
                  type="button"
                  onClick={() => {
                    setEditorialStatus(values["status"] === "published" ? "draft" : "published");
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
                      setEditorialStatus("approved");
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    disabled={editorialCommand.isPending}
                    type="button"
                    onClick={() => {
                      setEditorialStatus("rejected");
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
          </aside>
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
    adapter = useRef<BrowserAdapter | null>(null),
    onChangeReference = useRef(onChange),
    initialValue = useMemo(() => value, []);
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
    });
    adapter.current = browserAdapter;
    return () => {
      browserAdapter.destroy();
    };
  }, [initialValue]);
  return (
    <div className="rich-text-shell">
      <div className="rich-toolbar" role="toolbar" aria-label="Rich Text formatting">
        <button
          type="button"
          aria-label="Bold"
          onClick={() => adapter.current?.dispatch({ mark: "bold", type: "toggleMark" })}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Italic"
          onClick={() => adapter.current?.dispatch({ mark: "italic", type: "toggleMark" })}
        >
          <em>I</em>
        </button>
        <button type="button" onClick={() => adapter.current?.dispatch({ type: "undo" })}>
          Undo
        </button>
        <button type="button" onClick={() => adapter.current?.dispatch({ type: "redo" })}>
          Redo
        </button>
      </div>
      <div ref={host} className="rich-surface" aria-label="Rich Text content" />
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
  const revisions = useQuery({
      queryFn: async () =>
        Effect.runPromise(managementClient.listRevisions(contentTypeId, entryId)),
      queryKey: ["revisions", contentTypeId, entryId],
    }),
    restore = useMutation({
      mutationFn: async (revisionNumber: number) => {
        if (writeToken === undefined) {
          throw new Error("Current Write Token is unavailable");
        }
        return Effect.runPromise(
          managementClient.restoreRevision(contentTypeId, entryId, revisionNumber, writeToken),
        );
      },
      onSuccess: async () => {
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
          disabled={restore.isPending || index === 0}
          onClick={() => {
            restore.mutate(revision.revisionNumber);
          }}
          key={revision.revisionNumber}
        >
          <span className={index === 0 ? "revision-dot current" : "revision-dot"} />
          <span>
            <strong>Revision {revision.revisionNumber}</strong>
            <small>
              {index === 0 ? "Current · " : "Restore · "}
              {new Date(revision.recordedAt).toLocaleString()}
            </small>
          </span>
        </button>
      ))}
    </section>
  );
}

function AssetsPage() {
  const input = useRef<HTMLInputElement>(null),
    upload = useMutation({
      mutationFn: async (file: File) => Effect.runPromise(managementClient.uploadAsset(file)),
    });
  const chooseFile = () => {
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
      </header>
      {upload.isSuccess && <p role="status">Asset uploaded successfully.</p>}
      {upload.error && (
        <p role="alert" className="error-state">
          {upload.error.message}
        </p>
      )}
      <section className="asset-grid">
        <article className="asset-card">
          <div className="asset-preview">☼</div>
          <strong>lighthouse.svg</strong>
          <small>image/svg+xml · 1200 × 630</small>
        </article>
        <button className="asset-upload" onClick={chooseFile}>
          ＋<span>Upload a new Asset</span>
        </button>
      </section>
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
