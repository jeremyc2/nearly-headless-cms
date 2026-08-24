import { publicExport } from "../data/public-export.ts";
import { paginate } from "./public-model.ts";

const archivePageSize = 6;

export const authorArchivePaths = () =>
    publicExport.authors.flatMap((author) =>
      paginate(
        publicExport.posts.filter((post) => post.author === author.id),
        archivePageSize,
      ).map((page) => ({
        params: { page: String(page.pageNumber), slug: author.slug },
        props: { author, page },
      })),
    ),
  categoryArchivePaths = () =>
    publicExport.categories.flatMap((category) =>
      paginate(
        publicExport.posts.filter((post) => post.categories.includes(category.id)),
        archivePageSize,
      ).map((page) => ({
        params: { page: String(page.pageNumber), slug: category.slug },
        props: { category, page },
      })),
    ),
  tagArchivePaths = () =>
    publicExport.tags.flatMap((tag) =>
      paginate(
        publicExport.posts.filter((post) => post.tags.includes(tag.id)),
        archivePageSize,
      ).map((page) => ({
        params: { page: String(page.pageNumber), slug: tag.slug },
        props: { page, tag },
      })),
    );
