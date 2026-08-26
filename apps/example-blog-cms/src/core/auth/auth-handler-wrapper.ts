import type { HttpTransport } from "nearly-headless-cms/http";
import { runWithRequestIdentity } from "./auth-request-identity.ts";

/** Wraps the library HTTP handler so each request gets JWT-scoped Current Identity. */
export const wrapTransportHandlerWithRequestIdentity = (
  handler: HttpTransport.Handler,
): HttpTransport.Handler => (request) =>
  runWithRequestIdentity(request.headers.get("authorization"), () => handler(request));
