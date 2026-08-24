import { useQuery } from "@tanstack/react-query";
import { Link, Outlet } from "@tanstack/react-router";
import { Effect } from "effect";
import { contentTypes, managementClient } from "./main-shared.ts";

export const Workbench = () => {
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
