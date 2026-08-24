import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import dispatchRouteHandlers from "./http-transport-route-dispatch.ts";
import handleAssetRoutes from "./http-transport-asset-routes.ts";
import handleDefinitionRoutes from "./http-transport-definition-routes.ts";
import handleEntryRoutes from "./http-transport-entry-routes.ts";

const handleManagementRoutes = (context: RouteHandlerContext): Promise<RouteHandlerResult> =>
  dispatchRouteHandlers(
    [handleDefinitionRoutes, handleEntryRoutes, handleAssetRoutes],
    context,
  );

export default handleManagementRoutes;
