import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";
import handleDefinitionCatalogRoutes from "./http-transport-definition-catalog-routes.ts";
import handleDefinitionMigrationRoutes from "./http-transport-definition-migration-routes.ts";

// oxlint-disable-next-line effecttsgo/async-function -- [EH-015] definition routes delegate to catalog and migration handlers sequentially.
const handleDefinitionRoutes = async (
  context: Readonly<RouteHandlerContext>,
): Promise<RouteHandlerResult> => {
  const catalogResult = await handleDefinitionCatalogRoutes(context);
  if (catalogResult !== undefined) {
    return catalogResult;
  }
  return handleDefinitionMigrationRoutes(context);
};

export default handleDefinitionRoutes;
