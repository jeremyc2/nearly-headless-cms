import { Effect, Schema } from "effect";

export const generatorFormatVersion = 1;

export class HeadlessClientFailure extends Schema.TaggedError<HeadlessClientFailure>()(
  "HeadlessClientFailure",
  {
    message: Schema.String,
    status: Schema.Number,
  },
) {}

const get = (path: string): Effect.Effect<unknown, HeadlessClientFailure> =>
  Effect.tryPromise({
    catch: (cause) =>
      cause instanceof HeadlessClientFailure
        ? cause
        : HeadlessClientFailure.make({
            message: cause instanceof Error ? cause.message : "Headless transport failed",
            status: 0,
          }),
    try: async () => {
      const response = await fetch(path);
      if (!response.ok)
        throw HeadlessClientFailure.make({
          message: `Headless request failed with ${response.status}`,
          status: response.status,
        });
      return response.json();
    },
  });

export const headlessClient = {
  discover: (): Effect.Effect<unknown, HeadlessClientFailure> => get("/api/v1/headless/schema"),
  exportPublicBlog: (): Effect.Effect<unknown, HeadlessClientFailure> =>
    get("/api/v1/headless/export"),
};
