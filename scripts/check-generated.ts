import * as HttpApiContract from "../packages/nearly-headless-cms/src/http/http-api.ts";
import { OpenApi } from "../packages/nearly-headless-cms/src/http/index.ts";
import { acceptanceCases } from "../acceptance/v0.1.ts";
import { generateOpenApiClient } from "./openapi-client-generator.ts";
import { makeDeliveryOperations } from "../apps/example-cms/src/delivery.ts";
import { makeManagementOperations } from "../apps/example-cms/src/management.ts";

interface GeneratedArtifact {
  readonly content: string;
  readonly path: string;
}

const formatExitCodeSuccess = 0,
  formatTypeScript = (source: string): Promise<string> => {
    const formatterProcess = Bun.spawn(
      ["bunx", "oxfmt", "--stdin-filepath=generated-openapi-client.ts"],
      {
        stderr: "pipe",
        stdin: "pipe",
        stdout: "pipe",
      },
    );
    return Promise.all([formatterProcess.stdin.write(source), formatterProcess.stdin.end()])
      .then(() =>
        Promise.all([
          formatterProcess.exited,
          new Response(formatterProcess.stdout).text(),
          new Response(formatterProcess.stderr).text(),
        ]),
      )
      .then(([exitCode, formattedSource, standardError]) => {
        if (exitCode !== formatExitCodeSuccess) {
          throw new Error(`Failed to format generated client: ${standardError}`);
        }
        return formattedSource;
      });
  },
  repository = new URL("..", import.meta.url).pathname,
  verifyArtifact = (artifact: GeneratedArtifact, writeMode: boolean): Promise<unknown> => {
    if (writeMode) {
      return Bun.write(artifact.path, artifact.content);
    }
    const artifactFile = Bun.file(artifact.path);
    return Promise.all([artifactFile.exists(), artifactFile.text()]).then(
      ([exists, currentContent]) => {
        if (!exists || currentContent !== artifact.content) {
          throw new Error(`Generated artifact is stale: ${artifact.path}`);
        }
      },
    );
  },
  writeMode = Bun.argv.includes("--write");

{
  const headlessDocument = HttpApiContract.headlessDocument(makeDeliveryOperations()),
    managementDocument = HttpApiContract.managementDocument(makeManagementOperations());
  {
    const [headlessClient, managementClient] = await Promise.all([
      formatTypeScript(generateOpenApiClient(headlessDocument)),
      formatTypeScript(generateOpenApiClient(managementDocument)),
    ]);
    {
      const artifacts: readonly GeneratedArtifact[] = [
        {
          content: OpenApi.stringify(managementDocument),
          path: `${repository}/apps/example-cms/openapi/management.v1.json`,
        },
        {
          content: OpenApi.stringify(headlessDocument),
          path: `${repository}/apps/example-cms/openapi/headless.v1.json`,
        },
        {
          content: managementClient,
          path: `${repository}/apps/example-cms/src/generated/management-openapi-client.ts`,
        },
        {
          content: headlessClient,
          path: `${repository}/apps/example-cms/src/generated/headless-openapi-client.ts`,
        },
        {
          content: headlessClient,
          path: `${repository}/apps/public-blog/src/generated/headless-openapi-client.ts`,
        },
        {
          content: `# v0.1 acceptance manifest\n\nThis file is generated from \`acceptance/v0.1.ts\`.\n\n| ID | Claim | Level | Owner | Status | Command |\n| --- | --- | --- | --- | --- | --- |\n${acceptanceCases.map((acceptanceCase) => `| ${acceptanceCase.id} | ${acceptanceCase.claim.replaceAll("|", String.raw`\|`)} | ${acceptanceCase.level} | ${acceptanceCase.owner} | ${acceptanceCase.automation} | \`${acceptanceCase.command}\` |`).join("\n")}\n`,
          path: `${repository}/docs/acceptance/v0.1.md`,
        },
      ];
      await Promise.all(artifacts.map((artifact) => verifyArtifact(artifact, writeMode)));
      if (writeMode) {
        await Bun.stdout.write(`Updated ${artifacts.length} generated artifacts\n`);
      }
      if (!writeMode) {
        await Bun.stdout.write(`Verified ${artifacts.length} generated artifacts\n`);
      }
    }
  }
}
