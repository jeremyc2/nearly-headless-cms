import overviewPanelsSupport from "./overview-panels-support.tsx";
import { useOverviewState } from "./overview-data-support.ts";

export const Overview = (): React.JSX.Element => {
  const { OverviewBuildPanel, OverviewQueuesPanel, OverviewRecentEntries, OverviewSignalGrid } =
      overviewPanelsSupport,
    state = useOverviewState();
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">{state.today}</p>
          <h1>Good afternoon</h1>
          <p>Your content is calm. Two things could use your attention.</p>
        </div>
        <a className="secondary-button" href="/api/v1/headless/openapi.json">
          Headless API
        </a>
      </header>
      <OverviewSignalGrid
        assetsCount={state.assetsCount}
        counts={state.counts}
        draftPostCount={state.draftPostCount}
        pendingCommentCount={state.pendingCommentCount}
      />
      <div className="overview-grid">
        <OverviewQueuesPanel />
        <OverviewBuildPanel rebuild={state.rebuild} />
      </div>
      <OverviewRecentEntries recentEntries={state.recentEntries} />
    </div>
  );
};
