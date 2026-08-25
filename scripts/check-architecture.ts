// This standalone Bun CLI resolves repository paths before any Effect application exists.
// oxlint-disable-next-line effecttsgo/node-builtin-import
import path from "node:path";

const architectureRepository = path.join(import.meta.dir, ".."),
  dependencyAt = (manifest: Readonly<Record<string, unknown>>, name: string): unknown => {
    const { dependencies } = manifest;
    if (recordIs(dependencies)) {
      return dependencies[name];
    }
    return undefined;
  },
  documentationScanState = { declarations: [] as string[], documentedCount: 0 },
  expectedExports = [
    ".",
    "./http",
    "./adapters",
    "./bun/filesystem",
    "./testing",
    "./package.json",
  ],
  expectedWorkspaceCount = 3,
  findBlockCommentStart = (lines: readonly string[], lineIndex: number): number | undefined => {
    let commentLineIndex = lineIndex - oneItem;
    if (lines[commentLineIndex]?.trimEnd().endsWith("*/") !== true) {
      return undefined;
    }
    while (
      commentLineIndex >= firstIndex &&
      lines[commentLineIndex]?.trimStart().startsWith("/**") !== true
    ) {
      commentLineIndex -= oneItem;
    }
    if (commentLineIndex < firstIndex) {
      return undefined;
    }
    return commentLineIndex;
  },
  findWorkspaceManifest = (name: string): Readonly<Record<string, unknown>> | undefined => {
    const manifest = workspaceManifests.find((candidate) => candidate["name"] === name);
    if (!recordIs(manifest)) {
      return undefined;
    }
    return manifest;
  },
  firstIndex = 0,
  oneItem = 1,
  portableDistributionGlob = new Bun.Glob("packages/nearly-headless-cms/dist/**/*.{js,d.ts}"),
  portableDistributionPaths = await Array.fromAsync(
    portableDistributionGlob.scan({ cwd: architectureRepository }),
  ),
  publicApiSourcePaths = [
    "src/index.ts",
    "src/asset.ts",
    "src/authorization.ts",
    "src/cms.ts",
    "src/cms-error.ts",
    "src/content-definition.ts",
    "src/definition-migration.ts",
    "src/entry.ts",
    "src/entry-history.ts",
    "src/entry-query.ts",
    "src/identifier.ts",
    "src/identity.ts",
    "src/operation.ts",
    "src/persistence.ts",
    "src/rich-text.ts",
    "src/transport.ts",
    "src/http/index.ts",
    "src/http/http-contract.ts",
    "src/http/http-transport.ts",
    "src/http/open-api.ts",
    "src/adapters/index.ts",
    "src/adapters/allow-all-authorization.ts",
    "src/adapters/anonymous-identity.ts",
    "src/adapters/crypto-identifier-generator.ts",
    "src/adapters/memory-asset-management.ts",
    "src/adapters/memory-definition-catalog.ts",
    "src/adapters/memory-entry-persistence.ts",
    "src/bun/filesystem/index.ts",
    "src/bun/filesystem/bun-filesystem-persistence.ts",
    "src/testing/index.ts",
    "src/testing/development-cms.ts",
  ],
  recordIs = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  requireWorkspaceManifest = (name: string): Readonly<Record<string, unknown>> => {
    const manifest = findWorkspaceManifest(name);
    if (manifest === undefined) {
      throw new Error(`Missing workspace manifest ${name}`);
    }
    return manifest;
  },
  rootManifest: unknown = await Bun.file(
    path.join(architectureRepository, "package.json"),
  ).json(),
  sourceGlob = new Bun.Glob("apps/public-blog/src/**/*.{ts,astro}"),
  sourcePaths = await Array.fromAsync(sourceGlob.scan({ cwd: architectureRepository })),
  twoSpaceIndent = 2,
  workspaceManifestGlobMatches = await Promise.all(
    ["packages/*/package.json", "apps/*/package.json"].map((pattern) =>
      Array.fromAsync(new Bun.Glob(pattern).scan({ cwd: architectureRepository })),
    ),
  ),
  workspaceManifestPaths = workspaceManifestGlobMatches.flat(),
  workspaceManifestValues: readonly unknown[] = [
    await Bun.file(
      path.join(architectureRepository, "packages/nearly-headless-cms/package.json"),
    ).json(),
    await Bun.file(path.join(architectureRepository, "apps/example-cms/package.json")).json(),
    await Bun.file(path.join(architectureRepository, "apps/public-blog/package.json")).json(),
  ] as const,
  workspaceManifests = workspaceManifestValues.filter((value) => recordIs(value));
if (
  !recordIs(rootManifest) ||
  rootManifest["private"] !== true ||
  JSON.stringify(rootManifest["workspaces"]) !== JSON.stringify(["packages/*", "apps/*"])
) {
  throw new Error("Root must be a private coordinator with the settled workspace topology");
}
if (workspaceManifestPaths.length !== expectedWorkspaceCount) {
  throw new Error(
    `Expected exactly ${expectedWorkspaceCount} workspace manifests, found ${workspaceManifestPaths.length}`,
  );
}
if (workspaceManifestValues.length !== workspaceManifests.length) {
  throw new Error("Every workspace manifest must contain a JSON object");
}
if (
  workspaceManifests.length !== expectedWorkspaceCount ||
  workspaceManifests
    .filter((manifest) => manifest["private"] !== true)
    .map((manifest) => manifest["name"])
    .join(",") !== "nearly-headless-cms"
) {
  throw new Error("Exactly the library package may be publishable");
}
{
  const libraryManifest = findWorkspaceManifest("nearly-headless-cms");
  if (
    libraryManifest === undefined ||
    !recordIs(libraryManifest["exports"]) ||
    JSON.stringify(Object.keys(libraryManifest["exports"])) !==
      JSON.stringify(expectedExports)
  ) {
    throw new Error("Library exports map is not the complete settled public seam");
  }
}
if (
  findWorkspaceManifest("@nearly-headless-cms/public-blog") === undefined ||
  findWorkspaceManifest("@nearly-headless-cms/example-cms") === undefined ||
  dependencyAt(
    requireWorkspaceManifest("@nearly-headless-cms/public-blog"),
    "nearly-headless-cms",
  ) !== undefined ||
  dependencyAt(
    requireWorkspaceManifest("@nearly-headless-cms/example-cms"),
    "nearly-headless-cms",
  ) !== "workspace:*"
) {
  throw new Error("Application dependency direction violates the Headless API boundary");
}
for (const forbidden of [
  "react",
  "@astrojs/react",
  "@astrojs/tailwind",
  "vite",
  "@playwright/test",
  "happy-dom",
  "jsdom",
  "orval",
]) {
  if (
    dependencyAt(requireWorkspaceManifest("@nearly-headless-cms/public-blog"), forbidden) !==
    undefined
  ) {
    throw new Error(`Public Blog has forbidden direct dependency ${forbidden}`);
  }
}
for (const forbidden of [
  "vite",
  "hono",
  "@playwright/test",
  "@testing-library/react",
  "tiptap",
  "concurrently",
]) {
  if (
    dependencyAt(requireWorkspaceManifest("@nearly-headless-cms/example-cms"), forbidden) !==
    undefined
  ) {
    throw new Error(`Example CMS has forbidden dependency ${forbidden}`);
  }
}
await Promise.all(
  // oxlint-disable-next-line effecttsgo/async-function -- parallel architecture scans use async file reads.
  sourcePaths.map(async (relativePath) => {
    const source = await Bun.file(path.join(architectureRepository, relativePath)).text();
    if (
      /from\s+["']nearly-headless-cms(?:\/|["'])/u.test(source) ||
      /from\s+["'][^"']*example-cms/u.test(source)
    ) {
      throw new Error(`Public Blog imports a forbidden runtime at ${relativePath}`);
    }
  }),
);
await Promise.all(
  portableDistributionPaths
    .filter((relativePath) => !relativePath.includes("/bun/filesystem/"))
    // oxlint-disable-next-line effecttsgo/async-function -- parallel portability scans use async file reads.
    .map(async (relativePath) => {
      const source = await Bun.file(path.join(architectureRepository, relativePath)).text();
      if (/\bBun\.|["']bun:/u.test(source)) {
        throw new Error(`Portable package entry point leaks a Bun-only runtime at ${relativePath}`);
      }
    }),
);
for (const sourcePath of publicApiSourcePaths) {
  const packageRelativePath = `packages/nearly-headless-cms/${sourcePath}`,
    // Check files in declaration order so diagnostics remain deterministic.
    // oxlint-disable-next-line no-await-in-loop -- checks intentionally run sequentially.
    sourceText = await Bun.file(path.join(architectureRepository, packageRelativePath)).text(),
    splitSourceLines = sourceText.split("\n");
  for (const [lineIndex, line] of splitSourceLines.entries()) {
    if (/^export (?:class|const|function|interface|type|\*|\{)/u.test(line)) {
      const commentLineIndex = findBlockCommentStart(splitSourceLines, lineIndex);
      if (commentLineIndex === undefined) {
        documentationScanState.declarations.push(`${packageRelativePath}:${lineIndex + oneItem}`);
      } else {
        documentationScanState.documentedCount += oneItem;
      }
    }
  }
}
if (documentationScanState.declarations.length > 0) {
  throw new Error(
    `Public API declarations need TSDoc:\n${documentationScanState.declarations.join("\n")}`,
  );
}
// oxlint-disable-next-line effecttsgo/global-console -- this script's contract is machine-readable CLI stdout.
console.log(
  JSON.stringify(
    {
      checkedPublicImports: true,
      documentedPublicDeclarationCount: documentationScanState.documentedCount,
      status: "passed",
      workspaces: workspaceManifests.map((manifest) => manifest["name"]),
    },
    null,
    twoSpaceIndent,
  ),
);
