import { PublicBlogExportSchema } from "../generated/headless-client.ts";
import { Schema } from "effect";

const decodePublicBlogExport = Schema.decodeUnknownSync(PublicBlogExportSchema),
  generatedExportPath = `${import.meta.dir}/../../.generated/public-export.json`,
  publicBlogExport = decodePublicBlogExport(await Bun.file(generatedExportPath).json()),
  publicBlogExportAssetById = new Map(
    publicBlogExport.assets.map((asset) => [asset.id, asset]),
  ),
  publicBlogExportAuthorById = new Map(
    publicBlogExport.authors.map((author) => [author.id, author]),
  ),
  publicBlogExportCategoryById = new Map(
    publicBlogExport.categories.map((category) => [category.id, category]),
  ),
  publicBlogExportTagById = new Map(
    publicBlogExport.tags.map((tag) => [tag.id, tag]),
  );

export {
  publicBlogExportAssetById as assetById,
  publicBlogExportAuthorById as authorById,
  publicBlogExportCategoryById as categoryById,
  publicBlogExport as publicExport,
  publicBlogExportTagById as tagById,
};
