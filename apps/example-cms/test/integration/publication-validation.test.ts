import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import type { ExampleSystem } from "../../src/system.ts";
import { createExampleSystem } from "../../src/system.ts";

describe("Example CMS Post publication", () => {
  let system: ExampleSystem;
  let storageRoot: string;

  beforeAll(async () => {
    storageRoot = await mkdtemp(join(import.meta.dir, ".publication-validation-"));
    system = await createExampleSystem({ seed: true, storageRoot });
  });

  afterAll(async () => {
    await system.dispose();
    await rm(storageRoot, { force: true, recursive: true });
  });

  test("returns Field-path issues for public image and live-reference rules", async () => {
    const draftIdentifier = system.seed!.draftPostId,
      stateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${draftIdentifier}/state`,
      entryUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${draftIdentifier}`,
      publishUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/posts/${draftIdentifier}/publications`,
      initialState = (await (await system.handler(new Request(stateUrl))).json()) as {
        entry: { values: Readonly<Record<string, unknown>> };
        writeToken: string;
      },
      publicExport = (await (
        await system.handler(new Request("http://cms.test/api/v1/headless/export"))
      ).json()) as { assets: readonly { id: string }[] },
      invalidImageSave = await system.handler(
        new Request(entryUrl, {
          body: JSON.stringify({
            values: {
              ...initialState.entry.values,
              "featured-alternative-text": "   ",
              "featured-asset": publicExport.assets[0]!.id,
            },
          }),
          headers: {
            "cms-write-token": initialState.writeToken,
            "content-type": "application/json",
          },
          method: "PUT",
        }),
      ),
      invalidImageState = (await invalidImageSave.json()) as { writeToken: string },
      imagePublication = await system.handler(
        new Request(publishUrl, {
          headers: { "cms-write-token": invalidImageState.writeToken },
          method: "POST",
        }),
      ),
      imageFailure = (await imagePublication.json()) as {
        details: { issues: readonly { path: readonly (string | number)[]; reason: string }[] };
      };
    expect(imagePublication.status).toBe(400);
    expect(imageFailure.details.issues).toContainEqual({
      path: ["featured-alternative-text"],
      reason: "missingAlternativeText",
    });

    const targetCreation = await system.handler(
        new Request(
          "http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries",
          {
            body: JSON.stringify({
              values: {
                ...initialState.entry.values,
                slug: "private-reference-target",
                title: "Private reference target",
              },
            }),
            headers: { "content-type": "application/json" },
            method: "POST",
          },
        ),
      ),
      target = (await targetCreation.json()) as { entry: { id: string } },
      invalidReferenceSave = await system.handler(
        new Request(entryUrl, {
          body: JSON.stringify({
            values: {
              ...initialState.entry.values,
              body: {
                children: [
                  {
                    children: [
                      {
                        children: [{ text: "Private draft", type: "text" }],
                        entryId: target.entry.id,
                        type: "entry-reference",
                      },
                    ],
                    type: "paragraph",
                  },
                ],
                format: "nearly-headless-cms/rich-text",
                version: 1,
              },
              "featured-alternative-text": "Meaningful alternative text",
              "featured-asset": publicExport.assets[0]!.id,
            },
          }),
          headers: {
            "cms-write-token": invalidImageState.writeToken,
            "content-type": "application/json",
          },
          method: "PUT",
        }),
      ),
      invalidReferenceState = (await invalidReferenceSave.json()) as { writeToken: string },
      referencePublication = await system.handler(
        new Request(publishUrl, {
          headers: { "cms-write-token": invalidReferenceState.writeToken },
          method: "POST",
        }),
      ),
      referenceFailure = (await referencePublication.json()) as {
        details: { issues: readonly { path: readonly (string | number)[]; reason: string }[] };
      };
    expect(referencePublication.status).toBe(400);
    expect(referenceFailure.details.issues).toContainEqual({
      path: ["body", "children", 0, "children", 0, "entryId"],
      reason: "referenceNotPublic",
    });
  });
});
