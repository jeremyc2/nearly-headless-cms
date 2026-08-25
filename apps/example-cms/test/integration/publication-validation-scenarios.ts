import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";
import {
  type PublicationValidationHandler,
  createTemporaryStorageRoot,
  exportUrl,
  firstItemIndex,
  httpBadRequest,
  jsonRecord,
  managementEntriesUrl,
  managementEntryUrl,
  managementStateUrl,
  publishPostUrl,
  readEntryValues,
  readFirstAssetId,
  readValidationIssues,
  removeStorageRoot,
  requireDraftPostId,
  requireEntryIdentifier,
  requireWriteToken,
  richTextVersion,
} from "./publication-validation-support.ts";
import { expect } from "bun:test";

export interface PublicationValidationFixture {
  readonly dispose: () => Promise<void>;
  readonly storageRoot: string;
  readonly system: ExampleSystem;
}

interface DraftEntryContext {
  readonly draftIdentifier: string;
  readonly entryUrl: string;
  readonly entryValues: Readonly<Record<string, unknown>>;
  readonly handler: PublicationValidationHandler;
}

interface ImagePublicationContext extends DraftEntryContext {
  readonly publicAssetIdentifier: string | undefined;
  readonly writeToken: string;
}

interface ReferencePublicationContext extends DraftEntryContext {
  readonly invalidImageWriteToken: string;
  readonly publicAssetIdentifier: string | undefined;
}

interface RejectedPublicationExpectation {
  readonly expectedPath: readonly (string | number)[];
  readonly expectedReason: string;
  readonly handler: PublicationValidationHandler;
  readonly postIdentifier: string;
  readonly writeToken: string;
}

const assertRejectedPublication = (expectation: RejectedPublicationExpectation): Promise<void> =>
    readPublicationFailure(
      expectation.handler,
      expectation.postIdentifier,
      expectation.writeToken,
    ).then(({ failure, response }) => {
      expect(response.status).toBe(httpBadRequest);
      expectPublicationIssue(
        readValidationIssues(failure),
        expectation.expectedPath,
        expectation.expectedReason,
      );
    }),
  buildInvalidReferenceBody = (
    targetEntryIdentifier: string,
  ): Readonly<Record<string, unknown>> => ({
    children: [
      {
        children: [
          {
            children: [{ text: "Private draft", type: "text" }],
            entryId: targetEntryIdentifier,
            type: "entry-reference",
          },
        ],
        type: "paragraph",
      },
    ],
    format: "nearly-headless-cms/rich-text",
    version: richTextVersion,
  }),
  createPrivateReferenceTarget = (context: DraftEntryContext): Promise<string> =>
    context
      .handler(
        new Request(managementEntriesUrl("post"), {
          body: JSON.stringify({
            values: {
              ...context.entryValues,
              slug: "private-reference-target",
              title: "Private reference target",
            },
          }),
          headers: { "content-type": "application/json" },
          method: "POST",
        }),
      )
      .then(jsonRecord)
      .then(requireEntryIdentifier),
  // Bun lifecycle hooks require a Promise-returning dispose callback.
  // oxlint-disable-next-line effecttsgo/async-function -- fixture setup intentionally awaits native filesystem and CMS startup.
  createPublicationValidationFixture = async (
    testDirectory: string,
  ): Promise<PublicationValidationFixture> => {
    const storageRoot = await createTemporaryStorageRoot(testDirectory),
      system = await createExampleSystem({ seed: true, storageRoot });
    return {
      // oxlint-disable-next-line effecttsgo/async-function -- fixture teardown awaits native filesystem cleanup.
      dispose: async () => {
        await system.dispose();
        await removeStorageRoot(storageRoot);
      },
      storageRoot,
      system,
    };
  },
  disposePublicationValidationFixture = (fixture: PublicationValidationFixture): Promise<void> =>
    fixture.dispose(),
  expectPublicationIssue = (
    issues: readonly Readonly<Record<string, unknown>>[],
    expectedPath: readonly (string | number)[],
    expectedReason: string,
  ): void => {
    expect(issues).toContainEqual({
      path: expectedPath,
      reason: expectedReason,
    });
  },
  publishEntry = (
    handler: PublicationValidationHandler,
    postIdentifier: string,
    writeToken: string,
  ): Promise<Response> =>
    handler(
      new Request(publishPostUrl(postIdentifier), {
        headers: { "cms-write-token": writeToken },
        method: "POST",
      }),
    ),
  readDraftEntryContext = (
    system: ExampleSystem,
  ): Promise<
    DraftEntryContext & {
      readonly publicAssetIdentifier: string | undefined;
      readonly writeToken: string;
    }
  > => {
    const draftIdentifier = requireDraftPostId(system),
      entryUrl = managementEntryUrl("post", draftIdentifier),
      { handler } = system;
    return readInitialDraftState(handler, draftIdentifier).then(({ entryValues, writeToken }) =>
      readPublicExport(handler).then((publicAssetIdentifier) => ({
        draftIdentifier,
        entryUrl,
        entryValues,
        handler,
        publicAssetIdentifier,
        writeToken,
      })),
    );
  },
  readInitialDraftState = (
    handler: PublicationValidationHandler,
    draftIdentifier: string,
  ): Promise<{
    readonly entryValues: Readonly<Record<string, unknown>>;
    readonly writeToken: string;
  }> => {
    const stateUrl = managementStateUrl("post", draftIdentifier);
    return handler(new Request(stateUrl))
      .then(jsonRecord)
      .then((state) => ({
        entryValues: readEntryValues(state),
        writeToken: requireWriteToken(state),
      }));
  },
  readPublicExport = (handler: PublicationValidationHandler): Promise<string | undefined> =>
    handler(new Request(exportUrl)).then(jsonRecord).then(readFirstAssetId),
  readPublicationFailure = (
    handler: PublicationValidationHandler,
    postIdentifier: string,
    writeToken: string,
  ): Promise<{
    readonly failure: Readonly<Record<string, unknown>>;
    readonly response: Response;
  }> =>
    publishEntry(handler, postIdentifier, writeToken).then((response) =>
      jsonRecord(response).then((failure) => ({ failure, response })),
    ),
  saveEntryValues = (
    context: DraftEntryContext,
    values: Readonly<Record<string, unknown>>,
    writeToken: string,
  ): Promise<string> =>
    context
      .handler(
        new Request(context.entryUrl, {
          body: JSON.stringify({ values }),
          headers: {
            "cms-write-token": writeToken,
            "content-type": "application/json",
          },
          method: "PUT",
        }),
      )
      .then(jsonRecord)
      .then(requireWriteToken),
  saveInvalidReferenceEntry = (
    context: ReferencePublicationContext,
    targetEntryIdentifier: string,
  ): Promise<string> =>
    saveEntryValues(
      context,
      {
        ...context.entryValues,
        body: buildInvalidReferenceBody(targetEntryIdentifier),
        "featured-alternative-text": "Meaningful alternative text",
        "featured-asset": context.publicAssetIdentifier,
      },
      context.invalidImageWriteToken,
    ),
  saveInvalidReferenceEntryFromContext = (context: ReferencePublicationContext): Promise<string> =>
    createPrivateReferenceTarget(context).then((targetEntryIdentifier) =>
      saveInvalidReferenceEntry(context, targetEntryIdentifier),
    ),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyFieldPathIssuesForPublication = async (system: ExampleSystem): Promise<void> => {
    const draftContext = await readDraftEntryContext(system),
      { publicAssetIdentifier, writeToken, ...draftEntryContext } = draftContext,
      invalidImageWriteToken = await verifyInvalidImagePublication({
        ...draftEntryContext,
        publicAssetIdentifier,
        writeToken,
      });
    await verifyInvalidReferencePublication({
      ...draftEntryContext,
      invalidImageWriteToken,
      publicAssetIdentifier,
    });
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyInvalidImagePublication = async (context: ImagePublicationContext): Promise<string> => {
    const invalidImageWriteToken = await saveEntryValues(
      context,
      {
        ...context.entryValues,
        "featured-alternative-text": "   ",
        "featured-asset": context.publicAssetIdentifier,
      },
      context.writeToken,
    );
    await assertRejectedPublication({
      expectedPath: ["featured-alternative-text"],
      expectedReason: "missingAlternativeText",
      handler: context.handler,
      postIdentifier: context.draftIdentifier,
      writeToken: invalidImageWriteToken,
    });
    return invalidImageWriteToken;
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyInvalidReferencePublication = async (
    context: ReferencePublicationContext,
  ): Promise<void> => {
    const invalidReferenceWriteToken = await saveInvalidReferenceEntryFromContext(context);
    await assertRejectedPublication({
      expectedPath: ["body", "children", firstItemIndex, "children", firstItemIndex, "entryId"],
      expectedReason: "referenceNotPublic",
      handler: context.handler,
      postIdentifier: context.draftIdentifier,
      writeToken: invalidReferenceWriteToken,
    });
  };

export {
  createPublicationValidationFixture,
  disposePublicationValidationFixture,
  verifyFieldPathIssuesForPublication,
};
