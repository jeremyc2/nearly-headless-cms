import { Layer } from "effect";
import { layer as allowAllAuthorizationLayer } from "../adapters/allow-all-authorization.ts";
import { layer as anonymousIdentityLayer } from "../adapters/anonymous-identity.ts";
import { layer as cryptoIdentifierGeneratorLayer } from "../adapters/crypto-identifier-generator.ts";

/** Open authorization, anonymous identity, and crypto identifiers for local development. */
export const development = Layer.mergeAll(
  allowAllAuthorizationLayer,
  anonymousIdentityLayer,
  cryptoIdentifierGeneratorLayer,
);
