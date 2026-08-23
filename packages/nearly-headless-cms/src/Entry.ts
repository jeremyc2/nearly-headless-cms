import type { JsonObject } from "./internal/json.ts";

export interface Representation {
  readonly id: string;
  readonly contentTypeId: string;
  readonly values: JsonObject;
}

export interface CreateInput {
  readonly contentTypeId: string;
  readonly values: JsonObject;
}

export interface UpdateInput extends CreateInput {
  readonly entryId: string;
  readonly writeToken?: string;
}

export interface ReadInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly projection?: readonly string[];
  readonly expansion?: readonly string[];
}
