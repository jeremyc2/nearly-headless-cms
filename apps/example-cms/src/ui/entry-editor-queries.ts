import { Effect } from "effect";
import { managementClient } from "./main-shared.ts";
import { useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

export const useEntryEditorQueries = () => {
  const { contentTypeId, entryId } = useParams({ from: "/content/$contentTypeId/$entryId" }),
    assets = useQuery({
      enabled: contentTypeId === "author" || contentTypeId === "post",
      queryFn: () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    authors = useQuery({
      enabled: contentTypeId === "post",
      queryFn: () => Effect.runPromise(managementClient.queryEntries("author", { pageSize: 100 })),
      queryKey: ["relationship-options", "author"],
    }),
    categories = useQuery({
      enabled: contentTypeId === "post",
      queryFn: () =>
        Effect.runPromise(managementClient.queryEntries("category", { pageSize: 100 })),
      queryKey: ["relationship-options", "category"],
    }),
    state = useQuery({
      queryFn: () => Effect.runPromise(managementClient.getCurrentState(contentTypeId, entryId)),
      queryKey: ["entry-state", contentTypeId, entryId],
      refetchOnWindowFocus: false,
    }),
    tags = useQuery({
      enabled: contentTypeId === "post",
      queryFn: () => Effect.runPromise(managementClient.queryEntries("tag", { pageSize: 100 })),
      queryKey: ["relationship-options", "tag"],
    });
  return { assets, authors, categories, contentTypeId, entryId, state, tags };
};
