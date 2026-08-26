import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** Failure while staging an Asset or coherent public export snapshot. */
export class FetchExportFailure extends makeTaggedErrorClass<FetchExportFailure>()(
  "FetchExportFailure",
  {
    cause: Schema.optional(Schema.Unknown),
    message: Schema.String,
  },
) {}
