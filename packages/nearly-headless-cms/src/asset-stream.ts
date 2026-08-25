import { Effect, Stream } from "effect";

const oneShot = <
  Bytes extends Uint8Array,
  Failure,
  Content extends Stream.Stream<Bytes, Failure>,
>(
  content: Readonly<Content>,
  repeatedConsumptionFailure: () => Failure,
): Stream.Stream<Bytes, Failure> => {
  let consumed = false;
  return Stream.unwrap(
    Effect.suspend(() => {
      if (consumed) {
        return Effect.fail(repeatedConsumptionFailure());
      }
      consumed = true;
      return Effect.succeed(content);
    }),
  );
};

export default { oneShot };
