import {
  DateTime,
  Link,
  displayName,
  draftPluralSuffix,
  pendingCommentClass,
  rebuildLabel,
} from "./overview-imports.ts";
import type { OverviewState } from "./overview-data-support.ts";

const OverviewBuildPanel = <Rebuild extends OverviewState["rebuild"]>({
    rebuild,
  }: {
    readonly rebuild: Readonly<Rebuild>;
  }): React.JSX.Element => (
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
  ),
  OverviewQueuesPanel = (): React.JSX.Element => (
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
      <Link className="queue-row" to="/content/$contentTypeId" params={{ contentTypeId: "post" }}>
        <span className="queue-symbol green">P</span>
        <span>
          <strong>Finish “The Unfinished Map”</strong>
          <small>Draft saved in the CMS, not visible publicly</small>
        </span>
        <span>→</span>
      </Link>
    </section>
  ),
  OverviewRecentEntries = ({
    recentEntries,
  }: Pick<OverviewState, "recentEntries">): React.JSX.Element => (
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
  ),
  OverviewSignalGrid = <Counts extends OverviewState["counts"]>({
    assetsCount,
    counts,
    draftPostCount,
    pendingCommentCount,
  }: {
    readonly assetsCount: OverviewState["assetsCount"];
    readonly counts: Readonly<Counts>;
    readonly draftPostCount: OverviewState["draftPostCount"];
    readonly pendingCommentCount: OverviewState["pendingCommentCount"];
  }): React.JSX.Element => (
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
          <strong>{assetsCount}</strong>
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
  );

export default {
  OverviewBuildPanel,
  OverviewQueuesPanel,
  OverviewRecentEntries,
  OverviewSignalGrid,
};
