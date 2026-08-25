import { type ExampleSystem, createExampleSystem } from "../../src/system.ts";
import {
  type PublicVisibilityHandler,
  authorIndex,
  createdEntryStatus,
  exportUrl,
  formatPublishedAt,
  jsonRecord,
  loopIncrement,
  managementEntriesUrl,
  notFoundStatus,
  postsToCreate,
  readRecordArray,
  readStringField,
  requireDraftPostId,
  requireEntryIdentifier,
  richTextVersion,
} from "./public-visibility-support.ts";
import { expect } from "bun:test";

export interface PublicVisibilityFixture {
  readonly dispose: () => Promise<void>;
  readonly storageRoot: string;
  readonly system: ExampleSystem;
}

const buildPostRequest = (authorIdentifier: string, postNumber: number): Request =>
    new Request(managementEntriesUrl("post"), {
      body: JSON.stringify({
        values: {
          author: authorIdentifier,
          body: {
            children: [
              {
                children: [{ text: `Complete export ${postNumber}`, type: "text" }],
                type: "paragraph",
              },
            ],
            format: "nearly-headless-cms/rich-text",
            version: richTextVersion,
          },
          categories: [],
          excerpt: `Complete export fixture ${postNumber}`,
          "featured-alternative-text": null,
          "featured-asset": null,
          "published-at": formatPublishedAt(postNumber),
          slug: `complete-export-${postNumber}`,
          status: "published",
          tags: [],
          title: `Complete export ${postNumber}`,
        },
      }),
      headers: { "content-type": "application/json" },
      method: "POST",
    }),
  createManyPublishedPosts = (
    handler: PublicVisibilityHandler,
    authorIdentifier: string,
    postNumber: number,
  ): Promise<void> => {
    if (postNumber >= postsToCreate) {
      return Promise.resolve();
    }
    return handler(buildPostRequest(authorIdentifier, postNumber)).then((response) => {
      expect(response.status).toBe(createdEntryStatus);
      return createManyPublishedPosts(handler, authorIdentifier, postNumber + loopIncrement);
    });
  },
  createPrivateCategory = (
    handler: PublicVisibilityHandler,
  ): Promise<{
    readonly categoryIdentifier: string;
    readonly response: Response;
  }> =>
    handler(
      new Request(managementEntriesUrl("category"), {
        body: JSON.stringify({
          values: {
            description: "Not attached to any published Post.",
            name: "Private taxonomy",
            slug: "private-taxonomy",
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    ).then((response) =>
      jsonRecord(response).then((category) => ({
        categoryIdentifier: requireEntryIdentifier(category),
        response,
      })),
    ),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- fixture setup intentionally awaits native filesystem and CMS startup.
  createPublicVisibilityFixture = async (
    testDirectory: string,
  ): Promise<PublicVisibilityFixture> => {
    const storageRoot = await createTemporaryStorageRoot(testDirectory),
      system = await createExampleSystem({ seed: true, storageRoot });
    return {
      // Bun lifecycle hooks require a Promise-returning dispose callback.
      // oxlint-disable-next-line effecttsgo/async-function -- fixture teardown awaits native filesystem cleanup.
      dispose: async () => {
        await system.dispose();
        await Bun.$`rm -rf ${storageRoot}`;
      },
      storageRoot,
      system,
    };
  },
  createTemporaryStorageRoot = (testDirectory: string): Promise<string> =>
    Bun.$`mktemp -d ${testDirectory}/.public-visibility-XXXXXX`
      .text()
      .then((output) => output.trim()),
  disposePublicVisibilityFixture = (fixture: PublicVisibilityFixture): Promise<void> =>
    fixture.dispose(),
  readCompleteExportPosts = (
    handler: PublicVisibilityHandler,
    authorIdentifier: string,
  ): Promise<readonly Readonly<Record<string, unknown>>[]> =>
    createManyPublishedPosts(handler, authorIdentifier, 0).then(() =>
      readExport(handler).then((completeExport) => readRecordArray(completeExport, "posts")),
    ),
  readExport = (handler: PublicVisibilityHandler): Promise<Readonly<Record<string, unknown>>> =>
    Promise.resolve(handler(new Request(exportUrl))).then(jsonRecord),
  readExportCollections = (
    handler: PublicVisibilityHandler,
  ): Promise<{
    readonly categories: readonly Readonly<Record<string, unknown>>[];
    readonly comments: readonly Readonly<Record<string, unknown>>[];
  }> =>
    readExport(handler).then((exported) => ({
      categories: readRecordArray(exported, "categories"),
      comments: readRecordArray(exported, "comments"),
    })),
  readFirstAuthorId = (exported: Readonly<Record<string, unknown>>): string => {
    const authors = readRecordArray(exported, "authors");
    if (authors[authorIndex] === undefined) {
      throw new TypeError("Expected at least one exported Author");
    }
    return readStringField(authors[authorIndex], "id");
  },
  readHiddenReachabilityEntries = (
    system: ExampleSystem,
  ): Promise<{
    readonly commentResponse: Response;
    readonly draftPostId: string;
    readonly handler: PublicVisibilityHandler;
    readonly privateCategory: {
      readonly categoryIdentifier: string;
      readonly response: Response;
    };
  }> => {
    const draftPostId = requireDraftPostId(system),
      { handler } = system;
    return createPrivateCategory(handler).then((privateCategory) =>
      submitDraftComment(handler, draftPostId).then((commentResponse) => ({
        commentResponse,
        draftPostId,
        handler,
        privateCategory,
      })),
    );
  },
  readInitialExportState = (
    handler: PublicVisibilityHandler,
  ): Promise<{
    readonly authorIdentifier: string;
    readonly initialPosts: readonly Readonly<Record<string, unknown>>[];
  }> =>
    readExport(handler).then((initialExport) => ({
      authorIdentifier: readFirstAuthorId(initialExport),
      initialPosts: readRecordArray(initialExport, "posts"),
    })),
  submitDraftComment = (handler: PublicVisibilityHandler, draftPostId: string): Promise<Response> =>
    handler(
      new Request(managementEntriesUrl("comment"), {
        body: JSON.stringify({
          values: {
            body: "Approved, but attached to a draft.",
            "created-at": "2026-08-23T15:30:00.000Z",
            "display-name": "Hidden reader",
            post: draftPostId,
            status: "approved",
            "website-url": null,
          },
        }),
        headers: { "content-type": "application/json" },
        method: "POST",
      }),
    ),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyCompleteExportPagination = async (handler: PublicVisibilityHandler): Promise<void> => {
    const { authorIdentifier, initialPosts } = await readInitialExportState(handler),
      completePosts = await readCompleteExportPosts(handler, authorIdentifier);
    expect(completePosts).toHaveLength(initialPosts.length + postsToCreate);
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyExportExcludesPrivateEntries = async (
    handler: PublicVisibilityHandler,
    categoryIdentifier: string,
    draftPostId: string,
  ): Promise<void> => {
    const { categories, comments } = await readExportCollections(handler);
    expect(
      categories.some((candidate) => readStringField(candidate, "id") === categoryIdentifier),
    ).toBeFalse();
    expect(
      comments.some((candidate) => readStringField(candidate, "post") === draftPostId),
    ).toBeFalse();
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyHiddenUnpublishedReachability = async (system: ExampleSystem): Promise<void> => {
    const { commentResponse, draftPostId, handler, privateCategory } =
      await readHiddenReachabilityEntries(system);
    expect(privateCategory.response.status).toBe(createdEntryStatus);
    expect(commentResponse.status).toBe(createdEntryStatus);
    await verifyUnpublishedEndpointsHidden(
      handler,
      privateCategory.categoryIdentifier,
      draftPostId,
    );
    await verifyExportExcludesPrivateEntries(
      handler,
      privateCategory.categoryIdentifier,
      draftPostId,
    );
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyUnpublishedEndpointsHidden = async (
    handler: PublicVisibilityHandler,
    categoryIdentifier: string,
    draftPostId: string,
  ): Promise<void> => {
    const draftComments = await handler(
        new Request(`http://cms.test/api/v1/headless/posts/${draftPostId}/comments`),
      ),
      privateReference = await handler(
        new Request(`http://cms.test/api/v1/headless/references/entries/${categoryIdentifier}`),
      ),
      privateTaxonomy = await handler(
        new Request("http://cms.test/api/v1/headless/categories/private-taxonomy"),
      );
    expect(draftComments.status).toBe(notFoundStatus);
    expect(privateReference.status).toBe(notFoundStatus);
    expect(privateTaxonomy.status).toBe(notFoundStatus);
  };

export {
  createPublicVisibilityFixture,
  disposePublicVisibilityFixture,
  verifyCompleteExportPagination,
  verifyHiddenUnpublishedReachability,
};
