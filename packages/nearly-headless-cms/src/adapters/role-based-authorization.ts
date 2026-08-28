import type { Action, Resource } from "../operation.ts";
import type { Identity } from "../identity.ts";
import { Effect, Layer } from "effect";
import { Service as AuthorizationService } from "../authorization.ts";

/** Inputs supplied to a role-based Authorization policy. */
export interface PolicyInput<Role> {
  readonly action: Action;
  readonly resource: Resource;
  readonly roles: readonly Role[];
}

/** Pure role extraction and policy functions for a role-based Authorization Layer. */
export interface Options<Role> {
  readonly policy: (input: Readonly<PolicyInput<Role>>) => boolean;
  readonly rolesOf: (identity: Readonly<Identity>) => readonly Role[];
}

const make = <Role>(options: Readonly<Options<Role>>): typeof AuthorizationService.Service =>
    AuthorizationService.of({
      authorize: (identity, action, resource) =>
        Effect.sync(() =>
          options.policy({
            action,
            resource,
            roles: options.rolesOf(identity),
          }),
        ),
    }),
  /** Builds an Authorization Layer from pure role extraction and policy functions. */
  layer = <Role>(options: Readonly<Options<Role>>): Layer.Layer<AuthorizationService> =>
    Layer.succeed(AuthorizationService, make(options));

export { layer, make };
