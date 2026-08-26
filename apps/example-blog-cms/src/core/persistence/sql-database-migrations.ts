import type { SqlDatabaseClient } from "./sql-database-connection.ts";

/** Ensures the CMS persistence schema exists. The same DDL works on Postgres with minor type tweaks. */
// oxlint-disable-next-line effecttsgo/async-function -- [EH-319] schema migration bootstrap intentionally awaits Kysely DDL execution.
export const ensurePersistenceSchema = async (database: SqlDatabaseClient): Promise<void> => {
  await database.schema
    .createTable("cms_state")
    .ifNotExists()
    .addColumn("singleton_id", "integer", (column) => column.primaryKey())
    .addColumn("entry_generation", "integer", (column) => column.notNull())
    .addColumn("storage_generation", "integer", (column) => column.notNull())
    .addColumn("catalog_json", "text")
    .addColumn("records_json", "text", (column) => column.notNull())
    .addColumn("assets_json", "text", (column) => column.notNull())
    .addColumn("updated_at", "text", (column) => column.notNull())
    .execute();
};
