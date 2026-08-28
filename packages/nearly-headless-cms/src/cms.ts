/** Public CMS inputs, results, snapshots, and service shape. */
export type {
  ActivateDefinitionSnapshotInput,
  ActivateDefinitionSnapshotResult,
  AppendDefinitionRevisionInput,
  AppendMigrationManifestInput,
  CmsLayerOptions,
  ConsistentReadSnapshot,
  DeleteEntryInput,
  DeleteResult,
  EntryBatchMutation,
  EntryBatchMutationResult,
  MutationResult,
  PrepareDefinitionMigrationInput,
  PurgeEntryInput,
  ReadRevisionInput,
  RetireDefinitionInput,
  ServiceShape,
} from "./cms-types.ts";
/** The public CMS Effect service tag. */
export { Service } from "./cms-service.ts";
/** CMS Layer constructors for Builder compositions. */
export {
  capabilityLayer,
  layer,
  makeCapabilityLayer,
  makeLayer,
} from "./cms-service-operations.ts";
