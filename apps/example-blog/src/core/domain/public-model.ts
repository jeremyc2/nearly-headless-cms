import type { PublicBlogExport, PublicPost } from "../generated/headless-client.ts";

export interface Page<Value> {
  readonly items: readonly Value[];
  readonly nextPage?: number;
  readonly pageNumber: number;
  readonly previousPage?: number;
}

export interface PaginateInput<Value> {
  readonly items: readonly Value[];
  readonly pageSize: number;
}

const archivePageSize = 6,
  firstPageIndex = 0,
  minimumPageCount = 1,
  pageNumberOffset = 1,
  zPaginate = <Value>({ items, pageSize }: PaginateInput<Value>): readonly Page<Value>[] => {
    if (!Number.isSafeInteger(pageSize) || pageSize < minimumPageCount) {
      throw new Error("pageSize must be a positive integer");
    }
    const pageCount = Math.max(minimumPageCount, Math.ceil(items.length / pageSize));
    return Array.from({ length: pageCount }, (unusedValue, index): Page<Value> => {
      const currentPageNumber = index + pageNumberOffset,
        page: {
          items: readonly Value[];
          nextPage?: number;
          pageNumber: number;
          previousPage?: number;
        } = {
          items: items.slice(index * pageSize, currentPageNumber * pageSize),
          pageNumber: currentPageNumber,
        };
      if (index !== firstPageIndex) {
        page.previousPage = index;
      }
      if (currentPageNumber !== pageCount) {
        page.nextPage = currentPageNumber + pageNumberOffset;
      }
      return page;
    });
  },
  zPublishedPosts = (snapshot: PublicBlogExport): readonly PublicPost[] =>
    [...snapshot.posts].toSorted(
      (leftPost, rightPost) =>
        rightPost.publishedAt.localeCompare(leftPost.publishedAt) ||
        leftPost.id.localeCompare(rightPost.id),
    ),
  zRouteManifest = (snapshot: PublicBlogExport): readonly string[] => [
    "/",
    "/posts/",
    "/categories/",
    "/tags/",
    "/feed.xml",
    ...zPublishedPosts(snapshot).map((post) => `/posts/${post.slug}/`),
  ];

export { archivePageSize, zPaginate as paginate, zPublishedPosts as publishedPosts, zRouteManifest as routeManifest };

export type { PublicBlogExport, PublicPost };
