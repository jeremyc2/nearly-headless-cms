import {
  type AppendDefinitionRevisionInput,
  type CatalogState,
  type CmsError,
  Conflict,
  Effect,
  InvalidInput,
} from "./cms-service-definition-operations-guards-imports.ts";

interface AppendDefinitionRevisionValidation {
  readonly revision: number;
}

const assertAppendRevisionNumber = (
    input: AppendDefinitionRevisionInput,
  ): Effect.Effect<number, CmsError> => {
    const revision = input.definition.revision ?? 1;
    if (!Number.isSafeInteger(revision) || revision <= 0) {
      return Effect.fail(
        InvalidInput.make({
          message: "Definition revision must be a positive safe integer",
        }),
      );
    }
    return Effect.succeed(revision);
  },
  assertAppendRevisionParentRevision = (
    state: CatalogState,
    input: AppendDefinitionRevisionInput,
  ): Effect.Effect<void, CmsError> => {
    const previousRevision = resolvePreviousRevision(state, input.definition.id);
    if (previousRevision > 0 && input.definition.parentRevision !== previousRevision) {
      return Effect.fail(
        Conflict.make({
          message: `Definition ${input.definition.id} must name parent revision ${previousRevision}`,
        }),
      );
    }
    if (previousRevision === 0 && input.definition.parentRevision !== undefined) {
      return Effect.fail(
        InvalidInput.make({
          message: `The first revision of Definition ${input.definition.id} cannot name a parent`,
        }),
      );
    }
    return Effect.void;
  },
  assertAppendRevisionUnique = (
    state: CatalogState,
    input: AppendDefinitionRevisionInput,
    revision: number,
  ): Effect.Effect<void, CmsError> => {
    if (
      state.revisions.some(
        (record) => record.definitionId === input.definition.id && record.revision === revision,
      )
    ) {
      return Effect.fail(
        Conflict.make({
          message: `Definition ${input.definition.id} revision ${revision} already exists`,
        }),
      );
    }
    return Effect.void;
  },
  assertFreshCatalogVersion = (
    state: CatalogState,
    expectedCatalogVersion: number,
  ): Effect.Effect<void, CmsError> => {
    if (state.version === expectedCatalogVersion) {
      return Effect.void;
    }
    return Effect.fail(Conflict.make({ message: "Definition Catalog version is stale" }));
  },
  findMigrationManifest = (state: CatalogState, manifestId: string) =>
    state.migrationManifests.find((candidate) => candidate.id === manifestId),
  resolvePreviousRevision = (state: CatalogState, definitionId: string): number =>
    state.revisions
      .filter((record) => record.definitionId === definitionId)
      .reduce((maximum, record) => Math.max(maximum, record.revision), 0),
  validateAppendDefinitionRevisionInput = (
    state: CatalogState,
    input: AppendDefinitionRevisionInput,
  ): Effect.Effect<AppendDefinitionRevisionValidation, CmsError> =>
    Effect.gen(function* validateAppendDefinitionRevisionInputEffect() {
      const revision = yield* assertAppendRevisionNumber(input);
      yield* assertAppendRevisionUnique(state, input, revision);
      yield* assertAppendRevisionParentRevision(state, input);
      return { revision };
    });

export default {
  assertFreshCatalogVersion,
  findMigrationManifest,
  validateAppendDefinitionRevisionInput,
};
