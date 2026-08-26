import { Database, type Statement } from "bun:sqlite";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-331] SQL bootstrap needs native directory creation before Kysely opens SQLite.
import { mkdir } from "node:fs/promises";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-145] Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { dirname } from "node:path";
import { Kysely, SqliteDialect } from "kysely";
import type { SqlDatabase } from "./sql-database-types.ts";

const defaultConnectionString = "file:.data/example-blog-cms/cms.sqlite",
  postgresDialectPlaceholderMessage =
    "Swap SqliteDialect for PostgresDialect when pointing at AWS RDS",
  isReadOnlySqlStatement = (sql: string): boolean => {
    const trimmedSql = sql.trimStart().toLowerCase();
    return (
      trimmedSql.startsWith("select") ||
      trimmedSql.startsWith("with") ||
      trimmedSql.startsWith("pragma")
    );
  };

type BunPreparedStatement = Statement & { readonly reader?: boolean };

/** Wraps Bun SQLite so Kysely's driver can detect read-only prepared statements. */
const createKyselyCompatibleBunDatabase = (absoluteSqlitePath: string): Database => {
  const database = new Database(absoluteSqlitePath, { create: true }),
    prepareStatement = database.prepare.bind(database);
  database.prepare = ((sql: string) => {
    const statement = prepareStatement(sql) as BunPreparedStatement;
    if (statement.reader === undefined && isReadOnlySqlStatement(sql)) {
      Object.defineProperty(statement, "reader", { value: true });
    }
    return statement;
  }) as typeof database.prepare;
  return database;
};

/** Opens a Kysely connection from DATABASE_URL (SQLite locally; Postgres in production). */
// oxlint-disable-next-line effecttsgo/async-function -- [EH-320] SQL connection bootstrap intentionally awaits native filesystem and SQLite setup.
export const openSqlDatabase = async (
  connectionString = Bun.env["DATABASE_URL"],
): Promise<Kysely<SqlDatabase>> => {
  const resolvedConnectionString = connectionString ?? defaultConnectionString;
  if (
    resolvedConnectionString.startsWith("postgres://") ||
    resolvedConnectionString.startsWith("postgresql://")
  ) {
    throw new Error(
      `${postgresDialectPlaceholderMessage}. Install pg and use PostgresDialect with the same schema.`,
    );
  }
  const sqlitePath = resolvedConnectionString.startsWith("file:")
    ? resolvedConnectionString.slice("file:".length)
    : resolvedConnectionString,
    absoluteSqlitePath = sqlitePath.startsWith("/")
      ? sqlitePath
      : `${process.cwd()}/${sqlitePath}`;
  await mkdir(dirname(absoluteSqlitePath), { recursive: true });
  return new Kysely<SqlDatabase>({
    dialect: new SqliteDialect({
      // oxlint-disable-next-line typescript/no-unsafe-type-assertion -- [EH-314] Kysely expects better-sqlite3; Bun SQLite needs a prepare wrapper for reader detection.
      database: createKyselyCompatibleBunDatabase(absoluteSqlitePath) as never,
    }),
  });
};

export type SqlDatabaseClient = Kysely<SqlDatabase>;
