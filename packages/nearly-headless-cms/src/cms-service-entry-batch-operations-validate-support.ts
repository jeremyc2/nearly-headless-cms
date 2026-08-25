import { Effect } from "effect";
import type { CmsError } from "./cms-error.ts";
import type { CompiledContentType, CompiledSnapshot } from "./content-definition.ts";
import type { EntryBatchMutation } from "./cms-types.ts";
import type { Representation } from "./entry.ts";
import type { EntryGeneration, EntryRecord } from "./persistence.ts";
import type { CmsServiceOperationContext } from "./cms-service-operation-context.ts";
import cmsSupport from "./cms-support.ts";

interface ValidateBatchReplaceInput {
  readonly contentType: CompiledContentType;
  readonly context: CmsServiceOperationContext;
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
        input.snapshot.validateEntry(input.mutation.input.contentTypeId, input.mutation.input.values, {
          applyDefaults: false,
        }),
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
