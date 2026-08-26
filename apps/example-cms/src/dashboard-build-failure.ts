import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** Dashboard compilation failure surfaced during Example CMS startup. */
export class DashboardBuildFailure extends makeTaggedErrorClass<DashboardBuildFailure>()(
  "DashboardBuildFailure",
  { message: Schema.String },
) {}
