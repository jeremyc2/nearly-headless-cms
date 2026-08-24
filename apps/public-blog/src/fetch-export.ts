import { mkdir, rename, rm } from "node:fs/promises";
import { join } from "node:path";
import { Effect } from "effect";
import {
  type PublicBlogExport,
  UnsupportedDefinition,
  makeHeadlessClient,
} from "./generated/headless-client.ts";

const workspace = join(import.meta.dir, ".."),
  generatedDirectory = join(workspace, ".generated"),
  assetsDirectory = join(workspace, "public", "generated-assets"),
  cmsBaseUrl = Bun.env.EXAMPLE_CMS_URL ?? "http://localhost:3000",
  client = makeHeadlessClient(cmsBaseUrl),
  program = Effect.gen(function* program() {
    const discovery = yield* client.discover(),
      contractVersion = discovery.apiContractVersion,
      fingerprint = discovery.definitionFingerprint,
      richText = discovery.richText as Readonly<Record<string, unknown>> | undefined;
    if (
      contractVersion !== 1 ||
      typeof fingerprint !== "string" ||
      richText?.version !== 1 ||
      (Array.isArray(richText?.extensions) && richText.extensions.length > 0)
    ) {
      return yield* UnsupportedDefinition.make({
        message: "Public Blog cannot support the advertised Definition Snapshot",
      });
    }
    const exported = yield* client.exportPublicBlog(fingerprint);
    if (
      exported.definitionFingerprint !== fingerprint ||
      exported.posts.some((post) => post.status !== "published") ||
      exported.comments.some((comment) => comment.status !== "approved")
    ) {
      return yield* UnsupportedDefinition.make({
        message: "Public export violates its advertised public contract",
      });
    }
    return exported;
  }),
  exported = await Effect.runPromise(program);
await mkdir(generatedDirectory, { recursive: true });
await mkdir(assetsDirectory, { recursive: true });
const assets: PublicBlogExport["assets"][number][] = [];
for (const asset of exported.assets) {
  const response = await fetch(
    `${cmsBaseUrl}/api/v1/headless/assets/${encodeURIComponent(asset.id)}`,
  );
  if (!response.ok) {
    throw new Error(`Asset ${asset.id} failed with ${response.status}`);
  }
  const extension =
      asset.metadata.mediaType === "image/svg+xml"
        ? ".svg"
        : asset.metadata.mediaType === "image/png"
          ? ".png"
          : asset.metadata.mediaType === "image/jpeg"
            ? ".jpg"
            : ".bin",
    filename = `${asset.id}${extension}`,
    stagePath = join(assetsDirectory, `.stage-${filename}`),
    finalPath = join(assetsDirectory, filename);
  await Bun.write(stagePath, await response.arrayBuffer());
  await rename(stagePath, finalPath);
  assets.push({ ...asset, localPath: `/generated-assets/${filename}` });
}
const snapshot: PublicBlogExport = { ...exported, assets },
  stageSnapshotPath = join(generatedDirectory, ".public-export.stage.json"),
  snapshotPath = join(generatedDirectory, "public-export.json");
try {
  await Bun.write(stageSnapshotPath, `${JSON.stringify(snapshot, null, 2)}\n`);
  await rename(stageSnapshotPath, snapshotPath);
} catch (error) {
  await rm(stageSnapshotPath, { force: true });
  throw error;
}
console.log(`Fetched coherent public export ${snapshot.definitionFingerprint}`);
