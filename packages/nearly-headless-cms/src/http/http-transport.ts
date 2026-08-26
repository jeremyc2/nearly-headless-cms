/** Portable handler and transport configuration types. */
export type { Handler, Options } from "./http-transport-types.ts";
/** Creates an interruptible Web-standard CMS request handler. */
export { makeHandler } from "./http-transport-handler.ts";
/** Creates portable Effect HTTP routes for a Builder-supplied server Adapter. */
export { layer } from "./http-transport-layer.ts";
/** Tracks active requests and performs bounded shutdown drain for HTTP handlers. */
export {
  createTransportLifecycle,
  type TransportLifecycle,
  type TransportLifecycleCloseHooks,
  type TransportLifecycleOptions,
} from "./http-transport-lifecycle.ts";
