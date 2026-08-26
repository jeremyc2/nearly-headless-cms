import {
  type ExampleSystem,
  firstItemIndex,
  httpNotFound,
  httpOk,
  isRecord,
  jsonRecord,
} from "./destructive-workflows-support.ts";
import { expect } from "bun:test";

const assignFeaturedAsset = (
    draftEntry: Readonly<Record<string, unknown>>,
    assetId: string,
  ): Record<string, unknown> => {
    const draftValues = draftEntry["values"];
    if (!isRecord(draftValues)) {
      throw new Error("Expected draft Post values");
    }
    return {
      ...draftValues,
      "featured-alternative-text": "A temporary illustration",
      "featured-asset": assetId,
    };
  },
  makeTemporaryImageForm = (): FormData => {
    const temporaryImageForm = new FormData();
    temporaryImageForm.set(
      "metadata",
      JSON.stringify({
        defaultAlternativeText: "A temporary illustration",
        filename: "temporary.svg",
        height: 20,
        mediaType: "image/svg+xml",
        width: 20,
      }),
    );
    temporaryImageForm.set(
      "content",
      new File(
        [new TextEncoder().encode('<svg xmlns="http://www.w3.org/2000/svg"/>')],
        "temporary.svg",
        { type: "image/svg+xml" },
      ),
    );
    return temporaryImageForm;
  },
  readDraftPostState = (
    system: ExampleSystem,
    draftPostId: string,
  ): Promise<{
    readonly draftEntry: Readonly<Record<string, unknown>>;
    readonly draftWriteToken: string;
  }> => {
    const draftStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${draftPostId}/state`;
    return Promise.resolve(system.handler(new Request(draftStateUrl)))
      .then(jsonRecord)
      .then((draftState) => {
        const draftEntry = draftState["entry"],
          draftWriteToken = draftState["writeToken"];
        if (
          !isRecord(draftEntry) ||
          !isRecord(draftEntry["values"]) ||
          typeof draftWriteToken !== "string"
        ) {
          throw new Error("Expected a draft Post Current Entry State");
        }
        return { draftEntry, draftWriteToken };
      });
  },
  readIngestedAssetId = (system: ExampleSystem): Promise<string> => {
    const ingestionRequest = new Request(
      "http://cms.test/api/v1/management/definition-spaces/example-blog/assets",
      { body: makeTemporaryImageForm(), method: "POST" },
    );
    return Promise.resolve(system.handler(ingestionRequest))
      .then(jsonRecord)
      .then((asset) => {
        const assetId = asset["id"];
        if (typeof assetId !== "string") {
          throw new TypeError("Expected an ingested Asset identifier");
        }
        return assetId;
      });
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- [EH-069] scenario intentionally awaits native HTTP promises.
  verifyAssetAssignmentClearingDeletion = async (system: ExampleSystem): Promise<void> => {
    if (system.seed === undefined) {
      throw new Error("Expected a seeded Example System");
    }
    const aAssetId = await readIngestedAssetId(system),
      bDraftPostId = system.seed.draftPostId,
      cDraftEntryUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${bDraftPostId}`,
      dDraftStateUrl = `http://cms.test/api/v1/management/definition-spaces/example-blog/content-types/post/entries/${bDraftPostId}/state`,
      eDraftPostState = await readDraftPostState(system, bDraftPostId),
      fDraftEntry = eDraftPostState.draftEntry,
      gDraftWriteToken = eDraftPostState.draftWriteToken,
      hAssignmentValues = assignFeaturedAsset(fDraftEntry, aAssetId),
      iAssignmentBody = JSON.stringify({ values: hAssignmentValues }),
      jAssignmentResponse = await system.handler(
        new Request(cDraftEntryUrl, {
          body: iAssignmentBody,
          headers: { "cms-write-token": gDraftWriteToken, "content-type": "application/json" },
          method: "PUT",
        }),
      ),
      kDeletionResponse = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${aAssetId}/assignment-clearing-deletions`,
          { headers: { "idempotency-key": "delete-temporary-image" }, method: "POST" },
        ),
      ),
      lReceipt = await jsonRecord(kDeletionResponse),
      mRepeatedDeletionResponse = await system.handler(
        new Request(
          `http://cms.test/api/v1/management/definition-spaces/example-blog/operations/assets/${aAssetId}/assignment-clearing-deletions`,
          { headers: { "idempotency-key": "delete-temporary-image" }, method: "POST" },
        ),
      );
    expect(jAssignmentResponse.status).toBe(httpOk);
    expect(kDeletionResponse.status).toBe(httpOk);
    expect(lReceipt).toMatchObject({
      clearedAuthorCount: firstItemIndex,
      clearedPostCount: 1,
      deletedAssetId: aAssetId,
      deletionCompleted: true,
    });
    expect(await jsonRecord(mRepeatedDeletionResponse)).toEqual(lReceipt);
    await verifyAssetRemoved(system, aAssetId, dDraftStateUrl);
  },
  verifyAssetRemoved = (
    system: ExampleSystem,
    assetId: string,
    draftStateUrl: string,
  ): Promise<void> =>
    Promise.resolve(system.handler(new Request(draftStateUrl)))
      .then(jsonRecord)
      .then((updatedState) => {
        const updatedEntry = updatedState["entry"];
        if (!isRecord(updatedEntry) || !isRecord(updatedEntry["values"])) {
          throw new Error("Expected an updated draft Post");
        }
        expect(updatedEntry["values"]["featured-asset"]).toBeNull();
        expect(updatedEntry["values"]["featured-alternative-text"]).toBeNull();
        return system.handler(
          new Request(
            `http://cms.test/api/v1/management/definition-spaces/example-blog/assets/${assetId}`,
          ),
        );
      })
      .then((assetLookupResponse) => {
        expect(assetLookupResponse.status).toBe(httpNotFound);
      });

export { verifyAssetAssignmentClearingDeletion };
