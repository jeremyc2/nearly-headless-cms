import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** A Query requires behavior the relevant Field Kind or Adapter cannot provide exactly. */
export class UnsupportedQueryCapability extends makeTaggedErrorClass<UnsupportedQueryCapability>()(
  "UnsupportedQueryCapability",
  { message: Schema.String },
) {}
