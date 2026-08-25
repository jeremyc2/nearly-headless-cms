import { Effect, ManagedRuntime, Schema } from "effect";
import { FetchHttpClient, HttpClient } from "effect/unstable/http";
import {
  type PublicAsset,
  type PublicBlogExport,
  PublicBlogExportSchema,
  UnsupportedDefinition,
  makeHeadlessClient,
} from "./generated/headless-client.ts";
import { FetchExportFailure } from "./fetch-export-failure.ts";

const assetExtension = (mediaType: string): string => {
    if (mediaType === "image/svg+xml") {
      return ".svg";
    }
    if (mediaType === "image/png") {
      return ".png";
    }
    if (mediaType === "image/jpeg") {
      return ".jpg";
    }
    return ".bin";
  },
  assetResponseLowerBound = 200,
  assetResponseUpperBound = 300,
  assetsDirectory = new URL("../public/generated-assets/", import.meta.url).pathname,
  cmsBaseUrl = Bun.env.EXAMPLE_CMS_URL ?? "http://localhost:3000",
  cmsClient = makeHeadlessClient(cmsBaseUrl),
  fetchAsset = (
    asset: PublicAsset,
  ): Effect.Effect<PublicAsset, FetchExportFailure, HttpClient.HttpClient> => {
    const extension = assetExtension(asset.metadata.mediaType),
      filename = `${asset.id}${extension}`,
      finalPath = `${assetsDirectory}${filename}`,
      stagePath = `${assetsDirectory}.stage-${filename}`,
      url = `${cmsBaseUrl}/api/v1/headless/assets/${encodeURIComponent(asset.id)}`;
    return HttpClient.get(url).pipe(
      Effect.mapError((cause) =>
        FetchExportFailure.make({ cause, message: `Asset ${asset.id} request failed` }),
      ),
      Effect.flatMap((response) => {
        if (
          response.status < assetResponseLowerBound ||
          response.status >= assetResponseUpperBound
        ) {
          return FetchExportFailure.make({
            message: `Asset ${asset.id} failed with ${response.status}`,
          });
        }
        return response.arrayBuffer.pipe(
          Effect.mapError((cause) =>
            FetchExportFailure.make({ cause, message: `Asset ${asset.id} body failed` }),
          ),
        );
      }),
      Effect.flatMap((contents) =>
        Effect.tryPromise({
          catch: (cause) =>
            FetchExportFailure.make({ cause, message: `Asset ${asset.id} write failed` }),
          try: () =>
            Bun.write(stagePath, contents).then(() => Bun.$`mv ${stagePath} ${finalPath}`.quiet()),
        }),
      ),
      Effect.as({ ...asset, localPath: `/generated-assets/${filename}` }),
      Effect.tapError(() =>
        Effect.promise(() => Bun.$`rm -f ${stagePath}`.quiet()).pipe(Effect.ignore),
      ),
    );
  },
  fixtureAssetsDirectory = new URL("../fixtures/generated-assets/", import.meta.url).pathname,
  fixtureDirectory = new URL("../fixtures/", import.meta.url).pathname,
  fixtureSnapshotPath = `${fixtureDirectory}public-export.json`,
  generatedDirectory = new URL("../.generated/", import.meta.url).pathname,
  generatedSnapshotPath = `${generatedDirectory}public-export.json`,
  generatedStageSnapshotPath = `${generatedDirectory}.public-export.stage.json`,
  // oxlint-disable-next-line eslint/sort-vars -- [EH-133] fixture install helpers are declared before the export programs that call them.
  installFixtureExport = (): Effect.Effect<void, FetchExportFailure> =>
    Effect.gen(function* installFixtureExportEffect() {
      const fixtureSnapshot = yield* Effect.tryPromise({
        catch: (cause) =>
          FetchExportFailure.make({ cause, message: "Public export fixture read failed" }),
        try: () => Bun.file(fixtureSnapshotPath).text(),
      });
      yield* Effect.tryPromise({
        catch: (cause) =>
          FetchExportFailure.make({ cause, message: "Public export fixture asset copy failed" }),
        try: () => Bun.$`mkdir -p ${generatedDirectory} ${assetsDirectory}`.quiet(),
      });
      yield* Effect.tryPromise({
        catch: (cause) =>
          FetchExportFailure.make({
            cause,
            message: "Public export fixture snapshot write failed",
          }),
        try: () => Bun.write(generatedSnapshotPath, `${fixtureSnapshot.trim()}\n`),
      });
      yield* Effect.tryPromise({
        catch: (cause) =>
          FetchExportFailure.make({ cause, message: "Public export fixture asset copy failed" }),
        try: () => Bun.$`cp -R ${fixtureAssetsDirectory}. ${assetsDirectory}`.quiet(),
      });
      return yield* Effect.log("Installed committed Public Blog export fixture");
    }),
  noItemsCount = 0,
  readPublicExport = Effect.gen(function* readPublicExportEffect() {
    const discovery = yield* cmsClient.discover;
    if (discovery.richText.extensions.length > noItemsCount) {
      return yield* UnsupportedDefinition.make({
        message: "Public Blog cannot support the advertised Definition Snapshot",
      });
    }
    {
      const exported = yield* cmsClient.exportPublicBlog(discovery.definitionFingerprint);
      if (exported.definitionFingerprint !== discovery.definitionFingerprint) {
        return yield* UnsupportedDefinition.make({
          message: "Public export violates its advertised public contract",
        });
      }
      return exported;
    }
  }),
  useCommittedFixture = Bun.env.PUBLIC_BLOG_USE_FIXTURE === "1",
  // oxlint-disable-next-line eslint/sort-vars -- [EH-133] export programs are declared before the runtime that executes them.
  fetchPublicExportProgram = Effect.gen(function* fetchPublicExport() {
    const exported = yield* readPublicExport;
    yield* Effect.promise(() => Bun.$`mkdir -p ${generatedDirectory} ${assetsDirectory}`.quiet());
    {
      const assets = yield* Effect.forEach(exported.assets, fetchAsset, {
          concurrency: "unbounded",
        }),
        snapshot: PublicBlogExport = { ...exported, assets };
      yield* writePublicSnapshot(snapshot);
      return yield* Effect.log(`Fetched coherent public export ${snapshot.definitionFingerprint}`);
    }
  }),
  writePublicSnapshot = (snapshot: PublicBlogExport): Effect.Effect<void, FetchExportFailure> =>
    Effect.gen(function* writePublicSnapshotEffect() {
      const snapshotJson = yield* Schema.encodeEffect(
        Schema.fromJsonString(PublicBlogExportSchema),
      )(snapshot).pipe(
        Effect.mapError((cause) =>
          FetchExportFailure.make({ cause, message: "Public export snapshot encoding failed" }),
        ),
      );
      yield* Effect.tryPromise({
        catch: (cause) =>
          FetchExportFailure.make({ cause, message: "Public export snapshot write failed" }),
        try: () =>
          Bun.write(generatedStageSnapshotPath, `${snapshotJson}\n`).then(() =>
            Bun.$`mv ${generatedStageSnapshotPath} ${generatedSnapshotPath}`.quiet(),
          ),
      }).pipe(
        Effect.tapError(() =>
          Effect.promise(() => Bun.$`rm -f ${generatedStageSnapshotPath}`.quiet()).pipe(
            Effect.ignore,
          ),
        ),
        Effect.asVoid,
      );
    }),
  zRuntime = ManagedRuntime.make(FetchHttpClient.layer);

let zProgram = fetchPublicExportProgram;
if (useCommittedFixture) {
  zProgram = installFixtureExport();
}

try {
  await zRuntime.runPromise(zProgram);
} finally {
  await zRuntime.dispose();
}
