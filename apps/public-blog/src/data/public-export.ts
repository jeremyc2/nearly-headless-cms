import { PublicBlogExportSchema } from "../generated/headless-client.ts";
import { Schema } from "effect";

const decodePublicBlogExport = Schema.decodeUnknownSync(PublicBlogExportSchema),
  generatedExportPath = `${process.cwd()}/.generated/public-export.json`,
  publicBlogExport = decodePublicBlogExport(await Bun.file(generatedExportPath).json()),
  publicBlogExportAssetById = new Map(publicBlogExport.assets.map((asset) => [asset.id, asset])),
  publicBlogExportAuthorById = new Map(
    publicBlogExport.authors.map((author) => [author.id, author]),
  ),
  publicBlogExportCategoryById = new Map(
    publicBlogExport.categories.map((category) => [category.id, category]),
  ),
  publicBlogExportTagById = new Map(publicBlogExport.tags.map((tag) => [tag.id, tag])),
  publicBlogExportGuideById = new Map(
    publicBlogExport.guides.map((guide) => [guide.id, guide]),
  );

export {
  publicBlogExportAssetById as assetById,
  publicBlogExportAuthorById as authorById,
  publicBlogExportCategoryById as categoryById,
  publicBlogExportGuideById as guideById,
  publicBlogExport as publicExport,
  publicBlogExportTagById as tagById,
};
