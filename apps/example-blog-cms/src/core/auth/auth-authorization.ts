import type { Identity, Operation } from "nearly-headless-cms";
import { Authorization } from "nearly-headless-cms";
import { Effect, Layer } from "effect";
import { cmsEditorGroup, headlessReaderGroup } from "./auth-actor.ts";
import { isBlogCmsIdentity } from "./auth-jwt.ts";

const managementActions = new Set<Operation.Action>([
  "definition.activate",
  "definition.read",
  "definition.write",
  "entry.create",
  "entry.delete",
  "entry.expand",
  "entry.history.purge",
  "entry.history.read",
  "entry.history.restore",
  "entry.query",
  "entry.read",
  "entry.update",
  "asset.create",
  "asset.delete",
  "asset.read",
]);

const headlessActions = new Set<Operation.Action>([
  "asset.read",
  "definition.read",
  "entry.query",
  "public.read",
]);

const actorHasGroup = (identity: Identity.Identity, group: string): boolean => {
  if (!isBlogCmsIdentity(identity)) {
    return false;
  }
  return identity.actor.groups.includes(group);
};

/** Maps Cognito-style group membership onto the library Action vocabulary. */
export const groupBasedAuthorizationLayer = Layer.succeed(
  Authorization.Service,
  Authorization.Service.of({
    authorize: (identity, action, _resource: Operation.Resource) =>
      Effect.sync(() => {
        if (identity.state === "anonymous") {
          return false;
        }
        if (actorHasGroup(identity, cmsEditorGroup) && managementActions.has(action)) {
          return true;
        }
        if (actorHasGroup(identity, headlessReaderGroup) && headlessActions.has(action)) {
          return true;
        }
        return false;
      }),
  }),
);
