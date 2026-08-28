import { Effect, Layer } from "effect";
import { evaluate } from "../entry-query.ts";
import {
  EntryPersistence,
  EntryReader,
  EntryWriter,
  type EntryChange,
  type EntryGeneration,
  type EntryRecord,
} from "../persistence.ts";
import cmsSupport from "../cms-support.ts";

const cloneRecord = (record: EntryRecord): EntryRecord => structuredClone(record),
  cloneGeneration = (generation: EntryGeneration): EntryGeneration => ({
    generation: generation.generation,
    records: new Map(
      [...generation.records].map(([entryIdentifier, record]) => [
        entryIdentifier,
        cloneRecord(record),
      ]),
    ),
  }),
  recordsEqual = (left: EntryRecord | undefined, right: EntryRecord): boolean =>
    left !== undefined && JSON.stringify(left) === JSON.stringify(right),
  changesBetween = (
    current: ReadonlyMap<string, EntryRecord>,
    replacement: ReadonlyMap<string, EntryRecord>,
  ): readonly EntryChange[] => [
    ...[...replacement]
      .filter(([entryIdentifier, record]) => !recordsEqual(current.get(entryIdentifier), record))
      .map(
        ([entryIdentifier, record]): EntryChange => ({
          entryId: entryIdentifier,
          kind: "put",
          record: cloneRecord(record),
        }),
      ),
    ...[...current.keys()]
      .filter((entryIdentifier) => !replacement.has(entryIdentifier))
      .map((entryIdentifier): EntryChange => ({ entryId: entryIdentifier, kind: "delete" })),
  ],
  applyChanges = (
    records: ReadonlyMap<string, EntryRecord>,
    changes: readonly EntryChange[],
  ): Map<string, EntryRecord> => {
    const next = new Map(
      [...records].map(([entryIdentifier, record]) => [entryIdentifier, cloneRecord(record)]),
    );
    for (const change of changes) {
      if (change.kind === "delete") {
        next.delete(change.entryId);
      } else {
        next.set(change.entryId, cloneRecord(change.record));
      }
    }
    return next;
  },
  readerFromPersistence = (
    persistence: typeof EntryPersistence.Service,
  ): typeof EntryReader.Service =>
    EntryReader.of({
      get: (entryIdentifier) =>
        persistence.readGeneration().pipe(
          Effect.map((generation) => {
            const record = generation.records.get(entryIdentifier);
            if (record === undefined) {
              return { generation: generation.generation };
            }
            return { generation: generation.generation, record: cloneRecord(record) };
          }),
        ),
      query: ({ query, snapshot }) =>
        persistence.readGeneration().pipe(
          Effect.flatMap((generation) =>
            cmsSupport.attempt(() => ({
              generation: generation.generation,
              page: evaluate({
                entries: [...generation.records.values()]
                  .filter((record) => record.deletionRecord === undefined)
                  .map((record) => structuredClone(record.entry)),
                options: { generation: generation.generation },
                query,
                snapshot,
              }),
            })),
          ),
        ),
      snapshot: (_void: void) => persistence.readGeneration().pipe(Effect.map(cloneGeneration)),
    }),
  writerFromPersistence = (
    persistence: typeof EntryPersistence.Service,
  ): typeof EntryWriter.Service =>
    EntryWriter.of({
      commit: (input) =>
        persistence.readGeneration().pipe(
          Effect.flatMap((generation) =>
            persistence.commitGeneration(
              input.expectedGeneration,
              applyChanges(generation.records, input.changes),
            ),
          ),
          Effect.map((generation) => generation.generation),
        ),
    }),
  persistenceFromCapabilities =
    (writer: typeof EntryWriter.Service) =>
    (reader: typeof EntryReader.Service): typeof EntryPersistence.Service =>
      EntryPersistence.of({
        commitGeneration: (expectedGeneration, records) =>
          reader.snapshot().pipe(
            Effect.flatMap((current) =>
              writer.commit({
                changes: changesBetween(current.records, records),
                expectedGeneration,
              }),
            ),
            Effect.map((generation) => ({
              generation,
              records: new Map(
                [...records].map(([entryIdentifier, record]) => [
                  entryIdentifier,
                  cloneRecord(record),
                ]),
              ),
            })),
          ),
        readGeneration: (_void: void) => reader.snapshot(),
      }),
  readerLayer = Layer.effect(EntryReader, EntryPersistence.pipe(Effect.map(readerFromPersistence))),
  writerLayer = Layer.effect(EntryWriter, EntryPersistence.pipe(Effect.map(writerFromPersistence))),
  /** Derives queryable read and row-level write capabilities from legacy generation persistence. */
  fromEntryPersistence: Layer.Layer<EntryReader | EntryWriter, never, EntryPersistence> =
    Layer.merge(readerLayer, writerLayer),
  /** Derives the deprecated generation persistence seam from the new Entry capabilities. */
  toEntryPersistence: Layer.Layer<EntryPersistence, never, EntryReader | EntryWriter> =
    Layer.effect(
      EntryPersistence,
      Effect.gen(function* makeEntryPersistenceCompatibility() {
        const reader = yield* EntryReader,
          writer = yield* EntryWriter;
        return persistenceFromCapabilities(writer)(reader);
      }),
    );

export {
  fromEntryPersistence,
  persistenceFromCapabilities,
  readerFromPersistence,
  toEntryPersistence,
  writerFromPersistence,
};
