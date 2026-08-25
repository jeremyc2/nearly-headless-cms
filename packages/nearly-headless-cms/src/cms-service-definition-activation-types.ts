import type { Compatibility, CompiledSnapshot } from "./content-definition.ts";
import type { Manifest, Preparation } from "./definition-migration.ts";
import type { EntryGeneration } from "./persistence.ts";

export interface ActivationContext {
  readonly compatibility: Compatibility;
  readonly generation: EntryGeneration;
  readonly manifest: Manifest;
  readonly preparation: Preparation;
  readonly source: CompiledSnapshot;
  readonly target: CompiledSnapshot;
}
