import { DateTime, Effect } from "effect";
import { managementClient } from "./main-shared.ts";

export interface ContentListPredicate {
  readonly operator: string;
  readonly path: string;
  readonly value: string;
}

export const contentListCreateSuffix = (): string =>
    // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- browser UI labels need a synchronous local identifier.
    crypto.randomUUID().slice(0, 8),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- content list helper is intentionally a direct three-argument operation.
  contentListCreateValues = (
    contentTypeId: string,
    relatedEntryId: string | undefined,
    suffix: string,
  ): Readonly<Record<string, unknown>> => {
    if (contentTypeId === "post") {
      return {
        author: relatedEntryId,
        body: {
          children: [{ children: [{ text: "", type: "text" }], type: "paragraph" }],
          format: "nearly-headless-cms/rich-text",
          version: 1,
        },
        categories: [],
        excerpt: "Draft excerpt",
        slug: `untitled-${suffix}`,
        status: "draft",
        tags: [],
        title: `Untitled ${suffix}`,
      };
    }
    if (contentTypeId === "author") {
      return {
        biography: "Biography to be completed.",
        "external-links": [],
        name: `Untitled ${suffix}`,
        slug: `untitled-${suffix}`,
      };
    }
    if (contentTypeId === "comment") {
      return {
        body: "Comment awaiting editing.",
        "created-at": DateTime.formatIso(DateTime.nowUnsafe()),
        "display-name": `Reader ${suffix}`,
        post: relatedEntryId,
        status: "pending",
      };
    }
    return { name: `Untitled ${suffix}`, slug: `untitled-${suffix}` };
  },
  contentListEntryFromCreateResult = (
    result: { entry: { id: string } } | { id: string },
  ): { id: string } => {
    if ("entry" in result) {
      return result.entry;
    }
    return result;
  },
  contentListFilterPath = (contentTypeId: string): string => {
    if (contentTypeId === "post") {
      return "title";
    }
    if (contentTypeId === "comment") {
      return "display-name";
    }
    return "name";
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- content list helper is intentionally a direct three-argument operation.
  contentListPredicates = (
    contentTypeId: string,
    filterText: string,
    statusFilter: string,
  ): readonly ContentListPredicate[] => {
    const filterPath = contentListFilterPath(contentTypeId),
      predicates: ContentListPredicate[] = [],
      trimmedFilterText = filterText.trim();
    if (trimmedFilterText.length > 0) {
      predicates.push({ operator: "contains", path: filterPath, value: trimmedFilterText });
    }
    if (statusFilter !== "all") {
      predicates.push({ operator: "equals", path: "status", value: statusFilter });
    }
    return predicates;
  },
  contentListQueryOptions = ({
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
  }): Readonly<Record<string, unknown>> => {
    const predicates = contentListPredicates(contentTypeId, filterText, statusFilter),
      queryOptions: Record<string, unknown> = {
        pageSize: 20,
        sort: [{ direction: sortDirection, path: contentListSortPath(contentTypeId) }],
      };
    if (cursor !== undefined) {
      queryOptions["cursor"] = cursor;
    }
    if (predicates.length === 1) {
      const [firstPredicate] = predicates;
      queryOptions["where"] = firstPredicate;
    } else if (predicates.length > 1) {
      queryOptions["where"] = { all: predicates };
    }
    return queryOptions;
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- content list helper is intentionally a direct two-argument operation.
  contentListQueryRelatedEntries = (
    contentTypeId: string,
    relatedContentTypeId: string,
  ): Promise<{ items: readonly { id: string }[] } | undefined> => {
    if (contentListRequiresRelatedEntry(contentTypeId)) {
      return Effect.runPromise(
        managementClient.queryEntries(relatedContentTypeId, { pageSize: 1 }),
      );
    }
    const emptyRelatedEntries: { items: readonly { id: string }[] } | undefined = undefined;
    return Promise.resolve(emptyRelatedEntries);
  },
  contentListRelatedEntryId = (
    relatedEntries: { items: readonly { id: string }[] } | undefined,
  ): string | undefined => relatedEntries?.items[0]?.id,
  contentListRequiresRelatedEntry = (contentTypeId: string): boolean =>
    contentTypeId === "comment" || contentTypeId === "post",
  contentListSortPath = (contentTypeId: string): string => {
    if (contentTypeId === "comment") {
      return "created-at";
    }
    if (contentTypeId === "post") {
      return "published-at";
    }
    return "name";
  };
