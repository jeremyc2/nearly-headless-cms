import { Link, Outlet } from "@tanstack/react-router";
import { contentTypes } from "./main-shared.ts";

const Workbench = () => (
    <div className="workbench">
      <WorkbenchNavigation />
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  ),
  WorkbenchContentNavigation = () => (
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
        </Link>
      ))}
      <Link to="/assets" className="navigation-link">
        <span className="navigation-symbol">◫</span>
        <span>Assets</span>
      </Link>
    </nav>
  ),
  WorkbenchNavigation = () => (
    <aside className="navigation" aria-label="Content navigation">
      <Link className="brand" to="/" aria-label="Example Blog CMS overview">
        <span className="brand-mark">N</span>
        <span>
          <strong>Example</strong>
          <small>Blog CMS</small>
        </span>
      </Link>
      <WorkbenchContentNavigation />
      <div className="navigation-footer">
        <span className="open-dot" /> JWT-authenticated CMS
      </div>
    </aside>
  );

export { Workbench };
