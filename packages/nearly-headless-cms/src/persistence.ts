/** Definition Catalog persistence records and service contract. */
export {
  type CatalogEvent,
  type CatalogState,
  type CommitCutoverInput,
  DefinitionCatalog,
  type DefinitionRevisionRecord,
  type DefinitionSnapshotRecord,
} from "./persistence/definition-catalog.ts";
/** Immutable Entry generation records and persistence service contract. */
export {
  type EntryGeneration,
  EntryPersistence,
  type EntryRecord,
} from "./persistence/entry-persistence.ts";
/** Queryable Entry reads, atomic row-level writes, and optional generation history. */
export {
  type EntryChange,
  type EntryCommit,
  type EntryQueryInput,
  type EntryQueryResult,
  type EntryReadResult,
} from "./persistence/entry-capability-types.ts";
/** Optional Entry generation history and rollback capability. */
export { EntryHistory } from "./persistence/entry-history.ts";
/** Queryable Entry read capability. */
export { EntryReader } from "./persistence/entry-reader.ts";
/** Atomic row-level Entry write capability. */
export { EntryWriter } from "./persistence/entry-writer.ts";
