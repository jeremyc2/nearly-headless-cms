import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

export class TransportFailure extends makeTaggedErrorClass<TransportFailure>()("TransportFailure", {
  message: Schema.String,
}) {}
