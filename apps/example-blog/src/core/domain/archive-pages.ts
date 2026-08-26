import type { GetStaticPaths } from "astro";
import { paginate } from "./public-model.ts";
import { publicExport } from "../data/public-export.ts";

const archivePageSize = 6,
  authorArchivePaths: GetStaticPaths = () =>
    publicExport.authors.flatMap((author) =>
      paginate({
        items: publicExport.posts.filter((post) => post.author === author.id),
        pageSize: archivePageSize,
      }).map((page) => ({
        params: { page: String(page.pageNumber), slug: author.slug },
        props: { author, page },
      })),
    ),
  categoryArchivePaths: GetStaticPaths = () =>
    publicExport.categories.flatMap((category) =>
      paginate({
        items: publicExport.posts.filter((post) => post.categories.includes(category.id)),
        pageSize: archivePageSize,
      }).map((page) => ({
        params: { page: String(page.pageNumber), slug: category.slug },
        props: { category, page },
      })),
    ),
  postArchivePaths: GetStaticPaths = () =>
    paginate({
      items: publicExport.posts,
      pageSize: archivePageSize,
    }).map((page) => ({
      params: { page: String(page.pageNumber) },
      props: { page },
    })),
  tagArchivePaths: GetStaticPaths = () =>
    publicExport.tags.flatMap((tag) =>
      paginate({
        items: publicExport.posts.filter((post) => post.tags.includes(tag.id)),
        pageSize: archivePageSize,
      }).map((page) => ({
        params: { page: String(page.pageNumber), slug: tag.slug },
        props: { page, tag },
      })),
    );

export { authorArchivePaths, categoryArchivePaths, postArchivePaths, tagArchivePaths };
