import type { CompiledSnapshot, JsonObject, JsonValue } from "./content-definition.ts";
import type { Representation } from "./entry.ts";
import type { ValidationIssue } from "./cms-error.ts";

/** One directed, versioned Definition migration edge. */
export interface Manifest {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly handlerIdentifier: string;
  readonly handlerVersion: number;
  readonly compatible?: boolean;
}

/** Source Entry and snapshots supplied to a deterministic Migration Handler. */
export interface HandlerInput {
  readonly entryId: string;
  readonly contentTypeId: string;
  readonly values: JsonObject;
  readonly manifest: Manifest;
}

/** Builder-supplied deterministic one-to-one Entry migration capability. */
export interface Handler {
  readonly identifier: string;
  readonly version: number;
  readonly transform: (input: HandlerInput) => JsonObject;
}

/** Inputs for staging and validating a complete Definition migration. */
export interface PreparationInput {
  readonly source: CompiledSnapshot;
  readonly target: CompiledSnapshot;
  readonly sourceGeneration: number;
  readonly entries: readonly Representation[];
  readonly manifest: Manifest;
  readonly handlers: readonly Handler[];
}

/** Serializable success or failure report for one staged Entry migration. */
export type PreparationReport =
  | { readonly status: "ready"; readonly transformedEntryCount: number }
  | { readonly status: "failed"; readonly issues: readonly ValidationIssue[] };

/** Complete staged migration output tied to its source generation. */
export interface Preparation {
  readonly id: string;
  readonly sourceSnapshotId: string;
  readonly targetSnapshotId: string;
  readonly sourceGeneration: number;
  readonly manifest: Manifest;
  readonly entries: readonly Representation[];
  readonly report: PreparationReport;
}

/** Persistable Migration Manifest metadata without executable compatibility logic. */
export interface SerializableManifest extends Omit<Manifest, "compatible"> {
  readonly compatible?: boolean;
  readonly metadata?: JsonValue;
}
