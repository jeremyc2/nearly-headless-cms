import { Effect, Schema } from "effect";

export const generatorFormatVersion = 1;

export class HeadlessClientFailure extends Schema.TaggedError<HeadlessClientFailure>()(
  "HeadlessClientFailure",
  {
    message: Schema.String,
    status: Schema.Number,
  },
) {}

const get = <Value>(path: string): Effect.Effect<Value, HeadlessClientFailure> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof HeadlessClientFailure
        ? cause
        : new HeadlessClientFailure({
            message: cause instanceof Error ? cause.message : "Headless transport failed",
            status: 0,
          }),
    try: async () => {
      const response = await fetch(path);
      if (!response.ok)
        throw new HeadlessClientFailure({
          message: `Headless request failed with ${response.status}`,
          status: response.status,
        });
      return (await response.json()) as Value;
    },
  });

export const headlessClient = {
  discover: <Value>(): Effect.Effect<Value, HeadlessClientFailure> =>
    get("/api/v1/headless/schema"),
  exportPublicBlog: <Value>(): Effect.Effect<Value, HeadlessClientFailure> =>
    get("/api/v1/headless/export"),
};
