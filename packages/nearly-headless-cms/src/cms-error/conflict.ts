import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** Current persisted state conflicts with the requested state transition. */
export class Conflict extends makeTaggedErrorClass<Conflict>()("Conflict", {
  message: Schema.String,
}) {}
