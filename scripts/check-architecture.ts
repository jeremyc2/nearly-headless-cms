import { join } from "node:path";

const isRecord = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  dependencyAt = (manifest: Readonly<Record<string, unknown>>, name: string): unknown => {
    const dependencies = manifest["dependencies"];
    return isRecord(dependencies) ? dependencies[name] : undefined;
  },
  repository = join(import.meta.dir, ".."),
  rootManifest: unknown = await Bun.file(join(repository, "package.json")).json();
if (
  !isRecord(rootManifest) ||
  rootManifest["private"] !== true ||
  JSON.stringify(rootManifest["workspaces"]) !== JSON.stringify(["packages/*", "apps/*"])
) {
  throw new Error("Root must be a private coordinator with the settled workspace topology");
}

const workspaceManifestPaths: string[] = [];
for (const pattern of ["packages/*/package.json", "apps/*/package.json"]) {
  for await (const path of new Bun.Glob(pattern).scan({ cwd: repository })) {
    workspaceManifestPaths.push(path);
  }
}
if (workspaceManifestPaths.length !== 3) {
  throw new Error(
    `Expected exactly three workspace manifests, found ${workspaceManifestPaths.length}`,
  );
}

const workspaceManifestValues: readonly unknown[] = [
  await Bun.file(join(repository, "packages/nearly-headless-cms/package.json")).json(),
  await Bun.file(join(repository, "apps/example-cms/package.json")).json(),
  await Bun.file(join(repository, "apps/public-blog/package.json")).json(),
] as const;
if (!workspaceManifestValues.every(isRecord)) {
  throw new Error("Every workspace manifest must contain a JSON object");
}
const workspaceManifests = workspaceManifestValues;
if (
  workspaceManifests.length !== 3 ||
  workspaceManifests
    .filter((manifest) => manifest["private"] !== true)
    .map((manifest) => manifest["name"])
    .join(",") !== "nearly-headless-cms"
) {
  throw new Error("Exactly the library package may be publishable");
}
const publicBlog = workspaceManifests.find(
    (manifest) => manifest["name"] === "@nearly-headless-cms/public-blog",
  ),
  exampleCms = workspaceManifests.find(
    (manifest) => manifest["name"] === "@nearly-headless-cms/example-cms",
  );
if (
  publicBlog === undefined ||
  exampleCms === undefined ||
  dependencyAt(publicBlog, "nearly-headless-cms") !== undefined ||
  dependencyAt(exampleCms, "nearly-headless-cms") !== "workspace:*"
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
  if (dependencyAt(publicBlog, forbidden) !== undefined)
    throw new Error(`Public Blog has forbidden direct dependency ${forbidden}`);
}
for (const forbidden of [
  "vite",
  "hono",
  "@playwright/test",
  "@testing-library/react",
  "tiptap",
  "concurrently",
]) {
  if (dependencyAt(exampleCms, forbidden) !== undefined)
    throw new Error(`Example CMS has forbidden dependency ${forbidden}`);
}

const sourceGlob = new Bun.Glob("apps/public-blog/src/**/*.{ts,astro}");
for await (const relativePath of sourceGlob.scan({ cwd: repository })) {
  const source = await Bun.file(join(repository, relativePath)).text();
  if (
    /from\s+["']nearly-headless-cms(?:\/|["'])/u.test(source) ||
    /from\s+["'][^"']*example-cms/u.test(source)
  ) {
    throw new Error(`Public Blog imports a forbidden runtime at ${relativePath}`);
  }
}
const libraryExports = workspaceManifests[0]["exports"],
  expectedExports = [
    ".",
    "./http",
    "./adapters",
    "./bun/filesystem",
    "./testing",
    "./package.json",
  ];
if (
  !isRecord(libraryExports) ||
  JSON.stringify(Object.keys(libraryExports)) !== JSON.stringify(expectedExports)
) {
  throw new Error("Library exports map is not the complete settled public seam");
}
const portableDistributionGlob = new Bun.Glob("packages/nearly-headless-cms/dist/**/*.{js,d.ts}");
for await (const relativePath of portableDistributionGlob.scan({ cwd: repository })) {
  if (relativePath.includes("/bun/filesystem/")) {
    continue;
  }
  const source = await Bun.file(join(repository, relativePath)).text();
  if (/\bBun\.|["']bun:/u.test(source)) {
    throw new Error(`Portable package entry point leaks a Bun-only runtime at ${relativePath}`);
  }
}

const publicApiSourcePaths = [
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
  undocumentedDeclarations: string[] = [];
let documentedPublicDeclarationCount = 0;
for (const sourcePath of publicApiSourcePaths) {
  const packageRelativePath = `packages/nearly-headless-cms/${sourcePath}`,
    lines = (await Bun.file(join(repository, packageRelativePath)).text()).split("\n");
  for (const [lineIndex, line] of lines.entries()) {
    if (!/^export (?:class|const|function|interface|type|\*|\{)/u.test(line)) {
      continue;
    }
    let commentLineIndex = lineIndex - 1;
    if (!lines[commentLineIndex]?.trimEnd().endsWith("*/")) {
      undocumentedDeclarations.push(`${packageRelativePath}:${lineIndex + 1}`);
      continue;
    }
    while (commentLineIndex >= 0 && !lines[commentLineIndex]?.trimStart().startsWith("/**")) {
      commentLineIndex -= 1;
    }
    if (commentLineIndex < 0) {
      undocumentedDeclarations.push(`${packageRelativePath}:${lineIndex + 1}`);
      continue;
    }
    documentedPublicDeclarationCount += 1;
  }
}
if (undocumentedDeclarations.length > 0) {
  throw new Error(`Public API declarations need TSDoc:\n${undocumentedDeclarations.join("\n")}`);
}
console.log(
  JSON.stringify(
    {
      checkedPublicImports: true,
      documentedPublicDeclarationCount,
      status: "passed",
      workspaces: workspaceManifests.map((manifest) => manifest.name),
    },
    null,
    2,
  ),
);
