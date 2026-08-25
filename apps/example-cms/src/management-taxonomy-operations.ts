import { type Cms, type ContentDefinition } from "nearly-headless-cms";
import { Effect } from "effect";
import type { HttpContract } from "nearly-headless-cms/http";
import managementSupport from "./management-support.ts";

const { requireDeletionRecord, requiredParameter, requiredWriteToken } = managementSupport,
  buildTaxonomyDetachmentMutations = <
    PostState extends {
      entry: { id: string; values: ContentDefinition.JsonObject };
      writeToken: string;
    },
  >(
    postStates: readonly Readonly<PostState>[],
    relationshipField: "categories" | "tags",
    taxonomyEntryId: string,
  ): Cms.EntryBatchMutation[] =>
    postStates.map((state) => {
      const currentRelationships = state.entry.values[relationshipField];
      let relationships: ContentDefinition.JsonValue[] = [];
      if (Array.isArray(currentRelationships)) {
        relationships = currentRelationships.filter(
          (entryId): entryId is string =>
            typeof entryId === "string" && entryId !== taxonomyEntryId,
        );
      }
      return {
        input: {
          contentTypeId: "post",
          entryId: state.entry.id,
          values: { ...state.entry.values, [relationshipField]: relationships },
          writeToken: state.writeToken,
        },
        kind: "replace",
      };
    }),
  detachTaxonomy =
    (
      contentTypeId: "category" | "tag",
      relationshipField: "categories" | "tags",
    ): HttpContract.ManagementOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* detachTaxonomyEntry() {
        const { postStates, taxonomyEntryId } = yield* loadTaxonomyDetachmentState(
          cms,
          parameters,
          relationshipField,
        );
        return {
          deletionRecord: yield* requireDeletionRecord(
            (yield* cms.mutateEntriesAtomically([
              ...buildTaxonomyDetachmentMutations(postStates, relationshipField, taxonomyEntryId),
              {
                input: {
                  contentTypeId,
                  entryId: taxonomyEntryId,
                  writeToken: yield* requiredWriteToken(request),
                },
                kind: "delete",
              },
            ])).at(-1),
          ),
          detachedPostCount: postStates.length,
          removedEntryId: taxonomyEntryId,
        };
      }),
  loadTaxonomyDetachmentState = (
    cms: Readonly<Cms.ServiceShape>,
    parameters: Readonly<Record<string, string | undefined>>,
    relationshipField: "categories" | "tags",
  ) =>
    Effect.gen(function* loadTaxonomyDetachmentStateValues() {
      const entryId = requiredParameter(parameters, "entryId");
      return {
        postStates: yield* Effect.all(
          (yield* cms.queryEntries({
            contentTypeId: "post",
            pageSize: 100,
            where: { operator: "equals", path: relationshipField, value: entryId },
          })).items.map((post) =>
            cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id }),
          ),
        ),
        taxonomyEntryId: entryId,
      };
    });

export default {
  detachTaxonomy,
};
