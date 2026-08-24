import type { AppendDefinitionRevisionInput, AppendMigrationManifestInput, PrepareDefinitionMigrationInput, RetireDefinitionInput } from "./cms-types.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import definitionOperationsSupport from "./cms-service-definition-operations-support.ts";

const {
  runActiveDefinitionSnapshot,
  runAppendDefinitionRevision,
  runAppendMigrationManifest,
  runPrepareDefinitionMigration,
  runReadConsistentSnapshot,
  runReadDefinitionCatalog,
  runRetireDefinition,
} = definitionOperationsSupport,
  activeDefinitionSnapshotMethod = (context: CmsServiceOperationContext) =>
    runActiveDefinitionSnapshot(context),
  appendDefinitionRevisionMethod =
    (context: CmsServiceOperationContext) =>
    (input: AppendDefinitionRevisionInput) =>
      runAppendDefinitionRevision(context, input),
  appendMigrationManifestMethod =
    (context: CmsServiceOperationContext) =>
    (input: AppendMigrationManifestInput) =>
      runAppendMigrationManifest(context, input),
  prepareDefinitionMigrationMethod =
    (context: CmsServiceOperationContext) =>
    (input: PrepareDefinitionMigrationInput) =>
      runPrepareDefinitionMigration(context, input),
  readConsistentSnapshotMethod = (context: CmsServiceOperationContext) =>
    runReadConsistentSnapshot(context),
  readDefinitionCatalogMethod = (context: CmsServiceOperationContext) =>
    runReadDefinitionCatalog(context),
  retireDefinitionMethod =
    (context: CmsServiceOperationContext) =>
    (input: RetireDefinitionInput) =>
      runRetireDefinition(context, input);

export default {
  activeDefinitionSnapshot: activeDefinitionSnapshotMethod,
  appendDefinitionRevision: appendDefinitionRevisionMethod,
  appendMigrationManifest: appendMigrationManifestMethod,
  prepareDefinitionMigration: prepareDefinitionMigrationMethod,
  readConsistentSnapshot: readConsistentSnapshotMethod,
  readDefinitionCatalog: readDefinitionCatalogMethod,
  retireDefinition: retireDefinitionMethod,
};
