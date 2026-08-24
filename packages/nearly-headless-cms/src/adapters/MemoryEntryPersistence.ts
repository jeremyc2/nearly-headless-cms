import { Effect, Layer, SynchronizedRef } from "effect";
import { Conflict } from "../CmsError.ts";
import { type EntryGeneration, EntryPersistence, type EntryRecord } from "../Persistence.ts";

const cloneRecord = (record: EntryRecord): EntryRecord => structuredClone(record),
  cloneGeneration = (generation: EntryGeneration): EntryGeneration => ({
    generation: generation.generation,
    records: new Map(
      [...generation.records].map(([entryId, record]) => [entryId, cloneRecord(record)]),
    ),
  });

export const layer: Layer.Layer<EntryPersistence> = Layer.effect(
  EntryPersistence,
  Effect.gen(function* layer() {
    const state = yield* SynchronizedRef.make<EntryGeneration>({
      generation: 0,
      records: new Map(),
    });
    return EntryPersistence.of({
      commitGeneration: (expectedGeneration, records) =>
        SynchronizedRef.modifyEffect(state, (current) => {
          if (current.generation !== expectedGeneration)
            return Effect.fail(Conflict.make({ message: "Entry persistence generation is stale" }));
          const committed: EntryGeneration = {
            generation: current.generation + 1,
            records: new Map(
              [...records].map(([entryId, record]) => [entryId, cloneRecord(record)]),
            ),
          };
          return Effect.succeed([cloneGeneration(committed), committed] as const);
        }),
      readGeneration: SynchronizedRef.get(state).pipe(Effect.map(cloneGeneration)),
    });
  }),
);
