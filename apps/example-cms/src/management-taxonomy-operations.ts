import { type Cms, type ContentDefinition } from "nearly-headless-cms";
import { Effect } from "effect";
import type { HttpContract } from "nearly-headless-cms/http";
import managementSupport from "./management-support.ts";

const {
    requireDeletionRecord,
    requiredParameter,
    requiredWriteToken,
  } = managementSupport,
  buildTaxonomyDetachmentMutations = (
    postStates: readonly {
      entry: { id: string; values: ContentDefinition.JsonObject };
      writeToken: string;
    }[],
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
        const taxonomyEntryId = requiredParameter(parameters, "entryId"),
          postStates = yield* Effect.all(
            (yield* cms.queryEntries({
              contentTypeId: "post",
              pageSize: 100,
              where: { operator: "equals", path: relationshipField, value: taxonomyEntryId },
            })).items.map((post) =>
              cms.getCurrentEntryState({ contentTypeId: "post", entryId: post.id }),
            ),
          ),
          deletionRecord = yield* requireDeletionRecord(
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
          );
        return {
          deletionRecord,
          detachedPostCount: postStates.length,
          removedEntryId: taxonomyEntryId,
        };
      });

export default {
  detachTaxonomy,
};
