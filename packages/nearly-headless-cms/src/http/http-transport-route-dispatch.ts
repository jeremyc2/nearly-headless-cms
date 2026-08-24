import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";

type RouteHandler = (
  context: RouteHandlerContext,
) => RouteHandlerResult | Promise<RouteHandlerResult>;

// oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- route dispatch is a plain async helper, not a pipeable Effect API.
const dispatchRouteHandlers = async (
  handlers: readonly RouteHandler[],
  context: RouteHandlerContext,
): Promise<RouteHandlerResult> => {
  for (const handler of handlers) {
    // oxlint-disable-next-line no-await-in-loop -- handlers must run sequentially until one matches.
    const result = await handler(context);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
};

export default dispatchRouteHandlers;

export type { RouteHandler };
