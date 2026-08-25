import {
  DateTime,
  Effect,
  type EntryRepresentation,
  contentTypes,
  managementClient,
  useQueries,
  useQuery,
} from "./overview-imports.ts";
import useOverviewRebuildMutation from "./overview-rebuild-support.ts";

export interface OverviewState {
  readonly assetsCount: number | string;
  readonly counts: Record<string, number | string>;
  readonly draftPostCount: number;
  readonly pendingCommentCount: number;
  readonly recentEntries: readonly {
    readonly entry: EntryRepresentation;
    readonly recordedAt: string;
  }[];
  readonly rebuild: ReturnType<typeof useOverviewRebuildMutation>;
  readonly today: string;
}

const buildOverviewCounts = (
    queries: ReturnType<typeof useOverviewEntryQueries>,
    assetCount: number | undefined,
  ) => {
    const comments = queries[4]?.data?.items ?? [],
      counts = Object.fromEntries(
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
      pendingCommentCount: comments.filter((comment) => comment.values["status"] === "pending")
        .length,
    };
  },
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
  useOverviewRecentEntries = (queries: ReturnType<typeof useOverviewEntryQueries>) => {
    const recentCandidates = queries.flatMap((query) => query.data?.items ?? []).slice(0, 12),
      recentRevisionQueries = useQueries({
        queries: recentCandidates.map((entry) => ({
          queryFn: () =>
            Effect.runPromise(managementClient.listRevisions(entry.contentTypeId, entry.id)),
          queryKey: ["overview-revisions", entry.contentTypeId, entry.id],
        })),
      });
    return recentCandidates
      .map((entry, index) => ({
        entry,
        recordedAt: recentRevisionQueries[index]?.data?.items[0]?.recordedAt,
      }))
      .filter(
        (
          candidate,
        ): candidate is { readonly entry: EntryRepresentation; readonly recordedAt: string } =>
          candidate.recordedAt !== undefined,
      )
      .toSorted((left, right) => right.recordedAt.localeCompare(left.recordedAt))
      .slice(0, 5);
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
      today: new Intl.DateTimeFormat(undefined, {
        dateStyle: "full",
      }).format(DateTime.toDate(DateTime.nowUnsafe())),
    };
  };

export { useOverviewState };
