import type {
  AppendDefinitionRevisionInput,
  AppendMigrationManifestInput,
  PrepareDefinitionMigrationInput,
  RetireDefinitionInput,
} from "./cms-types.ts";
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
  activeDefinitionSnapshotMethod = (context: Readonly<CmsServiceOperationContext>) =>
    runActiveDefinitionSnapshot(context),
  appendDefinitionRevisionMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<AppendDefinitionRevisionInput>) =>
      runAppendDefinitionRevision(context, input),
  appendMigrationManifestMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<AppendMigrationManifestInput>) =>
      runAppendMigrationManifest(context, input),
  prepareDefinitionMigrationMethod =
    (context: Readonly<CmsServiceOperationContext>) =>
    (input: Readonly<PrepareDefinitionMigrationInput>) =>
      runPrepareDefinitionMigration(context, input),
  readConsistentSnapshotMethod = (context: Readonly<CmsServiceOperationContext>) =>
    runReadConsistentSnapshot(context),
  readDefinitionCatalogMethod = (context: Readonly<CmsServiceOperationContext>) =>
    runReadDefinitionCatalog(context),
  retireDefinitionMethod =
    (context: Readonly<CmsServiceOperationContext>) => (input: Readonly<RetireDefinitionInput>) =>
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
