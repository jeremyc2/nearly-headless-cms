/** Tracks active requests and performs bounded shutdown drain for HTTP handlers. */
export {
  default as createTransportLifecycle,
  type TransportLifecycle,
  type TransportLifecycleCloseHooks,
  type TransportLifecycleOptions,
} from "./http-transport-lifecycle-support.ts";
