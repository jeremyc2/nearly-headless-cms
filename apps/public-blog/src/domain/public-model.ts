import type { PublicBlogExport, PublicPost } from "../generated/headless-client.ts";

export interface Page<Value> {
  readonly pageNumber: number;
  readonly items: readonly Value[];
  readonly previousPage?: number;
  readonly nextPage?: number;
}

export const paginate = <Value>(
  items: readonly Value[],
  pageSize: number,
): readonly Page<Value>[] => {
  if (!Number.isSafeInteger(pageSize) || pageSize <= 0) {
    throw new Error("pageSize must be a positive integer");
  }
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  return Array.from({ length: pageCount }, (_, index) => ({
    items: items.slice(index * pageSize, (index + 1) * pageSize),
    pageNumber: index + 1,
    ...(index === 0 ? {} : { previousPage: index }),
    ...(index + 1 === pageCount ? {} : { nextPage: index + 2 }),
  }));
};

export const publishedPosts = (snapshot: PublicBlogExport): readonly PublicPost[] =>
  snapshot.posts
    .filter((post) => post.status === "published")
    .toSorted(
      (leftPost, rightPost) =>
        rightPost.publishedAt.localeCompare(leftPost.publishedAt) ||
        leftPost.id.localeCompare(rightPost.id),
    );

export const routeManifest = (snapshot: PublicBlogExport): readonly string[] => [
  "/",
  "/posts/",
  "/categories/",
  "/tags/",
  "/feed.xml",
  ...paginate(publishedPosts(snapshot), 6).map((page) => `/posts/page/${page.pageNumber}/`),
  ...publishedPosts(snapshot).map((post) => `/posts/${post.slug}/`),
  ...snapshot.authors.map((author) => `/authors/${author.slug}/`),
  ...snapshot.authors.flatMap((author) =>
    paginate(
      publishedPosts(snapshot).filter((post) => post.author === author.id),
      6,
    ).map((page) => `/authors/${author.slug}/page/${page.pageNumber}/`),
  ),
  ...snapshot.categories.map((category) => `/categories/${category.slug}/`),
  ...snapshot.categories.flatMap((category) =>
    paginate(
      publishedPosts(snapshot).filter((post) => post.categories.includes(category.id)),
      6,
    ).map((page) => `/categories/${category.slug}/page/${page.pageNumber}/`),
  ),
  ...snapshot.tags.map((tag) => `/tags/${tag.slug}/`),
  ...snapshot.tags.flatMap((tag) =>
    paginate(
      publishedPosts(snapshot).filter((post) => post.tags.includes(tag.id)),
      6,
    ).map((page) => `/tags/${tag.slug}/page/${page.pageNumber}/`),
  ),
];
