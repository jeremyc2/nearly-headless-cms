import * as HttpApiContract from "../packages/nearly-headless-cms/src/http/http-api.ts";
import { generateClientSource, parseOpenApiDocument } from "./openapi-client-generator.ts";
import { OpenApi } from "../packages/nearly-headless-cms/src/http/index.ts";
import { acceptanceCases } from "../acceptance/v0.1.ts";
import { makeDeliveryOperations } from "../apps/example-cms/src/delivery.ts";
import { makeManagementOperations } from "../apps/example-cms/src/management.ts";
interface GeneratedArtifact {
  readonly content: string;
  readonly path: string;
}

const buildClientArtifacts = (
  document: ReturnType<typeof HttpApiContract.headlessDocument>,
  clientBasename: string,
  outputDirectory: string,
): Promise<readonly GeneratedArtifact[]> => {
  const generatedClient = generateClientSource({
    ...parseOpenApiDocument(document),
    clientBasename,
    formatVersion: 3,
  });
  return formatGeneratedClient(generatedClient, outputDirectory);
},
  formatExitCodeSuccess = 0,
  formatGeneratedClient = (
    generatedClient: ReturnType<typeof generateClientSource>,
    outputDirectory: string,
  ): Promise<readonly GeneratedArtifact[]> =>
    Promise.all(
      generatedClient.files.map((generatedFile) =>
        formatTypeScript(generatedFile.content).then((content) => ({
          content,
          path: `${repository}/${outputDirectory}/${generatedFile.filename}.ts`,
        })),
      ),
    ),
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
    const [headlessClientArtifacts, managementClientArtifacts] = await Promise.all([
      buildClientArtifacts(headlessDocument, "headless-openapi-client", "apps/example-cms/src/generated"),
      buildClientArtifacts(
        managementDocument,
        "management-openapi-client",
        "apps/example-cms/src/generated",
      ),
    ]),
      publicBlogHeadlessClientArtifacts = headlessClientArtifacts.map((artifact) => ({
        ...artifact,
        path: artifact.path.replace(
          "/apps/example-cms/src/generated/",
          "/apps/public-blog/src/generated/",
        ),
      }));
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
        ...managementClientArtifacts,
        ...headlessClientArtifacts,
        ...publicBlogHeadlessClientArtifacts,
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
