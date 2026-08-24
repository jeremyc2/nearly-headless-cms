import handleAssetRoutes from "./http-transport-asset-routes.ts";
import handleDefinitionRoutes from "./http-transport-definition-routes.ts";
import handleEntryRoutes from "./http-transport-entry-routes.ts";
import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";

// oxlint-disable-next-line effecttsgo/async-function -- management routes delegate to definition, entry, and asset handlers sequentially.
const handleManagementRoutes = async (context: RouteHandlerContext): Promise<RouteHandlerResult> => {
  const definitionResult = await handleDefinitionRoutes(context);
  if (definitionResult !== undefined) {
    return definitionResult;
  }
  const entryResult = await handleEntryRoutes(context);
  if (entryResult !== undefined) {
    return entryResult;
  }
  return handleAssetRoutes(context);
};

export default handleManagementRoutes;
