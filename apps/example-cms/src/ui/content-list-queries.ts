import { Effect } from "effect";
import type { QueryPage } from "../generated/management-client.ts";
import { contentListQueryOptions } from "./content-list-support.ts";
import { managementClient } from "./main-shared.ts";
import { useQuery } from "@tanstack/react-query";

export const useContentListEntriesQuery = ({
  contentTypeId,
  cursor,
  filterText,
  sortDirection,
  statusFilter,
}: {
  readonly contentTypeId: string;
  readonly cursor?: string;
  readonly filterText: string;
  readonly sortDirection: "ascending" | "descending";
  readonly statusFilter: string;
}) =>
  useQuery<QueryPage>({
    queryFn: (): Promise<QueryPage> =>
      Effect.runPromise(
        managementClient.queryEntries(
          contentTypeId,
          contentListQueryOptions({
            contentTypeId,
            cursor,
            filterText,
            sortDirection,
            statusFilter,
          }),
        ),
      ),
    queryKey: ["entries", contentTypeId, cursor, filterText, sortDirection, statusFilter],
  });

