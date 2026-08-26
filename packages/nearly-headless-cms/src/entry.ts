import type { JsonObject } from "./internal/json.ts";

/** Stable Entry identity and its selected Field values. */
export interface Representation {
  readonly id: string;
  readonly contentTypeId: string;
  readonly values: JsonObject;
}

/** Input for creating an Entry in one Content Type. */
export interface CreateInput {
  readonly contentTypeId: string;
  readonly values: JsonObject;
}

/** Complete Entry replacement input with optional optimistic concurrency. */
export interface UpdateInput extends CreateInput {
  readonly entryId: string;
  readonly writeToken?: string;
}

/** Input for reading one Entry with optional projection and expansion. */
export interface ReadInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly projection?: readonly string[];
  readonly expansion?: readonly string[];
}
