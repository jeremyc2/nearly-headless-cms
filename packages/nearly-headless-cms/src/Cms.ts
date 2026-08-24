import { Clock, Context, Effect, Layer, Semaphore } from "effect";
import {
  Management as AssetManagement,
  type Asset as AssetValue,
  type IngestInput,
  type StoredAsset,
} from "./asset.ts";
import { Service as AuthorizationService } from "./authorization.ts";
import {
  AssetReferenced,
  type CmsError,
  Conflict,
  Forbidden,
  InvalidInput,
  NotFound,
  ReferenceBlockedDeletion,
  UnsupportedQueryCapability,
} from "./cms-error.ts";
import {
  type CompileOptions,
  type CompiledContentType,
  type CompiledSnapshot,
  type Definition,
  type Field,
  type RelationshipFieldKind,
  type ResolvedField,
  type SnapshotInput,
  capabilitiesFor,
  classifyCompatibility,
  compile,
} from "./content-definition.ts";
import {
  type Handler,
  type Manifest,
  type Preparation,
  assertFresh,
  path as migrationPath,
  prepare,
  validateGraph,
} from "./definition-migration.ts";
import type { CreateInput, ReadInput, Representation, UpdateInput } from "./entry.ts";
import type {
  CurrentState,
  DeletionRecord,
  ListRevisionsInput,
  RestoreInput,
  Revision,
  RevisionPage,
} from "./entry-history.ts";
import { type Query, type QueryPage, evaluate as evaluateQuery } from "./entry-query.ts";
import { Generator } from "./identifier.ts";
import { CurrentIdentity } from "./identity.ts";
import type { Action, Resource } from "./operation.ts";
import {
  type CatalogState,
  DefinitionCatalog,
  type DefinitionSnapshotRecord,
  type EntryGeneration,
  EntryPersistence,
  type EntryRecord,
} from "./persistence.ts";
import * as RichText from "./rich-text.ts";
import {
  type JsonObject,
  type JsonValue,
  canonicalJson,
  cloneJson,
  isJsonObject,
} from "./internal/json.ts";

export type MutationResult = Representation | CurrentState;
export type DeleteResult = void | DeletionRecord;

export interface ConsistentReadSnapshot {
  readonly assets: readonly StoredAsset[];
  readonly definitionSnapshot: CompiledSnapshot;
  readonly entries: readonly Representation[];
  readonly generation: number;
}

export interface DeleteEntryInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken?: string;
}

export interface PurgeEntryInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken: string;
}

export type EntryBatchMutation =
  | { readonly kind: "replace"; readonly input: UpdateInput }
  | { readonly kind: "delete"; readonly input: DeleteEntryInput };

export type EntryBatchMutationResult = MutationResult | DeleteResult;

export interface ReadRevisionInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly revisionNumber: number;
}

export interface AppendDefinitionRevisionInput {
  readonly expectedCatalogVersion: number;
  readonly definition: Definition;
  readonly source?: string;
}

export interface ActivateDefinitionSnapshotInput {
  readonly expectedCatalogVersion: number;
  readonly snapshot: SnapshotInput;
  readonly migration?: {
    readonly manifest: Manifest;
    readonly handlers?: readonly Handler[];
    readonly preparationId?: string;
  };
  readonly source?: string;
}

export interface ActivateDefinitionSnapshotResult {
  readonly snapshot: CompiledSnapshot;
  readonly catalogVersion: number;
  readonly migratedEntryCount: number;
}

export interface RetireDefinitionInput {
  readonly expectedCatalogVersion: number;
  readonly definitionId: string;
  readonly source?: string;
}

export interface AppendMigrationManifestInput {
  readonly expectedCatalogVersion: number;
  readonly manifest: Manifest;
}

export interface PrepareDefinitionMigrationInput {
  readonly expectedCatalogVersion: number;
  readonly manifestId: string;
  readonly snapshot: SnapshotInput;
}

export interface CmsLayerOptions extends CompileOptions {
  readonly migrationHandlers?: readonly Handler[];
}

export interface ServiceShape {
  readonly readDefinitionCatalog: Effect.Effect<CatalogState, CmsError>;
  readonly appendDefinitionRevision: (
    input: AppendDefinitionRevisionInput,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly activateDefinitionSnapshot: (
    input: ActivateDefinitionSnapshotInput,
  ) => Effect.Effect<ActivateDefinitionSnapshotResult, CmsError>;
  readonly retireDefinition: (
    input: RetireDefinitionInput,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly appendMigrationManifest: (
    input: AppendMigrationManifestInput,
  ) => Effect.Effect<CatalogState, CmsError>;
  readonly prepareDefinitionMigration: (
    input: PrepareDefinitionMigrationInput,
  ) => Effect.Effect<Preparation, CmsError>;
  readonly createEntry: (input: CreateInput) => Effect.Effect<MutationResult, CmsError>;
  readonly getEntry: (input: ReadInput) => Effect.Effect<Representation, CmsError>;
  readonly updateEntry: (input: UpdateInput) => Effect.Effect<MutationResult, CmsError>;
  readonly deleteEntry: (input: DeleteEntryInput) => Effect.Effect<DeleteResult, CmsError>;
  readonly mutateEntriesAtomically: (
    mutations: readonly EntryBatchMutation[],
  ) => Effect.Effect<readonly EntryBatchMutationResult[], CmsError>;
  readonly queryEntries: (query: Query) => Effect.Effect<QueryPage, CmsError>;
  readonly getCurrentEntryState: (
    input: Pick<ReadInput, "contentTypeId" | "entryId">,
  ) => Effect.Effect<CurrentState, CmsError>;
  readonly listEntryRevisions: (input: ListRevisionsInput) => Effect.Effect<RevisionPage, CmsError>;
  readonly inspectEntryRevision: (input: ReadRevisionInput) => Effect.Effect<Revision, CmsError>;
  readonly restoreEntryRevision: (input: RestoreInput) => Effect.Effect<CurrentState, CmsError>;
  readonly permanentlyPurgeEntry: (input: PurgeEntryInput) => Effect.Effect<void, CmsError>;
  readonly ingestAsset: (input: IngestInput) => Effect.Effect<AssetValue, CmsError>;
  readonly getAsset: (assetId: string) => Effect.Effect<AssetValue, CmsError>;
  readonly readAsset: (assetId: string) => Effect.Effect<StoredAsset, CmsError>;
  readonly listAssets: Effect.Effect<readonly AssetValue[], CmsError>;
  readonly deleteAsset: (assetId: string) => Effect.Effect<void, CmsError>;
  readonly activeDefinitionSnapshot: Effect.Effect<CompiledSnapshot, CmsError>;
  readonly readConsistentSnapshot: Effect.Effect<ConsistentReadSnapshot, CmsError>;
}

export class Service extends Context.Service<Service, ServiceShape>()(
  "nearly-headless-cms/Cms/Service",
) {}

const attempt = <Value>(operation: () => Value): Effect.Effect<Value, InvalidInput> =>
    Effect.try({
      catch: (cause) =>
        cause instanceof InvalidInput
          ? cause
          : InvalidInput.make({
              message: cause instanceof Error ? cause.message : "Invalid input",
            }),
      try: operation,
    }),
  liveRecords = (generation: EntryGeneration): readonly EntryRecord[] =>
    [...generation.records.values()].filter((record) => record.deletionRecord === undefined);

interface References {
  readonly relationships: readonly {
    readonly entryId: string;
    readonly targetContentTypeIds: ReadonlyArray<string>;
  }[];
  readonly assetIds: readonly string[];
}

const relationshipKind = (field: Field): RelationshipFieldKind | undefined => {
    if (field.kind.kind === "relationship") {
      return field.kind;
    }
    if (field.kind.kind === "list" && field.kind.element.kind === "relationship") {
      return field.kind.element;
    }
    return undefined;
  },
  collectReferences = (contentType: CompiledContentType, values: JsonObject): References => {
    const relationships: { entryId: string; targetContentTypeIds: ReadonlyArray<string> }[] = [],
      assetIds: string[] = [],
      visit = (fields: readonly ResolvedField[], object: JsonObject): void => {
        for (const field of fields) {
          const value = object[field.key];
          if (value === undefined || value === null) {
            continue;
          }
          if (
            field.nestedFields !== undefined &&
            field.kind.kind === "list" &&
            Array.isArray(value)
          ) {
            for (const item of value) {
              if (isJsonObject(item)) visit(field.nestedFields, item);
            }
            continue;
          }
          if (field.nestedFields !== undefined && isJsonObject(value)) {
            visit(field.nestedFields, value);
            continue;
          }
          const relationship = relationshipKind(field);
          if (relationship !== undefined) {
            const entryIds = Array.isArray(value) ? value : [value];
            for (const entryId of entryIds) {
              if (typeof entryId === "string")
                relationships.push({
                  entryId,
                  targetContentTypeIds: relationship.targetContentTypeIds,
                });
            }
          }
          const isAssetField =
            field.kind.kind === "asset" ||
            (field.kind.kind === "list" && field.kind.element.kind === "asset");
          if (isAssetField) {
            const fieldAssetIds = Array.isArray(value) ? value : [value];
            for (const assetId of fieldAssetIds) {
              if (typeof assetId === "string") assetIds.push(assetId);
            }
          }
          if (field.kind.kind === "rich-text") {
            const document = RichText.validate(value),
              richTextReferences = RichText.references(document);
            for (const entryId of richTextReferences.entryIds) {
              relationships.push({ entryId, targetContentTypeIds: [] });
            }
            assetIds.push(...richTextReferences.assetIds);
          }
        }
      };
    visit(contentType.fields, values);
    return { assetIds, relationships };
  },
  valueAtPath = (values: JsonObject, path: readonly string[]): JsonValue | undefined => {
    let current: JsonValue | undefined = values;
    for (const segment of path) {
      if (!isJsonObject(current)) {
        return undefined;
      }
      current = current[segment];
    }
    return current;
  },
  fieldsAtPaths = (
    fields: readonly ResolvedField[],
    parentPath: readonly string[] = [],
  ): readonly { readonly field: ResolvedField; readonly path: ReadonlyArray<string> }[] =>
    fields.flatMap((field) => {
      const path = [...parentPath, field.key];
      return [
        { field, path },
        ...(field.nestedFields === undefined ? [] : fieldsAtPaths(field.nestedFields, path)),
      ];
    }),
  ensureUniqueValues = (
    contentType: CompiledContentType,
    values: JsonObject,
    records: Iterable<EntryRecord>,
    ignoredEntryId?: string,
  ): void => {
    for (const { path } of fieldsAtPaths(contentType.fields).filter(
      (candidate) => candidate.field.unique,
    )) {
      const candidateValue = valueAtPath(values, path);
      if (candidateValue === undefined || candidateValue === null) {
        continue;
      }
      for (const record of records) {
        if (
          record.deletionRecord !== undefined ||
          record.entry.id === ignoredEntryId ||
          record.entry.contentTypeId !== contentType.definition.id
        ) {
          continue;
        }
        if (
          JSON.stringify(valueAtPath(record.entry.values, path)) === JSON.stringify(candidateValue)
        ) {
          throw Conflict.make({
            message: `Unique Field ${path.join(".")} already contains this value`,
          });
        }
      }
    }
  },
  ensureReferences = (
    references: References,
    generation: EntryGeneration,
    assets: AssetManagement["Service"],
  ): Effect.Effect<void, CmsError> =>
    Effect.gen(function* ensureReferences() {
      for (const relationship of references.relationships) {
        const target = generation.records.get(relationship.entryId);
        if (
          target === undefined ||
          target.deletionRecord !== undefined ||
          (relationship.targetContentTypeIds.length > 0 &&
            !relationship.targetContentTypeIds.includes(target.entry.contentTypeId))
        ) {
          return yield* InvalidInput.make({
            message: `Relationship target ${relationship.entryId} does not exist in an allowed Content Type`,
          });
        }
      }
      for (const assetId of references.assetIds) {
        yield* assets.get(assetId);
      }
    }),
  project = (entry: Representation, projection: readonly string[] | undefined): Representation => {
    if (projection === undefined) {
      return structuredClone(entry);
    }
    const values: Record<string, JsonValue> = {};
    for (const path of projection) {
      const segments = path.split("."),
        value = valueAtPath(entry.values, segments);
      if (value === undefined) {
        continue;
      }
      let current = values;
      for (const [index, segment] of segments.entries()) {
        if (index === segments.length - 1) {
          current[segment] = cloneJson(value);
        } else {
          const existing = current[segment],
            nested: Record<string, JsonValue> = isJsonObject(existing) ? { ...existing } : {};
          current[segment] = nested;
          current = nested;
        }
      }
    }
    return { contentTypeId: entry.contentTypeId, id: entry.id, values };
  },
  maximumExpansionDepth = 8,
  maximumExpansionPaths = 20,
  groupExpansionPaths = (paths: readonly string[]): ReadonlyMap<string, readonly string[]> => {
    if (paths.length > maximumExpansionPaths) {
      throw InvalidInput.make({
        message: `Relationship Expansion cannot contain more than ${maximumExpansionPaths} paths`,
      });
    }
    const grouped = new Map<string, string[]>();
    for (const path of paths) {
      const segments = path.split(".");
      if (segments.some((segment) => segment.length === 0)) {
        throw InvalidInput.make({ message: `Invalid Relationship Expansion path ${path}` });
      }
      if (segments.length > maximumExpansionDepth) {
        throw InvalidInput.make({
          message: `Relationship Expansion cannot exceed ${maximumExpansionDepth} levels`,
        });
      }
      const root = segments[0]!,
        remainder = segments.slice(1).join("."),
        nested = grouped.get(root) ?? [];
      if (remainder.length > 0) {
        nested.push(remainder);
      }
      grouped.set(root, nested);
    }
    return grouped;
  },
  expandedEntryValue = (entry: Representation): JsonObject => ({
    contentTypeId: entry.contentTypeId,
    id: entry.id,
    values: cloneJson(entry.values),
  }),
  expandObject = (
    fields: readonly ResolvedField[],
    object: JsonObject,
    expansion: readonly string[],
    snapshot: CompiledSnapshot,
    generation: EntryGeneration,
    ancestorEntryIds: ReadonlySet<string>,
    parentPath = "",
  ): JsonObject => {
    const values: Record<string, JsonValue> = Object.fromEntries(
      Object.entries(object).map(([key, value]) => [key, cloneJson(value)]),
    );
    for (const [fieldKey, nestedPaths] of groupExpansionPaths(expansion)) {
      const fieldPath = parentPath.length === 0 ? fieldKey : `${parentPath}.${fieldKey}`,
        field = fields.find((candidate) => candidate.key === fieldKey),
        relationship = field === undefined ? undefined : relationshipKind(field);
      if (field === undefined) {
        throw InvalidInput.make({ message: `Field ${fieldPath} is not expandable` });
      }
      const value = values[fieldKey];
      if (value === undefined || value === null) {
        continue;
      }
      if (relationship === undefined) {
        if (field.nestedFields === undefined || nestedPaths.length === 0) {
          throw InvalidInput.make({
            message: `Field ${fieldPath} is not an expandable Relationship`,
          });
        }
        if (field.kind.kind === "list") {
          if (!Array.isArray(value)) {
            throw InvalidInput.make({
              message: `Field Group List ${fieldPath} contains an invalid value`,
            });
          }
          values[fieldKey] = value.map((item) => {
            if (!isJsonObject(item)) {
              throw InvalidInput.make({
                message: `Field Group List ${fieldPath} contains an invalid item`,
              });
            }
            return expandObject(
              field.nestedFields!,
              item,
              nestedPaths,
              snapshot,
              generation,
              ancestorEntryIds,
              fieldPath,
            );
          });
        } else {
          if (!isJsonObject(value)) {
            throw InvalidInput.make({
              message: `Field Group ${fieldPath} contains an invalid value`,
            });
          }
          values[fieldKey] = expandObject(
            field.nestedFields,
            value,
            nestedPaths,
            snapshot,
            generation,
            ancestorEntryIds,
            fieldPath,
          );
        }
        continue;
      }
      const configuredCapabilities = field.kind.capabilities;
      if (
        configuredCapabilities?.expandable === false ||
        (configuredCapabilities === undefined &&
          field.kind.kind !== "list" &&
          !capabilitiesFor(field.kind).expandable)
      ) {
        throw UnsupportedQueryCapability.make({
          message: `Field ${fieldPath} does not support Relationship Expansion`,
        });
      }
      const expandEntryId = (entryId: JsonValue): JsonValue => {
        if (typeof entryId !== "string") {
          throw InvalidInput.make({
            message: `Relationship ${fieldPath} contains an invalid Entry ID`,
          });
        }
        if (ancestorEntryIds.has(entryId)) {
          return entryId;
        }
        const target = generation.records.get(entryId);
        if (
          target === undefined ||
          target.deletionRecord !== undefined ||
          !relationship.targetContentTypeIds.includes(target.entry.contentTypeId)
        ) {
          throw InvalidInput.make({
            message: `Relationship target ${entryId} does not exist in an allowed Content Type`,
          });
        }
        const expandedTarget =
          nestedPaths.length === 0
            ? structuredClone(target.entry)
            : expandRepresentation(
                target.entry,
                nestedPaths,
                snapshot,
                generation,
                ancestorEntryIds,
              );
        return expandedEntryValue(expandedTarget);
      };
      values[fieldKey] = Array.isArray(value) ? value.map(expandEntryId) : expandEntryId(value);
    }
    return values;
  },
  expandRepresentation = (
    entry: Representation,
    expansion: readonly string[] | undefined,
    snapshot: CompiledSnapshot,
    generation: EntryGeneration,
    ancestorEntryIds: ReadonlySet<string> = new Set(),
  ): Representation => {
    if (expansion === undefined || expansion.length === 0) {
      return structuredClone(entry);
    }
    const contentType = snapshot.contentTypes.get(entry.contentTypeId);
    if (contentType === undefined) {
      throw InvalidInput.make({ message: `Unknown Content Type ${entry.contentTypeId}` });
    }
    const nextAncestors = new Set(ancestorEntryIds).add(entry.id),
      values = expandObject(
        contentType.fields,
        entry.values,
        expansion,
        snapshot,
        generation,
        nextAncestors,
      );
    return { contentTypeId: entry.contentTypeId, id: entry.id, values };
  },
  historyCursor = (offset: number, entryId: string): string =>
    btoa(JSON.stringify({ entryId, offset }))
      .replaceAll("+", "-")
      .replaceAll("/", "_")
      .replace(/=+$/u, ""),
  decodeHistoryCursor = (cursor: string | undefined, entryId: string): number => {
    if (cursor === undefined) {
      return 0;
    }
    try {
      const normalized = cursor.replaceAll("-", "+").replaceAll("_", "/"),
        parsed = JSON.parse(
          atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
        ) as Readonly<Record<string, unknown>>;
      if (parsed["entryId"] !== entryId || !Number.isSafeInteger(parsed["offset"])) {
        throw new Error("invalid");
      }
      return parsed["offset"] as number;
    } catch {
      throw Conflict.make({ message: "History cursor is invalid or belongs to another Entry" });
    }
  },
  applyRetention = (
    revisions: readonly Revision[],
    contentType: CompiledContentType,
    now: number,
  ): readonly Revision[] => {
    const policy = contentType.definition.revisionRetention;
    if (policy === undefined) {
      return revisions;
    }
    let retained = [...revisions];
    if (policy.maximumAgeMilliseconds !== undefined) {
      retained = retained.filter(
        (revision, index) =>
          index === retained.length - 1 ||
          now - Date.parse(revision.recordedAt) <= policy.maximumAgeMilliseconds!,
      );
    }
    if (
      policy.maximumRevisionCount !== undefined &&
      retained.length > policy.maximumRevisionCount
    ) {
      retained = retained.slice(-Math.max(1, policy.maximumRevisionCount));
    }
    return retained;
  };

export const makeLayer = (
  options: CmsLayerOptions = {},
): Layer.Layer<
  Service,
  never,
  | AuthorizationService
  | CurrentIdentity
  | DefinitionCatalog
  | EntryPersistence
  | AssetManagement
  | Generator
> =>
  Layer.effect(
    Service,
    Effect.gen(function* layer() {
      const authorization = yield* AuthorizationService,
        currentIdentity = yield* CurrentIdentity,
        catalog = yield* DefinitionCatalog,
        persistence = yield* EntryPersistence,
        assets = yield* AssetManagement,
        identifiers = yield* Generator,
        operationGate = yield* Semaphore.make(1),
        compileOptions: CompileOptions = {
          ...(options.customFieldKinds === undefined
            ? {}
            : { customFieldKinds: options.customFieldKinds }),
          ...(options.richTextExtensions === undefined
            ? {}
            : { richTextExtensions: options.richTextExtensions }),
        },
        migrationHandlers = new Map(
          (options.migrationHandlers ?? []).map((handler) => [
            `${handler.identifier}@${handler.version}`,
            handler,
          ]),
        ),
        currentDefinitionSnapshot = catalog.read.pipe(Effect.map((state) => state.active.compiled)),
        authorize = (action: Action, resource: Resource): Effect.Effect<void, CmsError> =>
          Effect.gen(function* authorize() {
            const identity = yield* currentIdentity.current,
              allowed = yield* authorization.authorize(identity, action, resource);
            if (!allowed) {
              return yield* Forbidden.make({ message: "The operation is forbidden" });
            }
          }),
        entryResource = (
          snapshot: CompiledSnapshot,
          contentTypeId: string,
          entryId?: string,
        ): Resource => ({
          contentTypeId,
          definitionSpaceId: snapshot.definitionSpaceId,
          kind: "entry",
          ...(entryId === undefined ? {} : { entryId }),
        }),
        createEntry = (input: CreateInput): Effect.Effect<MutationResult, CmsError> =>
          Effect.gen(function* createEntry() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize("entry.create", entryResource(snapshot, input.contentTypeId));
            const contentType = snapshot.contentTypes.get(input.contentTypeId);
            if (contentType === undefined) {
              return yield* InvalidInput.make({
                message: `Unknown Content Type ${input.contentTypeId}`,
              });
            }
            const values = yield* attempt(() =>
                snapshot.validateEntry(input.contentTypeId, input.values, { applyDefaults: true }),
              ),
              generation = yield* persistence.readGeneration;
            yield* attempt(() => {
              ensureUniqueValues(contentType, values, generation.records.values());
            });
            yield* ensureReferences(
              yield* attempt(() => collectReferences(contentType, values)),
              generation,
              assets,
            );
            const entryId = yield* identifiers.generate("entry"),
              entry: Representation = { contentTypeId: input.contentTypeId, id: entryId, values },
              records = new Map(generation.records);
            if (!contentType.definition.history) {
              records.set(entryId, { entry, revisions: [] });
              yield* persistence.commitGeneration(generation.generation, records);
              return entry;
            }
            const writeToken = yield* identifiers.generate("write-token"),
              recordedAt = new Date(yield* Clock.currentTimeMillis).toISOString(),
              revision: Revision = {
                definitionSnapshotId: snapshot.snapshotId,
                recordedAt,
                revisionNumber: 1,
                values: cloneJson(values),
              };
            records.set(entryId, { entry, revisions: [revision], writeToken });
            yield* persistence.commitGeneration(generation.generation, records);
            return { entry, revisionNumber: 1, writeToken };
          }),
        getEntry = (input: ReadInput): Effect.Effect<Representation, CmsError> =>
          Effect.gen(function* getEntry() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.read",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            if (input.expansion !== undefined && input.expansion.length > 0) {
              yield* authorize(
                "entry.expand",
                entryResource(snapshot, input.contentTypeId, input.entryId),
              );
            }
            const generation = yield* persistence.readGeneration,
              record = generation.records.get(input.entryId);
            if (
              record === undefined ||
              record.deletionRecord !== undefined ||
              record.entry.contentTypeId !== input.contentTypeId
            ) {
              return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
            }
            return project(
              yield* attempt(() =>
                expandRepresentation(record.entry, input.expansion, snapshot, generation),
              ),
              input.projection,
            );
          }),
        updateEntry = (input: UpdateInput): Effect.Effect<MutationResult, CmsError> =>
          Effect.gen(function* updateEntry() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.update",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            const contentType = snapshot.contentTypes.get(input.contentTypeId);
            if (contentType === undefined) {
              return yield* InvalidInput.make({
                message: `Unknown Content Type ${input.contentTypeId}`,
              });
            }
            const generation = yield* persistence.readGeneration,
              current = generation.records.get(input.entryId);
            if (
              current === undefined ||
              current.deletionRecord !== undefined ||
              current.entry.contentTypeId !== input.contentTypeId
            ) {
              return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
            }
            if (contentType.definition.history && current.writeToken !== input.writeToken) {
              return yield* Conflict.make({ message: "Write Token is stale" });
            }
            const values = yield* attempt(() =>
              snapshot.validateEntry(input.contentTypeId, input.values, { applyDefaults: false }),
            );
            yield* attempt(() => {
              ensureUniqueValues(contentType, values, generation.records.values(), input.entryId);
            });
            yield* ensureReferences(
              yield* attempt(() => collectReferences(contentType, values)),
              generation,
              assets,
            );
            const entry: Representation = {
                contentTypeId: input.contentTypeId,
                id: input.entryId,
                values,
              },
              records = new Map(generation.records);
            if (!contentType.definition.history) {
              records.set(input.entryId, { entry, revisions: [] });
              yield* persistence.commitGeneration(generation.generation, records);
              return entry;
            }
            const writeToken = yield* identifiers.generate("write-token"),
              now = yield* Clock.currentTimeMillis,
              revisionNumber = (current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
              revision: Revision = {
                definitionSnapshotId: snapshot.snapshotId,
                recordedAt: new Date(now).toISOString(),
                revisionNumber,
                values: cloneJson(values),
              };
            records.set(input.entryId, {
              entry,
              revisions: applyRetention([...current.revisions, revision], contentType, now),
              writeToken,
            });
            yield* persistence.commitGeneration(generation.generation, records);
            return { entry, revisionNumber, writeToken };
          }),
        deleteEntry = (input: DeleteEntryInput): Effect.Effect<DeleteResult, CmsError> =>
          Effect.gen(function* deleteEntry() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.delete",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            const contentType = snapshot.contentTypes.get(input.contentTypeId),
              generation = yield* persistence.readGeneration,
              current = generation.records.get(input.entryId);
            if (
              contentType === undefined ||
              current === undefined ||
              current.deletionRecord !== undefined ||
              current.entry.contentTypeId !== input.contentTypeId
            ) {
              return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
            }
            if (contentType.definition.history && current.writeToken !== input.writeToken) {
              return yield* Conflict.make({ message: "Write Token is stale" });
            }
            for (const candidate of liveRecords(generation)) {
              const candidateContentType = snapshot.contentTypes.get(candidate.entry.contentTypeId);
              if (candidateContentType === undefined) {
                continue;
              }
              const references = yield* attempt(() =>
                collectReferences(candidateContentType, candidate.entry.values),
              );
              if (
                references.relationships.some((reference) => reference.entryId === input.entryId)
              ) {
                return yield* ReferenceBlockedDeletion.make({
                  message: "Entry deletion is blocked by a live reference",
                });
              }
            }
            const records = new Map(generation.records);
            if (!contentType.definition.history) {
              records.delete(input.entryId);
              yield* persistence.commitGeneration(generation.generation, records);
              return;
            }
            const writeToken = yield* identifiers.generate("write-token"),
              now = yield* Clock.currentTimeMillis,
              deletedAt = new Date(now).toISOString(),
              deletionRecord: DeletionRecord = {
                contentTypeId: input.contentTypeId,
                deletedAt,
                entryId: input.entryId,
                latestRevisionNumber: current.revisions.at(-1)?.revisionNumber ?? 0,
                writeToken,
              };
            records.set(input.entryId, {
              ...current,
              deletionRecord,
              revisions: applyRetention(current.revisions, contentType, now),
              writeToken,
            });
            yield* persistence.commitGeneration(generation.generation, records);
            return deletionRecord;
          }),
        mutateEntriesAtomically = (
          mutations: readonly EntryBatchMutation[],
        ): Effect.Effect<readonly EntryBatchMutationResult[], CmsError> =>
          Effect.gen(function* mutateEntriesAtomically() {
            if (mutations.length === 0) {
              return yield* InvalidInput.make({
                message: "An atomic Entry batch requires at least one mutation",
              });
            }
            const snapshot = yield* currentDefinitionSnapshot,
              generation = yield* persistence.readGeneration,
              records = new Map(generation.records),
              results: EntryBatchMutationResult[] = [];
            for (const mutation of mutations) {
              const input = mutation.input,
                contentType = snapshot.contentTypes.get(input.contentTypeId),
                current = records.get(input.entryId);
              yield* authorize(
                mutation.kind === "replace" ? "entry.update" : "entry.delete",
                entryResource(snapshot, input.contentTypeId, input.entryId),
              );
              if (
                contentType === undefined ||
                current === undefined ||
                current.deletionRecord !== undefined ||
                current.entry.contentTypeId !== input.contentTypeId
              ) {
                return yield* NotFound.make({ message: `Entry ${input.entryId} was not found` });
              }
              if (contentType.definition.history && current.writeToken !== input.writeToken) {
                return yield* Conflict.make({ message: "Write Token is stale" });
              }
              if (mutation.kind === "replace") {
                const values = yield* attempt(() =>
                  snapshot.validateEntry(input.contentTypeId, mutation.input.values, {
                    applyDefaults: false,
                  }),
                );
                yield* attempt(() => {
                  ensureUniqueValues(contentType, values, records.values(), input.entryId);
                });
                yield* ensureReferences(
                  yield* attempt(() => collectReferences(contentType, values)),
                  { generation: generation.generation, records },
                  assets,
                );
                const entry: Representation = {
                  contentTypeId: input.contentTypeId,
                  id: input.entryId,
                  values,
                };
                if (!contentType.definition.history) {
                  records.set(input.entryId, { entry, revisions: [] });
                  results.push(entry);
                  continue;
                }
                const writeToken = yield* identifiers.generate("write-token"),
                  now = yield* Clock.currentTimeMillis,
                  revisionNumber = (current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
                  revision: Revision = {
                    definitionSnapshotId: snapshot.snapshotId,
                    recordedAt: new Date(now).toISOString(),
                    revisionNumber,
                    values: cloneJson(values),
                  };
                records.set(input.entryId, {
                  entry,
                  revisions: applyRetention([...current.revisions, revision], contentType, now),
                  writeToken,
                });
                results.push({ entry, revisionNumber, writeToken });
                continue;
              }
              for (const candidate of records.values()) {
                if (
                  candidate.deletionRecord !== undefined ||
                  candidate.entry.id === input.entryId
                ) {
                  continue;
                }
                const candidateContentType = snapshot.contentTypes.get(
                  candidate.entry.contentTypeId,
                );
                if (candidateContentType === undefined) {
                  continue;
                }
                const references = yield* attempt(() =>
                  collectReferences(candidateContentType, candidate.entry.values),
                );
                if (
                  references.relationships.some((reference) => reference.entryId === input.entryId)
                ) {
                  return yield* ReferenceBlockedDeletion.make({
                    message: "Entry deletion is blocked by a live reference",
                  });
                }
              }
              if (!contentType.definition.history) {
                records.delete(input.entryId);
                results.push(undefined);
                continue;
              }
              const writeToken = yield* identifiers.generate("write-token"),
                now = yield* Clock.currentTimeMillis,
                deletedAt = new Date(now).toISOString(),
                deletionRecord: DeletionRecord = {
                  contentTypeId: input.contentTypeId,
                  deletedAt,
                  entryId: input.entryId,
                  latestRevisionNumber: current.revisions.at(-1)?.revisionNumber ?? 0,
                  writeToken,
                };
              records.set(input.entryId, {
                ...current,
                deletionRecord,
                revisions: applyRetention(current.revisions, contentType, now),
                writeToken,
              });
              results.push(deletionRecord);
            }
            yield* persistence.commitGeneration(generation.generation, records);
            return results;
          }),
        queryEntries = (query: Query): Effect.Effect<QueryPage, CmsError> =>
          Effect.gen(function* queryEntries() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize("entry.query", {
              contentTypeId: query.contentTypeId,
              definitionSpaceId: snapshot.definitionSpaceId,
              kind: "contentType",
            });
            if (query.expansion !== undefined && query.expansion.length > 0) {
              yield* authorize("entry.expand", {
                contentTypeId: query.contentTypeId,
                definitionSpaceId: snapshot.definitionSpaceId,
                kind: "contentType",
              });
            }
            const generation = yield* persistence.readGeneration,
              page = yield* attempt(() =>
                evaluateQuery(
                  liveRecords(generation).map((record) => record.entry),
                  query,
                  snapshot,
                  { generation: generation.generation },
                ),
              );
            if (query.expansion === undefined || query.expansion.length === 0) {
              return page;
            }
            const items = yield* attempt(() =>
              page.items.map((entry) =>
                expandRepresentation(entry, query.expansion, snapshot, generation),
              ),
            );
            return page.nextCursor === undefined
              ? { items }
              : { items, nextCursor: page.nextCursor };
          }),
        getCurrentEntryState = (
          input: Pick<ReadInput, "contentTypeId" | "entryId">,
        ): Effect.Effect<CurrentState, CmsError> =>
          Effect.gen(function* getCurrentEntryState() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.history.read",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            const generation = yield* persistence.readGeneration,
              record = generation.records.get(input.entryId);
            if (
              record === undefined ||
              record.deletionRecord !== undefined ||
              record.entry.contentTypeId !== input.contentTypeId ||
              record.writeToken === undefined ||
              record.revisions.length === 0
            ) {
              return yield* NotFound.make({
                message: `History-enabled Entry ${input.entryId} was not found`,
              });
            }
            return {
              entry: structuredClone(record.entry),
              revisionNumber: record.revisions.at(-1)!.revisionNumber,
              writeToken: record.writeToken,
            };
          }),
        listEntryRevisions = (input: ListRevisionsInput): Effect.Effect<RevisionPage, CmsError> =>
          Effect.gen(function* listEntryRevisions() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.history.read",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            if (
              !Number.isSafeInteger(input.pageSize) ||
              input.pageSize <= 0 ||
              input.pageSize > 100
            ) {
              return yield* InvalidInput.make({
                message: "History pageSize must be between 1 and 100",
              });
            }
            const generation = yield* persistence.readGeneration,
              record = generation.records.get(input.entryId);
            if (
              record === undefined ||
              record.entry.contentTypeId !== input.contentTypeId ||
              record.revisions.length === 0
            ) {
              return yield* NotFound.make({
                message: `Entry History ${input.entryId} was not found`,
              });
            }
            const offset = yield* attempt(() => decodeHistoryCursor(input.cursor, input.entryId)),
              newestFirst = [...record.revisions].reverse(),
              revisions = newestFirst.slice(offset, offset + input.pageSize),
              items = revisions.map(({ values: _values, ...metadata }) => metadata),
              nextOffset = offset + items.length;
            return nextOffset < newestFirst.length
              ? { items, nextCursor: historyCursor(nextOffset, input.entryId) }
              : { items };
          }),
        inspectEntryRevision = (input: ReadRevisionInput): Effect.Effect<Revision, CmsError> =>
          Effect.gen(function* inspectEntryRevision() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.history.read",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            const generation = yield* persistence.readGeneration,
              record = generation.records.get(input.entryId),
              revision = record?.revisions.find(
                (candidate) => candidate.revisionNumber === input.revisionNumber,
              );
            if (
              record === undefined ||
              record.entry.contentTypeId !== input.contentTypeId ||
              revision === undefined
            ) {
              return yield* NotFound.make({
                message: `Entry Revision ${input.revisionNumber} was not found`,
              });
            }
            return structuredClone(revision);
          }),
        restoreEntryRevision = (input: RestoreInput): Effect.Effect<CurrentState, CmsError> =>
          Effect.gen(function* restoreEntryRevision() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.history.restore",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            const contentType = snapshot.contentTypes.get(input.contentTypeId),
              generation = yield* persistence.readGeneration,
              current = generation.records.get(input.entryId);
            if (
              !contentType?.definition.history ||
              current === undefined ||
              current.writeToken !== input.writeToken
            ) {
              return yield* current === undefined
                ? NotFound.make({ message: `Entry History ${input.entryId} was not found` })
                : Conflict.make({ message: "Write Token is stale" });
            }
            const sourceRevision = current.revisions.find(
              (revision) => revision.revisionNumber === input.revisionNumber,
            );
            if (sourceRevision === undefined) {
              return yield* NotFound.make({
                message: `Entry Revision ${input.revisionNumber} was not found`,
              });
            }
            let sourceValues = sourceRevision.values;
            if (sourceRevision.definitionSnapshotId !== snapshot.snapshotId) {
              const catalogState = yield* catalog.read,
                manifests = yield* attempt(() =>
                  migrationPath(
                    catalogState.migrationManifests,
                    sourceRevision.definitionSnapshotId,
                    snapshot.snapshotId,
                  ),
                );
              let sourceSnapshotId = sourceRevision.definitionSnapshotId;
              for (const manifest of manifests) {
                const sourceSnapshot = catalogState.snapshots.find(
                    (snapshotRecord) => snapshotRecord.compiled.snapshotId === sourceSnapshotId,
                  )?.compiled,
                  targetSnapshot = catalogState.snapshots.find(
                    (snapshotRecord) =>
                      snapshotRecord.compiled.snapshotId === manifest.targetSnapshotId,
                  )?.compiled;
                if (sourceSnapshot === undefined || targetSnapshot === undefined) {
                  return yield* InvalidInput.make({
                    message:
                      "Entry Revision migration references an unavailable Definition Snapshot",
                  });
                }
                const preparation = yield* attempt(() =>
                  prepare({
                    entries: [
                      {
                        contentTypeId: input.contentTypeId,
                        id: input.entryId,
                        values: sourceValues,
                      },
                    ],
                    handlers: [...migrationHandlers.values()],
                    manifest,
                    source: sourceSnapshot,
                    sourceGeneration: generation.generation,
                    target: targetSnapshot,
                  }),
                );
                if (preparation.report.status !== "ready" || preparation.entries[0] === undefined) {
                  return yield* InvalidInput.make({
                    message: "Entry Revision cannot be migrated to the active Definition Snapshot",
                    ...(preparation.report.status === "failed"
                      ? { issues: preparation.report.issues }
                      : {}),
                  });
                }
                sourceValues = preparation.entries[0].values;
                sourceSnapshotId = manifest.targetSnapshotId;
              }
            }
            const values = yield* attempt(() =>
              snapshot.validateEntry(input.contentTypeId, sourceValues, { applyDefaults: false }),
            );
            yield* attempt(() => {
              ensureUniqueValues(contentType, values, generation.records.values(), input.entryId);
            });
            yield* ensureReferences(
              yield* attempt(() => collectReferences(contentType, values)),
              generation,
              assets,
            );
            const writeToken = yield* identifiers.generate("write-token"),
              now = yield* Clock.currentTimeMillis,
              revisionNumber = (current.revisions.at(-1)?.revisionNumber ?? 0) + 1,
              revision: Revision = {
                definitionSnapshotId: snapshot.snapshotId,
                recordedAt: new Date(now).toISOString(),
                restoredFromRevisionNumber: input.revisionNumber,
                revisionNumber,
                values: cloneJson(values),
              },
              entry: Representation = {
                contentTypeId: input.contentTypeId,
                id: input.entryId,
                values,
              },
              records = new Map(generation.records);
            records.set(input.entryId, {
              entry,
              revisions: applyRetention([...current.revisions, revision], contentType, now),
              writeToken,
            });
            yield* persistence.commitGeneration(generation.generation, records);
            return { entry, revisionNumber, writeToken };
          }),
        permanentlyPurgeEntry = (input: PurgeEntryInput): Effect.Effect<void, CmsError> =>
          Effect.gen(function* permanentlyPurgeEntry() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize(
              "entry.history.purge",
              entryResource(snapshot, input.contentTypeId, input.entryId),
            );
            const generation = yield* persistence.readGeneration,
              record = generation.records.get(input.entryId);
            if (
              record === undefined ||
              record.entry.contentTypeId !== input.contentTypeId ||
              record.deletionRecord === undefined
            ) {
              return yield* NotFound.make({
                message: `Deleted Entry ${input.entryId} was not found`,
              });
            }
            if (record.writeToken !== input.writeToken) {
              return yield* Conflict.make({ message: "Write Token is stale" });
            }
            const records = new Map(generation.records);
            records.delete(input.entryId);
            yield* persistence.commitGeneration(generation.generation, records);
          }),
        ingestAsset = (input: IngestInput): Effect.Effect<AssetValue, CmsError> =>
          Effect.gen(function* ingestAsset() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize("asset.create", {
              definitionSpaceId: snapshot.definitionSpaceId,
              kind: "asset",
            });
            return yield* assets.ingest(input);
          }),
        getAsset = (assetId: string): Effect.Effect<AssetValue, CmsError> =>
          Effect.gen(function* getAsset() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize("asset.read", {
              assetId,
              definitionSpaceId: snapshot.definitionSpaceId,
              kind: "asset",
            });
            return yield* assets.get(assetId);
          }),
        readAsset = (assetId: string): Effect.Effect<StoredAsset, CmsError> =>
          Effect.gen(function* readAsset() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize("asset.read", {
              assetId,
              definitionSpaceId: snapshot.definitionSpaceId,
              kind: "asset",
            });
            return yield* assets.read(assetId);
          }),
        listAssets = Effect.gen(function* listAssets() {
          const snapshot = yield* currentDefinitionSnapshot;
          yield* authorize("asset.read", {
            definitionSpaceId: snapshot.definitionSpaceId,
            kind: "asset",
          });
          return yield* assets.list;
        }),
        deleteAsset = (assetId: string): Effect.Effect<void, CmsError> =>
          Effect.gen(function* deleteAsset() {
            const snapshot = yield* currentDefinitionSnapshot;
            yield* authorize("asset.delete", {
              assetId,
              definitionSpaceId: snapshot.definitionSpaceId,
              kind: "asset",
            });
            const generation = yield* persistence.readGeneration;
            for (const record of liveRecords(generation)) {
              const contentType = snapshot.contentTypes.get(record.entry.contentTypeId);
              if (
                contentType !== undefined &&
                collectReferences(contentType, record.entry.values).assetIds.includes(assetId)
              ) {
                return yield* AssetReferenced.make({
                  message: "Asset deletion is blocked by a live Entry reference",
                });
              }
            }
            yield* assets.delete(assetId);
          }),
        readConsistentSnapshot = Effect.gen(function* readConsistentSnapshot() {
          const catalogState = yield* catalog.read,
            definitionSnapshot = catalogState.active.compiled;
          yield* authorize("definition.read", {
            definitionSpaceId: definitionSnapshot.definitionSpaceId,
            kind: "definitionSpace",
          });
          for (const contentTypeId of definitionSnapshot.contentTypes.keys()) {
            yield* authorize("entry.query", entryResource(definitionSnapshot, contentTypeId));
          }
          yield* authorize("asset.read", {
            definitionSpaceId: definitionSnapshot.definitionSpaceId,
            kind: "asset",
          });
          const generation = yield* persistence.readGeneration,
            assetMetadata = yield* assets.list,
            storedAssets: StoredAsset[] = [];
          for (const asset of assetMetadata) {
            storedAssets.push(yield* assets.read(asset.id));
          }
          return {
            assets: storedAssets,
            definitionSnapshot,
            entries: liveRecords(generation).map((record) => structuredClone(record.entry)),
            generation: generation.generation,
          } satisfies ConsistentReadSnapshot;
        }),
        readDefinitionCatalog = Effect.gen(function* readDefinitionCatalog() {
          const state = yield* catalog.read;
          yield* authorize("definition.read", {
            definitionSpaceId: state.active.compiled.definitionSpaceId,
            kind: "definitionSpace",
          });
          return state;
        }),
        activeDefinitionSnapshot = Effect.gen(function* activeDefinitionSnapshot() {
          const state = yield* catalog.read;
          yield* authorize("definition.read", {
            definitionSpaceId: state.active.compiled.definitionSpaceId,
            kind: "definitionSpace",
          });
          return state.active.compiled;
        }),
        appendDefinitionRevision = (
          input: AppendDefinitionRevisionInput,
        ): Effect.Effect<CatalogState, CmsError> =>
          Effect.gen(function* appendDefinitionRevision() {
            const state = yield* catalog.read;
            yield* authorize("definition.write", {
              definitionSpaceId: state.active.compiled.definitionSpaceId,
              kind: "definitionSpace",
            });
            if (state.version !== input.expectedCatalogVersion) {
              return yield* Conflict.make({ message: "Definition Catalog version is stale" });
            }
            const revision = input.definition.revision ?? 1;
            if (!Number.isSafeInteger(revision) || revision <= 0) {
              return yield* InvalidInput.make({
                message: "Definition revision must be a positive safe integer",
              });
            }
            if (
              state.revisions.some(
                (record) =>
                  record.definitionId === input.definition.id && record.revision === revision,
              )
            ) {
              return yield* Conflict.make({
                message: `Definition ${input.definition.id} revision ${revision} already exists`,
              });
            }
            const previousRevisions = state.revisions.filter(
                (record) => record.definitionId === input.definition.id,
              ),
              previousRevision = previousRevisions.reduce(
                (maximum, record) => Math.max(maximum, record.revision),
                0,
              );
            if (previousRevision > 0 && input.definition.parentRevision !== previousRevision) {
              return yield* Conflict.make({
                message: `Definition ${input.definition.id} must name parent revision ${previousRevision}`,
              });
            }
            if (previousRevision === 0 && input.definition.parentRevision !== undefined) {
              return yield* InvalidInput.make({
                message: `The first revision of Definition ${input.definition.id} cannot name a parent`,
              });
            }
            const draftDefinitions = [
              ...state.active.input.definitions.filter(
                (definition) => definition.id !== input.definition.id,
              ),
              input.definition,
            ];
            yield* attempt(() =>
              compile(
                {
                  compilerFormatVersion: state.active.compiled.compilerFormatVersion,
                  definitionSpaceId: state.active.compiled.definitionSpaceId,
                  definitions: draftDefinitions,
                  snapshotId: `${state.active.compiled.snapshotId}-draft-check`,
                },
                compileOptions,
              ),
            );
            const recordedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
            return yield* catalog.replace(input.expectedCatalogVersion, {
              ...state,
              events: [
                ...state.events,
                {
                  definitionId: input.definition.id,
                  eventType: "revisionAppended",
                  recordedAt,
                  ...(input.source === undefined ? {} : { source: input.source }),
                },
              ],
              revisions: [
                ...state.revisions,
                {
                  definition: structuredClone(input.definition),
                  definitionId: input.definition.id,
                  revision,
                  ...(input.definition.parentRevision === undefined
                    ? {}
                    : { parentRevision: input.definition.parentRevision }),
                },
              ],
            });
          }),
        retireDefinition = (input: RetireDefinitionInput): Effect.Effect<CatalogState, CmsError> =>
          Effect.gen(function* retireDefinition() {
            const state = yield* catalog.read;
            yield* authorize("definition.write", {
              definitionSpaceId: state.active.compiled.definitionSpaceId,
              kind: "definitionSpace",
            });
            if (state.version !== input.expectedCatalogVersion) {
              return yield* Conflict.make({ message: "Definition Catalog version is stale" });
            }
            if (!state.revisions.some((record) => record.definitionId === input.definitionId)) {
              return yield* NotFound.make({
                message: `Definition ${input.definitionId} was not found`,
              });
            }
            const recordedAt = new Date(yield* Clock.currentTimeMillis).toISOString();
            return yield* catalog.replace(input.expectedCatalogVersion, {
              ...state,
              events: [
                ...state.events,
                {
                  definitionId: input.definitionId,
                  eventType: "definitionRetired",
                  recordedAt,
                  ...(input.source === undefined ? {} : { source: input.source }),
                },
              ],
              retiredDefinitionIds: new Set(state.retiredDefinitionIds).add(input.definitionId),
            });
          }),
        appendMigrationManifest = (
          input: AppendMigrationManifestInput,
        ): Effect.Effect<CatalogState, CmsError> =>
          Effect.gen(function* appendMigrationManifest() {
            const state = yield* catalog.read;
            yield* authorize("definition.write", {
              definitionSpaceId: state.active.compiled.definitionSpaceId,
              kind: "definitionSpace",
            });
            if (state.version !== input.expectedCatalogVersion) {
              return yield* Conflict.make({ message: "Definition Catalog version is stale" });
            }
            if (state.migrationManifests.some((manifest) => manifest.id === input.manifest.id)) {
              return yield* Conflict.make({
                message: `Migration Manifest ${input.manifest.id} already exists`,
              });
            }
            yield* attempt(() => validateGraph([...state.migrationManifests, input.manifest]));
            return yield* catalog.replace(input.expectedCatalogVersion, {
              ...state,
              migrationManifests: [...state.migrationManifests, structuredClone(input.manifest)],
            });
          }),
        prepareDefinitionMigration = (
          input: PrepareDefinitionMigrationInput,
        ): Effect.Effect<Preparation, CmsError> =>
          Effect.gen(function* prepareDefinitionMigration() {
            const state = yield* catalog.read;
            yield* authorize("definition.activate", {
              definitionSpaceId: state.active.compiled.definitionSpaceId,
              kind: "definitionSpace",
            });
            if (state.version !== input.expectedCatalogVersion) {
              return yield* Conflict.make({ message: "Definition Catalog version is stale" });
            }
            const manifest = state.migrationManifests.find(
              (candidate) => candidate.id === input.manifestId,
            );
            if (manifest === undefined) {
              return yield* NotFound.make({
                message: `Migration Manifest ${input.manifestId} was not found`,
              });
            }
            const target = yield* attempt(() => compile(input.snapshot, compileOptions)),
              generation = yield* persistence.readGeneration,
              preparation = yield* attempt(() =>
                prepare({
                  entries: liveRecords(generation).map((record) => record.entry),
                  handlers: [...migrationHandlers.values()],
                  manifest,
                  source: state.active.compiled,
                  sourceGeneration: generation.generation,
                  target,
                }),
              );
            yield* catalog.replace(input.expectedCatalogVersion, {
              ...state,
              migrationPreparations: [
                ...state.migrationPreparations.filter(
                  (candidate) => candidate.id !== preparation.id,
                ),
                preparation,
              ],
            });
            return preparation;
          }),
        activateDefinitionSnapshot = (
          input: ActivateDefinitionSnapshotInput,
        ): Effect.Effect<ActivateDefinitionSnapshotResult, CmsError> =>
          Effect.gen(function* activateDefinitionSnapshot() {
            yield* authorize("definition.activate", {
              definitionSpaceId: input.snapshot.definitionSpaceId,
              kind: "definitionSpace",
            });
            const state = yield* catalog.read;
            if (state.version !== input.expectedCatalogVersion) {
              return yield* Conflict.make({ message: "Definition Catalog version is stale" });
            }
            if (input.snapshot.definitionSpaceId !== state.active.compiled.definitionSpaceId) {
              return yield* InvalidInput.make({
                message: "A Definition Snapshot cannot cross Definition Spaces",
              });
            }
            if (
              state.snapshots.some(
                (snapshotRecord) =>
                  snapshotRecord.compiled.snapshotId === input.snapshot.snapshotId,
              )
            ) {
              return yield* Conflict.make({
                message: `Definition Snapshot ${input.snapshot.snapshotId} already exists`,
              });
            }
            const target = yield* attempt(() => compile(input.snapshot, compileOptions));
            for (const definition of input.snapshot.definitions) {
              const revision = definition.revision ?? 1,
                catalogRevision = state.revisions.find(
                  (record) => record.definitionId === definition.id && record.revision === revision,
                );
              if (
                catalogRevision === undefined ||
                canonicalJson(catalogRevision.definition as unknown as JsonValue) !==
                  canonicalJson(definition as unknown as JsonValue)
              ) {
                return yield* InvalidInput.make({
                  message: `Definition ${definition.id} revision ${revision} has not been appended to the Catalog`,
                });
              }
              if (state.retiredDefinitionIds.has(definition.id)) {
                const activeDefinitionRevision =
                  state.active.input.definitions.find((candidate) => candidate.id === definition.id)
                    ?.revision ?? 0;
                if (revision <= activeDefinitionRevision) {
                  return yield* InvalidInput.make({
                    message: `Retired Definition ${definition.id} requires a new revision before reactivation`,
                  });
                }
              }
            }
            const source = state.active.compiled,
              compatibility = classifyCompatibility(source, target);
            if (compatibility === "migrationRequired" && input.migration === undefined) {
              return yield* InvalidInput.make({
                message:
                  "This Definition change requires an explicit Migration Manifest and Handler",
              });
            }
            const generation = yield* persistence.readGeneration,
              manifest: Manifest =
                compatibility === "compatible"
                  ? {
                      compatible: true,
                      handlerIdentifier: "nearly-headless-cms.compatible-identity",
                      handlerVersion: 1,
                      id: `compatible-${source.snapshotId}-${target.snapshotId}`,
                      sourceSnapshotId: source.snapshotId,
                      targetSnapshotId: target.snapshotId,
                    }
                  : input.migration!.manifest,
              storedPreparation =
                input.migration?.preparationId === undefined
                  ? undefined
                  : state.migrationPreparations.find(
                      (candidate) => candidate.id === input.migration?.preparationId,
                    ),
              preparation =
                storedPreparation ??
                (yield* attempt(() =>
                  prepare({
                    entries: liveRecords(generation).map((record) => record.entry),
                    handlers: input.migration?.handlers ?? [...migrationHandlers.values()],
                    manifest,
                    source,
                    sourceGeneration: generation.generation,
                    target,
                  }),
                ));
            if (input.migration?.preparationId !== undefined && storedPreparation === undefined) {
              return yield* NotFound.make({
                message: `Migration Preparation ${input.migration.preparationId} was not found`,
              });
            }
            if (
              preparation.sourceSnapshotId !== source.snapshotId ||
              preparation.targetSnapshotId !== target.snapshotId ||
              preparation.manifest.id !== manifest.id
            ) {
              return yield* InvalidInput.make({
                message: "Migration Preparation does not match this Definition Cutover",
              });
            }
            yield* attempt(() => {
              assertFresh(preparation, generation.generation);
            });
            if (preparation.report.status !== "ready") {
              return yield* InvalidInput.make({
                issues: preparation.report.issues,
                message: "Definition Migration preparation failed",
              });
            }

            const records = new Map(generation.records);
            if (compatibility === "migrationRequired") {
              for (const entry of preparation.entries) {
                const current = records.get(entry.id);
                if (current === undefined) {
                  return yield* Conflict.make({
                    message: "Migration Preparation no longer matches the Entry generation",
                  });
                }
                const writeToken =
                  current.writeToken === undefined
                    ? undefined
                    : yield* identifiers.generate("write-token");
                records.set(entry.id, {
                  ...current,
                  entry,
                  ...(writeToken === undefined ? {} : { writeToken }),
                });
              }
              const preparedGeneration: EntryGeneration = {
                generation: generation.generation,
                records,
              };
              for (const record of liveRecords(preparedGeneration)) {
                const contentType = target.contentTypes.get(record.entry.contentTypeId);
                if (contentType === undefined) {
                  return yield* InvalidInput.make({
                    message: `Migration retained Entry ${record.entry.id} in a removed Content Type`,
                  });
                }
                yield* attempt(() => {
                  ensureUniqueValues(
                    contentType,
                    record.entry.values,
                    records.values(),
                    record.entry.id,
                  );
                });
                yield* ensureReferences(
                  yield* attempt(() => collectReferences(contentType, record.entry.values)),
                  preparedGeneration,
                  assets,
                );
              }
            }

            const activatedAt = new Date(yield* Clock.currentTimeMillis).toISOString(),
              snapshotRecord: DefinitionSnapshotRecord = {
                activatedAt,
                compiled: target,
                input: structuredClone(input.snapshot),
              },
              nextRetiredDefinitionIds = new Set(state.retiredDefinitionIds);
            for (const definition of input.snapshot.definitions) {
              nextRetiredDefinitionIds.delete(definition.id);
            }
            const replacement: CatalogState = {
                ...state,
                active: snapshotRecord,
                events: [
                  ...state.events,
                  {
                    eventType: "snapshotActivated",
                    recordedAt: activatedAt,
                    snapshotId: target.snapshotId,
                    ...(input.source === undefined ? {} : { source: input.source }),
                  },
                ],
                migrationManifests: state.migrationManifests.some(
                  (candidate) => candidate.id === manifest.id,
                )
                  ? state.migrationManifests
                  : [...state.migrationManifests, manifest],
                migrationPreparations: state.migrationPreparations.some(
                  (candidate) => candidate.id === preparation.id,
                )
                  ? state.migrationPreparations
                  : [...state.migrationPreparations, preparation],
                retiredDefinitionIds: nextRetiredDefinitionIds,
                snapshots: [...state.snapshots, snapshotRecord],
              },
              committedCatalog =
                compatibility === "compatible"
                  ? yield* catalog.replace(input.expectedCatalogVersion, replacement)
                  : catalog.commitCutover !== undefined
                    ? (yield* catalog.commitCutover(
                        input.expectedCatalogVersion,
                        replacement,
                        generation.generation,
                        records,
                      )).catalog
                    : yield* Effect.uninterruptible(
                        Effect.gen(function* committedCatalog() {
                          const committedGeneration = yield* persistence.commitGeneration(
                            generation.generation,
                            records,
                          );
                          return yield* catalog
                            .replace(input.expectedCatalogVersion, replacement)
                            .pipe(
                              Effect.catchCause((cause) =>
                                persistence
                                  .commitGeneration(
                                    committedGeneration.generation,
                                    generation.records,
                                  )
                                  .pipe(Effect.flatMap(() => Effect.failCause(cause))),
                              ),
                            );
                        }),
                      );
            for (const handler of input.migration?.handlers ?? []) {
              migrationHandlers.set(`${handler.identifier}@${handler.version}`, handler);
            }
            return {
              catalogVersion: committedCatalog.version,
              migratedEntryCount: compatibility === "compatible" ? 0 : preparation.entries.length,
              snapshot: target,
            };
          }),
        withOperationGate = operationGate.withPermit;

      return Service.of({
        activateDefinitionSnapshot: (input) => withOperationGate(activateDefinitionSnapshot(input)),
        activeDefinitionSnapshot: withOperationGate(activeDefinitionSnapshot),
        appendDefinitionRevision: (input) => withOperationGate(appendDefinitionRevision(input)),
        appendMigrationManifest: (input) => withOperationGate(appendMigrationManifest(input)),
        createEntry: (input) => withOperationGate(createEntry(input)),
        deleteAsset: (input) => withOperationGate(deleteAsset(input)),
        deleteEntry: (input) => withOperationGate(deleteEntry(input)),
        getAsset: (input) => withOperationGate(getAsset(input)),
        getCurrentEntryState: (input) => withOperationGate(getCurrentEntryState(input)),
        getEntry: (input) => withOperationGate(getEntry(input)),
        ingestAsset: (input) => withOperationGate(ingestAsset(input)),
        inspectEntryRevision: (input) => withOperationGate(inspectEntryRevision(input)),
        listAssets: withOperationGate(listAssets),
        listEntryRevisions: (input) => withOperationGate(listEntryRevisions(input)),
        mutateEntriesAtomically: (input) => withOperationGate(mutateEntriesAtomically(input)),
        permanentlyPurgeEntry: (input) => withOperationGate(permanentlyPurgeEntry(input)),
        prepareDefinitionMigration: (input) => withOperationGate(prepareDefinitionMigration(input)),
        queryEntries: (input) => withOperationGate(queryEntries(input)),
        readAsset: (input) => withOperationGate(readAsset(input)),
        readConsistentSnapshot: withOperationGate(readConsistentSnapshot),
        readDefinitionCatalog: withOperationGate(readDefinitionCatalog),
        restoreEntryRevision: (input) => withOperationGate(restoreEntryRevision(input)),
        retireDefinition: (input) => withOperationGate(retireDefinition(input)),
        updateEntry: (input) => withOperationGate(updateEntry(input)),
      });
    }),
  );

export const layer = makeLayer();
