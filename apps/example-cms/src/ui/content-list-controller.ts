import { useEffect, useState } from "react";
import { contentTypes } from "./main-shared.ts";
import { useContentListCreateMutation } from "./content-list-mutations.ts";
import { useContentListEntriesQuery } from "./content-list-queries.ts";
import { useParams } from "@tanstack/react-router";

export const useContentListController = () => {
  const { contentTypeId } = useParams({ from: "/content/$contentTypeId" }),
    contentType = contentTypes.find((candidate) => candidate.identifier === contentTypeId),
    [cursor, setCursor] = useState<string>(),
    [filterText, setFilterText] = useState(""),
    [priorCursors, setPriorCursors] = useState<readonly (string | undefined)[]>([]),
    [sortDirection, setSortDirection] = useState<"ascending" | "descending">("descending"),
    [statusFilter, setStatusFilter] = useState("all"),
    createEntry = useContentListCreateMutation(contentTypeId),
    entries = useContentListEntriesQuery({
      contentTypeId,
      cursor,
      filterText,
      sortDirection,
      statusFilter,
    });
  useEffect(() => {
    setCursor(undefined);
    setPriorCursors([]);
  }, [contentTypeId, filterText, sortDirection, statusFilter]);
  return {
    contentType,
    contentTypeId,
    createEntry,
    cursor,
    entries,
    filterText,
    priorCursors,
    setCursor,
    setFilterText,
    setPriorCursors,
    setSortDirection,
    setStatusFilter,
    sortDirection,
    statusFilter,
  };
};

export type ContentListController = ReturnType<typeof useContentListController>;

