import { Schema } from "effect";

const issuePathSchema = Schema.Array(Schema.Union([Schema.String, Schema.Finite])),
  issueSchema = Schema.Struct({
    message: Schema.String,
    path: issuePathSchema,
    reason: Schema.String,
  }),
  issuesSchema = Schema.Array(issueSchema),
  makeTaggedErrorClass = Schema.TaggedError;

/** A stable machine-readable validation issue at an unambiguous Field path. */
export interface ValidationIssue {
  readonly message: string;
  readonly path: readonly (string | number)[];
  readonly reason: string;
}

/** The request or persisted value violated a declared CMS invariant. */
export class InvalidInput extends makeTaggedErrorClass<InvalidInput>()("InvalidInput", {
  issues: Schema.optional(issuesSchema),
  message: Schema.String,
}) {}
