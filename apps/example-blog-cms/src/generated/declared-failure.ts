import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

export class DeclaredFailure extends makeTaggedErrorClass<DeclaredFailure>()("DeclaredFailure", {
  code: Schema.String,
  details: Schema.optional(Schema.Json),
  message: Schema.String,
  status: Schema.Finite,
}) {}
