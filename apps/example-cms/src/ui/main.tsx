import { QueryClientProvider } from "@tanstack/react-query";
import {
  RouterProvider,
  createRootRoute,
  createRoute,
  createRouter,
} from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { AssetsPage } from "./assets-page.tsx";
import { ContentList } from "./content-list.tsx";
import { EntryEditor } from "./entry-editor.tsx";
import { queryClient } from "./main-shared.ts";
import { Overview } from "./overview.tsx";
import { Workbench } from "./workbench.tsx";
import "./styles.css";

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
