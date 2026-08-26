import {
  Effect,
  Link,
  Outlet,
  contentTypes,
  managementClient,
  useQuery,
} from "./workbench-imports.ts";

const Workbench = () => {
    const pendingComments = useQuery({
      queryFn: () =>
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
        <WorkbenchNavigation pendingCommentCount={pendingComments.data?.items.length ?? 0} />
        <main className="main-content">
          <Outlet />
        </main>
      </div>
    );
  },
  WorkbenchContentNavigation = ({
    pendingCommentCount,
  }: {
    readonly pendingCommentCount: number;
  }) => (
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
          {contentType.identifier === "comment" && pendingCommentCount > 0 && (
            <span className="count-badge">{pendingCommentCount}</span>
          )}
        </Link>
      ))}
      <Link to="/assets" className="navigation-link">
        <span className="navigation-symbol">◫</span>
        <span>Assets</span>
      </Link>
    </nav>
  ),
  WorkbenchNavigation = ({ pendingCommentCount }: { readonly pendingCommentCount: number }) => (
    <aside className="navigation" aria-label="Content navigation">
      <Link className="brand" to="/" aria-label="Nearly Headless CMS overview">
        <span className="brand-mark">N</span>
        <span>
          <strong>Nearly</strong>
          <small>Headless CMS</small>
        </span>
      </Link>
      <WorkbenchContentNavigation pendingCommentCount={pendingCommentCount} />
      <div className="navigation-footer">
        <span className="open-dot" /> Open-access CMS
      </div>
    </aside>
  );

export { Workbench };
