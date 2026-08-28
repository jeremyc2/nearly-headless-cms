import type { InfrastructureFailure } from "../cms-error.ts";
import { CurrentIdentity, type Identity, anonymous } from "../identity.ts";
import { Effect, Layer } from "effect";

/** Verifies one bearer token into Builder-owned claims. */
export type BearerVerifier<Claims> = (
  bearerToken: string,
) => Effect.Effect<Claims, InfrastructureFailure>;

/** Reads the request's Authorization header when resolving Current Identity. */
export type AuthorizationHeader = (
  _void: void,
) => Effect.Effect<string | undefined, InfrastructureFailure>;

/** Creates a Current Identity resolver from a bearer-token verifier. */
const fromBearerVerifier = <Claims>(
    verify: BearerVerifier<Claims>,
  ): ((authorizationHeader?: string) => Effect.Effect<Identity<Claims>, InfrastructureFailure>) =>
    (authorizationHeader) => {
      if (authorizationHeader === undefined) {
        return Effect.succeed(anonymous);
      }
      const [scheme, bearerToken, unexpectedPart] = authorizationHeader.trim().split(/\s+/u);
      if (scheme?.toLowerCase() !== "bearer" || bearerToken === undefined || unexpectedPart !== undefined) {
        return Effect.succeed(anonymous);
      }
      return verify(bearerToken).pipe(
        Effect.map((claims): Identity<Claims> => ({ actor: claims, state: "actor" })),
      );
    },
  /** Builds request-scoped Current Identity from an Authorization header source and verifier. */
  layer = <Claims>(options: {
    readonly authorizationHeader: AuthorizationHeader;
    readonly verify: BearerVerifier<Claims>;
  }): Layer.Layer<CurrentIdentity, InfrastructureFailure> => {
    const resolveIdentity = fromBearerVerifier(options.verify);
    return Layer.effect(
      CurrentIdentity,
      Effect.succeed(
        CurrentIdentity.of({
          current: (_void: void) => options.authorizationHeader().pipe(Effect.flatMap(resolveIdentity)),
        }),
      ),
    );
  };

export { fromBearerVerifier, layer };
