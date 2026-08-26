import { Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

/** A live Entry or Rich Text reference prevents Asset deletion. */
export class AssetReferenced extends makeTaggedErrorClass<AssetReferenced>()("AssetReferenced", {
  message: Schema.String,
}) {}
