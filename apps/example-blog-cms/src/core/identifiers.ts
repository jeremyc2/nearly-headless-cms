import { Identifier } from "nearly-headless-cms";
import { CryptoIdentifierGenerator } from "nearly-headless-cms/adapters";
import { Effect, Layer } from "effect";

const acceptanceIdentifierSequencePadding = 4;

/** Crypto-backed identifiers for normal local development. */
export const {layer} = CryptoIdentifierGenerator;

const makeAcceptanceLayer = (): Layer.Layer<Identifier.Generator> => {
  let sequence = 0;
  return Layer.succeed(
    Identifier.Generator,
    Identifier.Generator.of({
      generate: (kind) =>
        Effect.succeed(
          `${kind}-acceptance-${String(sequence++).padStart(acceptanceIdentifierSequencePadding, "0")}`,
        ),
    }),
  );
};

/** Chooses deterministic identifiers when a custom storage root is provided. */
export const forStorageRoot = (
  storageRoot: string | undefined,
): Layer.Layer<Identifier.Generator> =>
  storageRoot === undefined ? layer : makeAcceptanceLayer();
