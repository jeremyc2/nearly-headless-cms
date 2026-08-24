import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** The active Definition fingerprint no longer matches a request precondition. */
export class DefinitionSnapshotChanged extends makeTaggedErrorClass<DefinitionSnapshotChanged>()(
  "DefinitionSnapshotChanged",
  { message: Schema.String },
) {}
