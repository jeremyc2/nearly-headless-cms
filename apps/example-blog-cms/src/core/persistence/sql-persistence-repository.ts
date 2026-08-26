import { DateTime } from "effect";
import type { SqlDatabaseClient } from "./sql-database-connection.ts";
import { cmsStateSingletonIdentifier } from "./sql-database-types.ts";
import {
  decodePersistenceState,
  encodePersistenceState,
} from "./sql-persistence-codec.ts";
import type { PersistenceState } from "./sql-persistence-state.ts";

// oxlint-disable-next-line effecttsgo/async-function -- [EH-322] SQL repository reads use Kysely's promise API directly.
export const loadPersistenceState = async (
  database: SqlDatabaseClient,
): Promise<PersistenceState | undefined> => {
  const row = await database
    .selectFrom("cms_state")
    .select([
      "entry_generation",
      "storage_generation",
      "catalog_json",
      "records_json",
      "assets_json",
    ])
    .where("singleton_id", "=", cmsStateSingletonIdentifier)
    .executeTakeFirst();
  if (row === undefined) {
    return undefined;
  }
  return decodePersistenceState(row);
};

// oxlint-disable-next-line effecttsgo/missing-pipeable-signature, effecttsgo/async-function -- [EH-329, EH-341] SQL repository writes use optimistic locking outside Effect services.
export const persistPersistenceState = async (
  database: SqlDatabaseClient,
  expectedEntryGeneration: number,
  nextState: PersistenceState,
): Promise<void> => {
  const encoded = encodePersistenceState(nextState),
    updatedAt = DateTime.formatIso(DateTime.nowUnsafe()),
    existing = await database
      .selectFrom("cms_state")
      .select(["entry_generation"])
      .where("singleton_id", "=", cmsStateSingletonIdentifier)
      .executeTakeFirst();
  if (existing === undefined) {
    if (expectedEntryGeneration !== 0) {
      throw new Error("SQL Entry generation is stale");
    }
    await database
      .insertInto("cms_state")
      .values({
        assets_json: encoded.assets_json,
        catalog_json: encoded.catalog_json,
        entry_generation: encoded.entry_generation,
        records_json: encoded.records_json,
        singleton_id: cmsStateSingletonIdentifier,
        storage_generation: encoded.storage_generation,
        updated_at: updatedAt,
      })
      .execute();
    return;
  }
  if (existing.entry_generation !== expectedEntryGeneration) {
    throw new Error("SQL Entry generation is stale");
  }
  const updatedRows = await database
    .updateTable("cms_state")
    .set({
      assets_json: encoded.assets_json,
      catalog_json: encoded.catalog_json,
      entry_generation: encoded.entry_generation,
      records_json: encoded.records_json,
      storage_generation: encoded.storage_generation,
      updated_at: updatedAt,
    })
    .where("singleton_id", "=", cmsStateSingletonIdentifier)
    .where("entry_generation", "=", expectedEntryGeneration)
    .executeTakeFirst();
  if (Number(updatedRows.numUpdatedRows) === 0) {
    throw new Error("SQL Entry generation is stale");
  }
};
