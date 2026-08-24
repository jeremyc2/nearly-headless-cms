import { Effect, Layer, SynchronizedRef } from "effect";
import { type EntryGeneration, EntryPersistence, type EntryRecord } from "../persistence.ts";
import { Conflict } from "../cms-error.ts";

const cloneEntryRecord = (record: EntryRecord): EntryRecord => globalThis.structuredClone(record),
  cloneGeneration = (generation: EntryGeneration): EntryGeneration => ({
    generation: generation.generation,
    records: new Map(
      [...generation.records].map(([entryId, record]) => [entryId, cloneEntryRecord(record)]),
    ),
  }),
  generationIncrement = 1,
  /** Process-local Entry Persistence Layer with atomic immutable generations. */
  layer: Layer.Layer<EntryPersistence> = Layer.effect(
    EntryPersistence,
    Effect.gen(function* makeMemoryEntryPersistence() {
      const state = yield* SynchronizedRef.make<EntryGeneration>({
        generation: 0,
        records: new Map(),
      });
      return EntryPersistence.of({
        commitGeneration: (expectedGeneration, records) =>
          SynchronizedRef.modifyEffect(state, (current) => {
            if (current.generation !== expectedGeneration) {
              return Effect.fail(
                Conflict.make({ message: "Entry persistence generation is stale" }),
              );
            }
            const committed: EntryGeneration = {
              generation: current.generation + generationIncrement,
              records: new Map(
                [...records].map(([entryId, record]) => [entryId, cloneEntryRecord(record)]),
              ),
            };
            return Effect.succeed([cloneGeneration(committed), committed] as const);
          }),
        readGeneration: SynchronizedRef.get(state).pipe(Effect.map(cloneGeneration)),
      });
    }),
  );

export { layer };
