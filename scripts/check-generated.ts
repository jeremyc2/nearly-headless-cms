import { join } from "node:path";
import { OpenApi } from "../packages/nearly-headless-cms/dist/http/index.js";
import { makeDeliveryOperations } from "../apps/example-cms/src/delivery.ts";
import { makeManagementOperations } from "../apps/example-cms/src/management.ts";
import { acceptanceCases } from "../acceptance/v0.1.ts";

const repository = join(import.meta.dir, ".."),
  write = process.argv.includes("--write"),
  artifacts = [
    {
      content: `${JSON.stringify(OpenApi.management(makeManagementOperations()), null, 2)}\n`,
      path: join(repository, "apps/example-cms/openapi/management.v1.json"),
    },
    {
      content: `${JSON.stringify(OpenApi.headless(makeDeliveryOperations()), (_key, value) => (typeof value === "function" ? undefined : value), 2)}\n`,
      path: join(repository, "apps/example-cms/openapi/headless.v1.json"),
    },
    {
      content: `# v0.1 acceptance manifest\n\nThis file is generated from \`acceptance/v0.1.ts\`.\n\n| ID | Claim | Level | Owner | Status | Command |\n| --- | --- | --- | --- | --- | --- |\n${acceptanceCases.map((acceptanceCase) => `| ${acceptanceCase.id} | ${acceptanceCase.claim.replaceAll("|", "\\|")} | ${acceptanceCase.level} | ${acceptanceCase.owner} | ${acceptanceCase.automation} | \`${acceptanceCase.command}\` |`).join("\n")}\n`,
      path: join(repository, "docs/acceptance/v0.1.md"),
    },
  ];
for (const artifact of artifacts) {
  if (write) {
    await Bun.write(artifact.path, artifact.content);
    continue;
  }
  if (
    !(await Bun.file(artifact.path).exists()) ||
    (await Bun.file(artifact.path).text()) !== artifact.content
  ) {
    throw new Error(`Generated artifact is stale: ${artifact.path}`);
  }
}
for (const clientPath of [
  "apps/example-cms/src/generated/management-client.ts",
  "apps/example-cms/src/generated/headless-client.ts",
  "apps/public-blog/src/generated/headless-client.ts",
]) {
  const client = await Bun.file(join(repository, clientPath)).text();
  if (!client.includes("generatorFormatVersion = 1")) {
    throw new Error(`Generated client is missing its format version: ${clientPath}`);
  }
}
console.log(
  `${write ? "Updated" : "Verified"} ${artifacts.length} generated artifacts and 3 generated clients`,
);
