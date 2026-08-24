import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** The authorized resource does not exist. */
export class NotFound extends makeTaggedErrorClass<NotFound>()("NotFound", {
  message: Schema.String,
}) {}
