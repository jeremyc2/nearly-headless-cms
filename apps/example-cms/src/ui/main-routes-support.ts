import { createRootRoute, createRoute, createRouter } from "@tanstack/react-router";
import { AssetsPage } from "./assets-page.tsx";
import { ContentList } from "./content-list.tsx";
import { EntryEditor } from "./entry-editor.tsx";
import { Overview } from "./overview.tsx";
import { Workbench } from "./workbench.tsx";
import { queryClient } from "./main-shared.ts";
const assetsRoute = createRoute({
    component: AssetsPage,
    getParentRoute: () => rootRoute,
    path: "/assets",
  }),
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
  overviewRoute = createRoute({
    component: Overview,
    getParentRoute: () => rootRoute,
    path: "/",
  }),
  rootRoute = createRootRoute({ component: Workbench }),
  router = createRouter({
    context: { queryClient },
    routeTree: rootRoute.addChildren([overviewRoute, contentRoute, entryRoute, assetsRoute]),
  });

export default router;

