import { AsyncLocalStorage } from "node:async_hooks";
import { Identity } from "nearly-headless-cms";
import { Effect, Layer } from "effect";
import type { BlogCmsActor } from "./auth-actor.ts";
import { actorFromValidatedClaims, validateBearerToken } from "./auth-jwt.ts";

const identityStorage = new AsyncLocalStorage<Identity.Identity<BlogCmsActor>>();

/** Runs one HTTP handler with request-scoped Current Identity. */
// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-327] request identity bridging intentionally wraps native HTTP handler callbacks.
export const runWithRequestIdentity = <Result>(
  authorizationHeader: string | null,
  run: () => Result | Promise<Result>,
): Promise<Result> =>
  validateBearerToken(authorizationHeader).then((identity) =>
    identityStorage.run(identity, run),
  );

export const requestScopedIdentityLayer = Layer.succeed(
  Identity.CurrentIdentity,
  Identity.CurrentIdentity.of({
    current: (_void: void) =>
      Effect.sync(() => identityStorage.getStore() ?? Identity.anonymous),
  }),
);

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-330] startup identity helpers are plain values used before Effect services start.
export const developmentIdentityFromSubject = (
  subject: string,
  groups: readonly string[],
): Identity.Identity<BlogCmsActor> => ({
  actor: actorFromValidatedClaims({ groups, sub: subject, token_use: "access" }),
  state: "actor",
});

export { identityStorage };
