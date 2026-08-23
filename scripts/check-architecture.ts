import { join } from "node:path";

const repository = join(import.meta.dir, ".."),
  rootManifest = (await Bun.file(join(repository, "package.json")).json()) as {
    readonly private?: boolean;
    readonly workspaces?: readonly string[];
  };
if (
  rootManifest.private !== true ||
  JSON.stringify(rootManifest.workspaces) !== JSON.stringify(["packages/*", "apps/*"])
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

const workspaceManifests = [
  await Bun.file(join(repository, "packages/nearly-headless-cms/package.json")).json(),
  await Bun.file(join(repository, "apps/example-cms/package.json")).json(),
  await Bun.file(join(repository, "apps/public-blog/package.json")).json(),
] as readonly {
  readonly name: string;
  readonly private?: boolean;
  readonly dependencies?: Readonly<Record<string, string>>;
}[];
if (
  workspaceManifests.length !== 3 ||
  workspaceManifests
    .filter((manifest) => manifest.private !== true)
    .map((manifest) => manifest.name)
    .join(",") !== "nearly-headless-cms"
) {
  throw new Error("Exactly the library package may be publishable");
}
const publicBlog = workspaceManifests.find(
    (manifest) => manifest.name === "@nearly-headless-cms/public-blog",
  )!,
  exampleCms = workspaceManifests.find(
    (manifest) => manifest.name === "@nearly-headless-cms/example-cms",
  )!;
if (
  publicBlog.dependencies?.["nearly-headless-cms"] !== undefined ||
  exampleCms.dependencies?.["nearly-headless-cms"] !== "workspace:*"
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
  if (publicBlog.dependencies?.[forbidden] !== undefined)
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
  if (exampleCms.dependencies?.[forbidden] !== undefined)
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
const libraryManifest = workspaceManifests[0] as {
    readonly exports?: Readonly<Record<string, unknown>>;
  },
  expectedExports = [
    ".",
    "./http",
    "./adapters",
    "./bun/filesystem",
    "./testing",
    "./package.json",
  ];
if (
  JSON.stringify(Object.keys(libraryManifest.exports ?? {})) !== JSON.stringify(expectedExports)
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
console.log(
  JSON.stringify(
    {
      checkedPublicImports: true,
      status: "passed",
      workspaces: workspaceManifests.map((manifest) => manifest.name),
    },
    null,
    2,
  ),
);
