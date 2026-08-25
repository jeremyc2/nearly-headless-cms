import {
  type CmsError,
  type CmsServiceOperationContext,
  type CompiledContentType,
  type CompiledSnapshot,
  Effect,
  type EntryBatchMutation,
  type EntryGeneration,
  type EntryRecord,
  type Representation,
  cmsSupport,
} from "./cms-service-entry-batch-operations-validate-support-imports.ts";

interface ValidateBatchReplaceInput {
  readonly contentType: CompiledContentType;
  readonly context: Readonly<CmsServiceOperationContext>;
  readonly entryId: string;
  readonly generation: EntryGeneration;
  readonly mutation: Extract<EntryBatchMutation, { kind: "replace" }>;
  readonly records: Map<string, EntryRecord>;
  readonly snapshot: CompiledSnapshot;
}

const { attempt, collectReferences, ensureReferences, ensureUniqueValues } = cmsSupport,
  validateBatchReplaceValues = (
    input: ValidateBatchReplaceInput,
  ): Effect.Effect<Representation["values"], CmsError> =>
    Effect.gen(function* validateBatchReplaceValuesEffect() {
      const values = yield* attempt(() =>
        input.snapshot.validateEntry(
          input.mutation.input.contentTypeId,
          input.mutation.input.values,
          {
            applyDefaults: false,
          },
        ),
      );
      yield* attempt(() => {
        ensureUniqueValues({
          contentType: input.contentType,
          ignoredEntryId: input.entryId,
          records: input.records.values(),
          values,
        });
      });
      yield* ensureReferences(
        yield* attempt(() => collectReferences(input.contentType, values)),
        { generation: input.generation.generation, records: input.records },
        input.context.assets,
      );
      return values;
    });

export default {
  validateBatchReplaceValues,
};
