// oxlint-disable-next-line effecttsgo/node-builtin-import -- This Bun adapter needs durable fsync/open and directory primitives unavailable in Effect's portable FileSystem layer.
import { open, rm } from "node:fs/promises";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Bun does not provide a path manipulation API; these operations are platform-neutral string handling.
import { join } from "node:path";
import { type CompileOptions, type CompiledSnapshot, compile } from "../../content-definition.ts";
import type { CatalogState, DefinitionSnapshotRecord } from "../../persistence.ts";
import { DateTime } from "effect";
import {
  type Configuration,
  type DiskCatalog,
  type DiskGeneration,
  type DiskManifest,
  type State,
  type WriterLock,
  emptyLength,
  generationFilenameWidth,
  initialVersion,
  lockProbeSignal,
  stagingPrefix,
  storageFormat,
  storageFormatVersion,
} from "./bun-filesystem-persistence-types.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const { digest, encode, filesystemErrorCode, synchronize, writeAtomic } = filesystemSupport,
  // oxlint-disable-next-line effecttsgo/async-function -- Recovery locking is a filesystem callback boundary.
  acquireRecoveryGuard = async (configuration: Configuration): Promise<() => Promise<void>> => {
    const guardPath = join(configuration.root, `${stagingPrefix}writer-recovery`),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- lock acquisition is a synchronous token-generation step around Bun file operations.
      guardToken = crypto.randomUUID();
    try {
      await createRecoveryGuard(guardPath, guardToken);
    } catch (error) {
      if (filesystemErrorCode(error) !== "EEXIST") {
        throw error;
      }
      await reclaimStaleRecoveryGuard(guardPath);
      await createRecoveryGuard(guardPath, guardToken);
    }
    // oxlint-disable-next-line effecttsgo/async-function -- Returned release callback closes the Bun filesystem guard.
    return async () => {
      const guard = await readWriterLock(guardPath).catch(() => {});
      if (guard?.token === guardToken) {
        await rm(guardPath, { force: true });
      }
    };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Writer lock creation is a sequential Bun filesystem boundary.
  acquireWriterLock = async (
    configuration: Configuration,
  ): Promise<{ readonly lockPath: string; readonly lockToken: string }> => {
    const lockPath = join(configuration.root, "writer.lock"),
      // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- lock acquisition is a synchronous token-generation step around Bun file operations.
      lockToken = crypto.randomUUID(),
      immediateLock = await tryCreateWriterLock(configuration, lockPath, lockToken);
    if (immediateLock !== undefined) {
      return immediateLock;
    }
    const releaseRecoveryGuard = await acquireRecoveryGuard(configuration);
    try {
      const recoveredLock = await tryCreateWriterLock(configuration, lockPath, lockToken);
      if (recoveredLock !== undefined) {
        return recoveredLock;
      }
      return await recoverStaleWriterLock(configuration, lockPath, lockToken);
    } finally {
      await releaseRecoveryGuard();
    }
  },
  catalogGenerationFields = (catalog: CatalogState | undefined): { readonly catalog?: DiskCatalog } => {
    if (catalog === undefined) {
      return {};
    }
    return { catalog: encodeCatalog(catalog) };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Guard creation requires sequential Bun filesystem operations.
  createRecoveryGuard = async (guardPath: string, guardToken: string): Promise<void> => {
    const handle = await open(guardPath, "wx");
    try {
      await handle.writeFile(JSON.stringify({ processId: process.pid, token: guardToken }));
      await handle.close();
    } catch (error) {
      await handle.close().catch(() => {});
      await rm(guardPath, { force: true }).catch(() => {});
      throw error;
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Lock creation requires sequential Bun filesystem operations.
  createWriterLock = async (
    configuration: Configuration,
    lockPath: string,
    lockToken: string,
  ): Promise<void> => {
    const createdAt = DateTime.formatIso(DateTime.nowUnsafe()),
      handle = await open(lockPath, "wx");
    try {
      await handle.writeFile(
        JSON.stringify({
          createdAt,
          processId: process.pid,
          token: lockToken,
        }),
      );
      if (configuration.acknowledgement === "durable") {
        await handle.sync();
        await synchronize(configuration.root);
      }
      await handle.close();
    } catch (error) {
      await handle.close().catch(() => {});
      await rm(lockPath, { force: true }).catch(() => {});
      throw error;
    }
  },
  decodeCatalog = (catalog: DiskCatalog, compileOptions: CompileOptions): CatalogState => {
    const activeInputSnapshotId = catalog.active.input.snapshotId,
      snapshots = catalog.snapshots.map((snapshot) => ({
        ...snapshot,
        compiled: compile(snapshot.input, compileOptions),
      })),
      active = snapshots.find((snapshot) => snapshot.input.snapshotId === activeInputSnapshotId);
    if (active === undefined) {
      throw new Error("Committed Definition Catalog active Snapshot is missing");
    }
    return {
      active,
      events: structuredClone(catalog.events),
      migrationManifests: structuredClone(catalog.migrationManifests),
      migrationPreparations: structuredClone(catalog.migrationPreparations),
      retiredDefinitionIds: new Set(catalog.retiredDefinitionIds),
      revisions: structuredClone(catalog.revisions),
      snapshots,
      version: catalog.version,
    };
  },
  encodeCatalog = (catalog: CatalogState): DiskCatalog => ({
    active: { activatedAt: catalog.active.activatedAt, input: catalog.active.input },
    events: catalog.events,
    migrationManifests: catalog.migrationManifests,
    migrationPreparations: catalog.migrationPreparations,
    retiredDefinitionIds: [...catalog.retiredDefinitionIds],
    revisions: catalog.revisions,
    snapshots: catalog.snapshots.map((snapshot) => ({
      activatedAt: snapshot.activatedAt,
      input: snapshot.input,
    })),
    version: catalog.version,
  }),
  initialCatalog = (snapshot: CompiledSnapshot, activatedAt: string): CatalogState => {
    const {input} = snapshot,
      revisions = input.definitions.map((definition) => {
        const revision = {
          definition,
          definitionId: definition.id,
          revision: definition.revision ?? initialVersion,
        };
        if (definition.parentRevision === undefined) {
          return revision;
        }
        return { ...revision, parentRevision: definition.parentRevision };
      }),
      snapshotRecord: DefinitionSnapshotRecord = {
        activatedAt,
        compiled: snapshot,
        input,
      };
    return {
      active: snapshotRecord,
      events: [
        {
          eventType: "snapshotActivated",
          recordedAt: activatedAt,
          snapshotId: snapshot.snapshotId,
          source: "initialization",
        },
      ],
      migrationManifests: [],
      migrationPreparations: [],
      retiredDefinitionIds: new Set(),
      revisions,
      snapshots: [snapshotRecord],
      version: initialVersion,
    };
  },
  parseWriterLock = (parsed: object): WriterLock => {
    const processIdValue: unknown = Reflect.get(parsed, "processId"),
      tokenValue: unknown = Reflect.get(parsed, "token");
    if (
      !Number.isInteger(processIdValue) ||
      typeof processIdValue !== "number" ||
      processIdValue <= emptyLength
    ) {
      throw new Error("Writer lock is corrupt");
    }
    if (
      tokenValue !== undefined &&
      (typeof tokenValue !== "string" || tokenValue.length === emptyLength)
    ) {
      throw new Error("Writer lock is corrupt");
    }
    if (tokenValue === undefined) {
      return { processId: processIdValue };
    }
    return { processId: processIdValue, token: tokenValue };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Persistence spans ordered atomic filesystem writes.
  persistState = async (configuration: Configuration, state: State): Promise<void> => {
    const catalogPayload = catalogGenerationFields(state.catalog),
      generation: DiskGeneration = {
        assets: [...state.assets.values()],
        ...catalogPayload,
        entryGeneration: state.entryGeneration,
        format: storageFormat,
        generation: state.generation,
        records: [...state.records],
        version: storageFormatVersion,
      },
      generationBytes = encode(generation),
      generationName = `generation-${String(state.generation).padStart(generationFilenameWidth, "0")}.json`,
      generationPath = join(configuration.root, "generations", generationName),
      manifest: DiskManifest = {
        format: storageFormat,
        generation: state.generation,
        generationDigest: digest(generationBytes),
        generationFile: `generations/${generationName}`,
        version: storageFormatVersion,
      };
    await writeAtomic(generationPath, generationBytes, configuration.acknowledgement);
    await writeAtomic(
      join(configuration.root, "manifest.json"),
      encode(manifest),
      configuration.acknowledgement,
    );
  },
  processIsActive = (processId: number): boolean => {
    try {
      process.kill(processId, lockProbeSignal);
      return true;
    } catch (error) {
      return filesystemErrorCode(error) !== "ESRCH";
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Stale guard recovery reads and reclaims a Bun filesystem record.
  reclaimStaleRecoveryGuard = async (guardPath: string): Promise<void> => {
    let guardIsActive = false;
    try {
      const writerLock = await readWriterLock(guardPath);
      guardIsActive = processIsActive(writerLock.processId);
    } catch {
      guardIsActive = false;
    }
    if (guardIsActive) {
      throw new Error("Filesystem writer recovery is already in progress");
    }
    await rm(guardPath, { force: true });
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Lock records are read through Bun's filesystem Promise API.
  readWriterLock = async (lockPath: string): Promise<WriterLock> => {
    const parsed: unknown = JSON.parse(await Bun.file(lockPath).text());
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("Writer lock is corrupt");
    }
    return parseWriterLock(parsed);
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Stale lock recovery coordinates sequential Bun filesystem operations.
  recoverStaleWriterLock = async (
    configuration: Configuration,
    lockPath: string,
    lockToken: string,
  ): Promise<{ readonly lockPath: string; readonly lockToken: string }> => {
    const existingLock = await readWriterLock(lockPath);
    if (processIsActive(existingLock.processId)) {
      throw new Error("Filesystem Persistence root already has an initialized writer");
    }
    await rm(lockPath, { force: true });
    try {
      await createWriterLock(configuration, lockPath, lockToken);
    } catch (error) {
      if (filesystemErrorCode(error) === "EEXIST") {
        throw new Error("Filesystem Persistence root already has an initialized writer", {
          cause: error,
        });
      }
      throw error;
    }
    return { lockPath, lockToken };
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Lock cleanup reads and removes a Bun filesystem record.
  removeOwnedWriterLock = async (lockPath: string, lockToken: string): Promise<void> => {
    const lock = await readWriterLock(lockPath).catch(() => {});
    if (lock?.token === lockToken) {
      await rm(lockPath, { force: true });
    }
  },
  // oxlint-disable-next-line effecttsgo/async-function -- Writer lock creation is a sequential Bun filesystem boundary.
  tryCreateWriterLock = async (
    configuration: Configuration,
    lockPath: string,
    lockToken: string,
  ): Promise<{ readonly lockPath: string; readonly lockToken: string } | undefined> => {
    try {
      await createWriterLock(configuration, lockPath, lockToken);
      return { lockPath, lockToken };
    } catch (error) {
      if (filesystemErrorCode(error) !== "EEXIST") {
        throw error;
      }
    }
    return undefined;
  };

export default { acquireWriterLock, decodeCatalog, initialCatalog, persistState, removeOwnedWriterLock };
