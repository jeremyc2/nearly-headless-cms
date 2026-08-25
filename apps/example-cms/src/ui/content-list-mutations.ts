import {
  contentListCreateSuffix,
  contentListCreateValues,
  contentListEntryFromCreateResult,
  contentListQueryRelatedEntries,
  contentListRelatedEntryId,
  contentListRequiresRelatedEntry,
} from "./content-list-support.ts";
import { managementClient, queryClient } from "./main-shared.ts";
import { Effect } from "effect";
import { relatedContentType } from "./main-labels.ts";
import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";

export const useContentListCreateMutation = (contentTypeId: string) => {
  const navigate = useNavigate();
  return useMutation({
    // oxlint-disable-next-line effecttsgo(async-function) -- React query mutation must bridge browser fetch.
    // oxlint-disable-next-line effecttsgo/async-function -- entry creation sequences dependent requests.
    mutationFn: async () => {
      const relatedContentTypeId = relatedContentType(contentTypeId),
        relatedEntries = await contentListQueryRelatedEntries(
          contentTypeId,
          relatedContentTypeId,
        ),
        relatedEntryId = contentListRelatedEntryId(relatedEntries),
        suffix = contentListCreateSuffix(),
        values = contentListCreateValues(contentTypeId, relatedEntryId, suffix);
      if (relatedEntryId === undefined && contentListRequiresRelatedEntry(contentTypeId)) {
        throw new Error(`Create a ${relatedContentTypeId} before creating this Entry`);
      }
      return Effect.runPromise(managementClient.createEntry(contentTypeId, values));
    },
    // oxlint-disable-next-line effecttsgo(async-function) -- React query callback sequences invalidation before navigation.
    // oxlint-disable-next-line effecttsgo/async-function -- cache invalidation must remain sequential.
    onSuccess: async (result) => {
      const entry = contentListEntryFromCreateResult(result);
      await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
      await navigate({
        params: { contentTypeId, entryId: entry.id },
        to: "/content/$contentTypeId/$entryId",
      });
    },
  });
};
