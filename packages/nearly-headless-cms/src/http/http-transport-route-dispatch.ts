import type { RouteHandlerContext, RouteHandlerResult } from "./http-transport-types.ts";

type RouteHandler = (
  context: Readonly<RouteHandlerContext>,
) => RouteHandlerResult | Promise<RouteHandlerResult>;

// oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-058, EH-093] route dispatch is a plain async helper, not a pipeable Effect API.
const dispatchRouteHandlers = async (
  handlers: readonly RouteHandler[],
  context: Readonly<RouteHandlerContext>,
): Promise<RouteHandlerResult> => {
  for (const handler of handlers) {
    // oxlint-disable-next-line no-await-in-loop -- [EH-136] handlers must run sequentially until one matches.
    const result = await handler(context);
    if (result !== undefined) {
      return result;
    }
  }
  return undefined;
};

export default dispatchRouteHandlers;

export type { RouteHandler };
