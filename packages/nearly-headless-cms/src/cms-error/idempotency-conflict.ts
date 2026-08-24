import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** An idempotency key was reused for a different command payload. */
export class IdempotencyConflict extends makeTaggedErrorClass<IdempotencyConflict>()(
  "IdempotencyConflict",
  {
    message: Schema.String,
  },
) {}
