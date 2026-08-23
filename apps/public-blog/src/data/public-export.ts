import type { PublicBlogExport } from "../generated/headless-client.ts";
import { join } from "node:path";

export const publicExport = (await Bun.file(
  join(process.cwd(), ".generated", "public-export.json"),
).json()) as PublicBlogExport;
export const assetById = new Map(publicExport.assets.map((asset) => [asset.id, asset]));
export const authorById = new Map(publicExport.authors.map((author) => [author.id, author]));
export const categoryById = new Map(
  publicExport.categories.map((category) => [category.id, category]),
);
export const tagById = new Map(publicExport.tags.map((tag) => [tag.id, tag]));
