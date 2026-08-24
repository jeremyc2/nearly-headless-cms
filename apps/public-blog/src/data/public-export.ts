import { PublicBlogExportSchema } from "../generated/headless-client.ts";
import { Schema } from "effect";
import { join } from "node:path";

export const publicExport = Schema.decodeUnknownSync(PublicBlogExportSchema)(
  await Bun.file(join(process.cwd(), ".generated", "public-export.json")).json(),
);
export const assetById = new Map(publicExport.assets.map((asset) => [asset.id, asset]));
export const authorById = new Map(publicExport.authors.map((author) => [author.id, author]));
export const categoryById = new Map(
  publicExport.categories.map((category) => [category.id, category]),
);
export const tagById = new Map(publicExport.tags.map((tag) => [tag.id, tag]));
