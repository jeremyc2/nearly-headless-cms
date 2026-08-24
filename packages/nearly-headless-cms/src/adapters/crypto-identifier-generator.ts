import { Crypto, Effect, Layer } from "effect";
import { Generator } from "../identifier.ts";
import { InfrastructureFailure } from "../cms-error.ts";

const cryptography = Crypto.make({
  digest: (algorithm, data) => {
    const digestInput = new Uint8Array(data.byteLength);
    digestInput.set(data);
    return Effect.promise(() =>
      globalThis.crypto.subtle
        .digest(algorithm, digestInput)
        .then((digest) => new Uint8Array(digest)),
    );
  },
  randomBytes: (size) => globalThis.crypto.getRandomValues(new Uint8Array(size)),
}),
  layer = Layer.succeed(
    Generator,
    Generator.of({
      generate: (kind) =>
        cryptography.randomUUIDv4.pipe(
          Effect.map((identifier) => `${kind}-${identifier}`),
          Effect.mapError((cause) =>
            InfrastructureFailure.make({
              cause,
              message: "Cryptographic identifier generation failed",
              retryable: false,
            }),
          ),
        ),
    }),
  );

/** Identifier Generator Layer backed by cryptographically random UUIDs. */
export { layer };
