import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** Authorization denied the requested Action without revealing existence. */
export class Forbidden extends makeTaggedErrorClass<Forbidden>()("Forbidden", {
  message: Schema.String,
}) {}
