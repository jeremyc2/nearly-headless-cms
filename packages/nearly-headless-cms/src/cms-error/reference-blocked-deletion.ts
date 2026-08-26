import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** A live Relationship or Rich Text reference prevents Entry deletion. */
export class ReferenceBlockedDeletion extends makeTaggedErrorClass<ReferenceBlockedDeletion>()(
  "ReferenceBlockedDeletion",
  { message: Schema.String },
) {}
