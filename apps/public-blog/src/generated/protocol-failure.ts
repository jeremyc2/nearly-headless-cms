import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

export class ProtocolFailure extends makeTaggedErrorClass<ProtocolFailure>()("ProtocolFailure", {
  message: Schema.String,
  status: Schema.Finite,
}) {}
