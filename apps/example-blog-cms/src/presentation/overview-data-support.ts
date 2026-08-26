import { useQueries, useQuery } from "@tanstack/react-query";
import { DateTime, Effect } from "effect";
import { type EntryRepresentation } from "../generated/management-client.ts";
import { contentTypes, managementClient } from "./main-shared.ts";
import useOverviewRebuildMutation from "./overview-rebuild-support.ts";

export interface OverviewState {
  readonly assetsCount: number | string;
  readonly counts: Record<string, number | string>;
  readonly draftPostCount: number;
  readonly recentEntries: readonly {
    readonly activityLabel: string;
    readonly entry: EntryRepresentation;
  }[];
  readonly rebuild: ReturnType<typeof useOverviewRebuildMutation>;
  readonly today: string;
}

interface OverviewRevisionQueryPage {
  readonly data?: {
    readonly items: readonly {
      readonly recordedAt: string;
    }[];
  };
}

type OverviewRevisionQueries = readonly OverviewRevisionQueryPage[];

interface OverviewEntryQueryPage {
  readonly data?: {
    readonly items: readonly EntryRepresentation[];
  };
}

type OverviewEntryQueries = readonly OverviewEntryQueryPage[];

const buildOverviewCounts = (queries: OverviewEntryQueries, assetCount: number | undefined) => {
    const counts = Object.fromEntries(
        contentTypes.map((contentType, index) => [
          contentType.identifier,
          queries[index]?.data?.items.length ?? "—",
        ]),
      ),
      posts = queries[0]?.data?.items ?? [];
    return {
      assetsCount: assetCount ?? "—",
      counts,
      draftPostCount: posts.filter((post) => post.values["status"] === "draft").length,
    };
  },
  demoOverviewDate = DateTime.makeUnsafe("2026-08-23T12:00:00.000Z"),
  overviewActivityAt = (entry: EntryRepresentation): string => {
    const activityAt = entry.values["published-at"] ?? entry.values["created-at"];
    if (typeof activityAt === "string" && activityAt.length > 0) {
      return activityAt;
    }
    return "1970-01-01T00:00:00.000Z";
  },
  overviewActivityLabel = (entry: EntryRepresentation): string =>
    DateTime.toDate(DateTime.makeUnsafe(overviewActivityAt(entry))).toLocaleString("en-US", {
      timeZone: "UTC",
    }),
  overviewTodayLabel = new Intl.DateTimeFormat(undefined, {
    dateStyle: "full",
  }).format(DateTime.toDate(demoOverviewDate)),
  overviewRecentCandidateLimit = 12,
  overviewRecentDisplayLimit = 5,
  useOverviewEntryQueries = () =>
    useQueries({
      queries: contentTypes.map((contentType) => ({
        queryFn: () =>
          Effect.runPromise(
            managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
          ),
        queryKey: ["count", contentType.identifier],
      })),
    }),
  useOverviewRecentEntries = (queries: OverviewEntryQueries) => {
    const recentCandidates = queries
        .flatMap((query) => query.data?.items ?? [])
        .slice(0, overviewRecentCandidateLimit),
      recentRevisionQueries: OverviewRevisionQueries = useQueries({
        queries: recentCandidates.map((entry) => ({
          queryFn: () =>
            Effect.runPromise(managementClient.listRevisions(entry.contentTypeId, entry.id)),
          queryKey: ["overview-revisions", entry.contentTypeId, entry.id],
        })),
      });
    return recentCandidates
      .filter((_entry, index) => recentRevisionQueries[index]?.data?.items[0] !== undefined)
      .map((entry) => ({
        activityLabel: overviewActivityLabel(entry),
        entry,
      }))
      .toSorted((left, right) =>
        overviewActivityAt(right.entry).localeCompare(overviewActivityAt(left.entry)),
      )
      .slice(0, overviewRecentDisplayLimit);
  },
  useOverviewState = (): OverviewState => {
    const assets = useQuery({
        queryFn: () => Effect.runPromise(managementClient.listAssets()),
        queryKey: ["assets"],
      }),
      queries = useOverviewEntryQueries(),
      rebuild = useOverviewRebuildMutation(),
      recentEntries = useOverviewRecentEntries(queries);
    return {
      ...buildOverviewCounts(queries, assets.data?.length),
      rebuild,
      recentEntries,
      today: overviewTodayLabel,
    };
  };

export { useOverviewState };
