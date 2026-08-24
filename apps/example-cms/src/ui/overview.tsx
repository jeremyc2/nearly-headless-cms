import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { DateTime, Effect } from "effect";
import type { EntryRepresentation } from "../generated/management-client.ts";
import {
  draftPluralSuffix,
  pendingCommentClass,
  rebuildLabel,
} from "./main-labels.ts";
import { displayName } from "./main-entry-support.ts";
import { contentTypes, managementClient } from "./main-shared.ts";

export const Overview = () => {
  const queries = useQueries({
      queries: contentTypes.map((contentType) => ({
        queryFn: () =>
          Effect.runPromise(
            managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
          ),
        queryKey: ["count", contentType.identifier],
      })),
    }),
    assets = useQuery({
      queryFn: () => Effect.runPromise(managementClient.listAssets()),
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
        queryFn: () =>
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
    }).format(DateTime.toDate(DateTime.nowUnsafe())),
    rebuild = useMutation({
      // oxlint-disable-next-line effecttsgo/async-function -- React query mutation is an intentional browser async boundary.
      mutationFn: async () => {
        // oxlint-disable-next-line effecttsgo/global-fetch -- Browser mutation boundary is owned by the UI query client.
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
                  {entry.contentTypeId} ·{" "}
                  {DateTime.toDate(DateTime.makeUnsafe(recordedAt)).toLocaleString()}
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
