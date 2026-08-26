import type { Asset, Persistence } from "nearly-headless-cms";
import { CmsError, Identifier } from "nearly-headless-cms";
import type { ContentDefinition } from "nearly-headless-cms";
import { Effect, Layer } from "effect";
import { localAssetBlobStore } from "../assets/local-asset-blob-store.ts";
import { openSqlDatabase } from "./sql-database-connection.ts";
import { ensurePersistenceSchema } from "./sql-database-migrations.ts";
import {
  initializePersistenceState,
  makeSqlPersistenceServices,
  type SqlPersistenceConfiguration,
} from "./sql-persistence-services.ts";

export interface SqlCmsPersistenceOptions {
  readonly connectionString?: string;
  readonly assetBlobRoot: string;
  readonly definitionSnapshot: ContentDefinition.CompiledSnapshot;
}

/** SQL-backed persistence layer with local filesystem blobs standing in for S3. */
export const sqlCmsPersistenceLayer = (
  options: SqlCmsPersistenceOptions,
): Layer.Layer<
  Persistence.DefinitionCatalog | Persistence.EntryPersistence | Asset.Management,
  CmsError.InfrastructureFailure,
  Identifier.Generator
> =>
  Layer.effectContext(
    Effect.acquireRelease(
      Effect.gen(function* acquireSqlPersistence() {
        const database = yield* Effect.tryPromise({
          catch: (cause) =>
            CmsError.InfrastructureFailure.make({
              cause,
              message: "SQL database connection failed",
              retryable: true,
            }),
          try: () => openSqlDatabase(options.connectionString),
        });
        yield* Effect.tryPromise({
          catch: (cause) =>
            CmsError.InfrastructureFailure.make({
              cause,
              message: "SQL persistence schema initialization failed",
              retryable: true,
            }),
          try: () => ensurePersistenceSchema(database),
        });
        const blobStore = localAssetBlobStore({ root: options.assetBlobRoot }),
          configuration: SqlPersistenceConfiguration = {
            blobStore,
            database,
            definitionSnapshot: options.definitionSnapshot,
          },
          initialState = yield* Effect.tryPromise({
            catch: (cause) =>
              CmsError.InfrastructureFailure.make({
                cause,
                message: "SQL persistence state initialization failed",
                retryable: true,
              }),
            try: () => initializePersistenceState(configuration),
          }),
          identifiers = yield* Identifier.Generator;
        return {
          context: yield* makeSqlPersistenceServices(configuration, identifiers, initialState),
          database,
        };
      }),
      ({ database }) =>
        Effect.tryPromise({
          catch: () =>
            CmsError.InfrastructureFailure.make({
              message: "SQL persistence shutdown failed",
              retryable: false,
            }),
          try: () => database.destroy(),
        }).pipe(Effect.ignore),
    ).pipe(Effect.map(({ context }) => context)),
  );
