import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** A bounded public export exceeded its configured maximum size. */
export class ExportTooLarge extends makeTaggedErrorClass<ExportTooLarge>()("ExportTooLarge", {
  message: Schema.String,
}) {}
