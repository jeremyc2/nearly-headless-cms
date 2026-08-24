import { Context } from "effect";
import type { ServiceShape } from "./cms-types.ts";

/** Public Effect service through which all generic CMS operations are invoked. */
export class Service extends Context.Service<Service, ServiceShape>()(
  "nearly-headless-cms/cms-service/Service",
) {}
