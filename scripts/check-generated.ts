import { join } from "node:path";
import * as HttpApiContract from "../packages/nearly-headless-cms/dist/http/http-api.js";
import { OpenApi } from "../packages/nearly-headless-cms/dist/http/index.js";
import { makeDeliveryOperations } from "../apps/example-cms/src/delivery.ts";
import { makeManagementOperations } from "../apps/example-cms/src/management.ts";
import { acceptanceCases } from "../acceptance/v0.1.ts";
import { generateOpenApiClient } from "./openapi-client-generator.ts";

const formatTypeScript = async (source: string): Promise<string> => {
    const formatterProcess = Bun.spawn(
      ["bunx", "oxfmt", "--stdin-filepath=generated-openapi-client.ts"],
      {
        stderr: "pipe",
        stdin: "pipe",
        stdout: "pipe",
      },
    );
    void formatterProcess.stdin.write(source);
    void formatterProcess.stdin.end();
    const [exitCode, formattedSource, standardError] = await Promise.all([
      formatterProcess.exited,
      new Response(formatterProcess.stdout).text(),
      new Response(formatterProcess.stderr).text(),
    ]);
    if (exitCode !== 0) {
      throw new Error(`Failed to format generated client: ${standardError}`);
    }
    return formattedSource;
  },
  repository = join(import.meta.dir, ".."),
  write = process.argv.includes("--write"),
  managementDocument = HttpApiContract.managementDocument(makeManagementOperations()),
  headlessDocument = HttpApiContract.headlessDocument(makeDeliveryOperations()),
  managementClient = await formatTypeScript(generateOpenApiClient(managementDocument)),
  headlessClient = await formatTypeScript(generateOpenApiClient(headlessDocument)),
  artifacts = [
    {
      content: OpenApi.stringify(managementDocument),
      path: join(repository, "apps/example-cms/openapi/management.v1.json"),
    },
    {
      content: OpenApi.stringify(headlessDocument),
      path: join(repository, "apps/example-cms/openapi/headless.v1.json"),
    },
    {
      content: managementClient,
      path: join(repository, "apps/example-cms/src/generated/management-openapi-client.ts"),
    },
    {
      content: headlessClient,
      path: join(repository, "apps/example-cms/src/generated/headless-openapi-client.ts"),
    },
    {
      content: headlessClient,
      path: join(repository, "apps/public-blog/src/generated/headless-openapi-client.ts"),
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
console.log(`${write ? "Updated" : "Verified"} ${artifacts.length} generated artifacts`);
