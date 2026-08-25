import {
  isRecord,
  noContentStatus,
  payloadByteOne,
  successStatus,
} from "./http-contract-support.ts";
import { DevelopmentCms } from "../../src/testing/index.ts";
import { Effect } from "effect";
import { HttpTransport } from "../../src/http/index.ts";
import { deletionSnapshot } from "./http-contract-deletion-support.ts";
import { expect } from "bun:test";

type DeletionHandler = <RequestType extends Request>(
  request: Readonly<RequestType>,
) => Response | Promise<Response>;

const makeDeletionHandler = (): Promise<DeletionHandler> => {
    const handlerEffect = HttpTransport.makeHandler({}).pipe(
      // oxlint-disable-next-line effecttsgo/strict-effect-provide -- test entry point needs a fresh isolated layer.
      Effect.provide(DevelopmentCms.layer({ snapshot: deletionSnapshot })),
    );
    return Effect.runPromise(handlerEffect);
  },
  // The helper awaits the native Response body before returning its validated payload.
  // oxlint-disable-next-line effecttsgo/async-function -- helper intentionally awaits a native HTTP promise.
  readCreatedEntry = async (
    handler: DeletionHandler,
    contentTypeId: string,
  ): Promise<Readonly<Record<string, unknown>>> => {
    const requestCreationEntry = new Request(
        `http://cms.test/api/v1/management/definition-spaces/delete-contract/content-types/${contentTypeId}/entries`,
        {
          body: JSON.stringify({ values: { title: "Delete me" } }),
          headers: { "content-type": "application/json" },
          method: "POST",
        },
      ),
      responseCreationEntry: Response = await Promise.resolve(handler(requestCreationEntry)),
      resultCreationEntry: unknown = await responseCreationEntry.json();
    if (!isRecord(resultCreationEntry)) {
      throw new Error("Expected an Entry creation object");
    }
    return resultCreationEntry;
  },
  // The helper awaits the native Response body before returning validated historical deletion inputs.
  // oxlint-disable-next-line effecttsgo/async-function -- helper intentionally awaits a native HTTP promise.
  readHistoricalDeletionContext = async (
    handler: DeletionHandler,
  ): Promise<{ readonly entryId: string; readonly writeToken: string }> => {
    const creationHistoricalEntry = await readCreatedEntry(handler, "historical-note"),
      entryHistoricalRecord = creationHistoricalEntry["entry"],
      writeTokenHistorical = creationHistoricalEntry["writeToken"];
    if (
      !isRecord(entryHistoricalRecord) ||
      typeof entryHistoricalRecord["id"] !== "string" ||
      typeof writeTokenHistorical !== "string"
    ) {
      throw new Error("Expected history state from Entry creation");
    }
    return { entryId: entryHistoricalRecord["id"], writeToken: writeTokenHistorical };
  },
  // The helper awaits the native Response body before returning validated temporary deletion inputs.
  // oxlint-disable-next-line effecttsgo/async-function -- helper intentionally awaits a native HTTP promise.
  readTemporaryDeletionContext = async (
    handler: DeletionHandler,
  ): Promise<{ readonly entryId: string }> => {
    const creationTemporaryEntry = await readCreatedEntry(handler, "temporary-note"),
      entryTemporaryIdentifier = creationTemporaryEntry["id"];
    if (typeof entryTemporaryIdentifier !== "string") {
      throw new TypeError("Expected ordinary Entry from creation");
    }
    return { entryId: entryTemporaryIdentifier };
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  runDeletionContract = async (): Promise<void> => {
    const handler = await makeDeletionHandler();
    await verifyHistoricalDeletion(handler);
    await verifyTemporaryDeletion(handler);
  },
  verifyDeletionReceipt = (): Promise<void> => runDeletionContract(),
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyHistoricalDeletion = async (handler: DeletionHandler): Promise<void> => {
    const contextHistoricalDeletion = await readHistoricalDeletionContext(handler),
      deletionRequest = new Request(
        `http://cms.test/api/v1/management/definition-spaces/delete-contract/content-types/historical-note/entries/${contextHistoricalDeletion.entryId}`,
        {
          headers: { "cms-write-token": contextHistoricalDeletion.writeToken },
          method: "DELETE",
        },
      ),
      responseHistoricalDeletion = await handler(deletionRequest),
      resultHistoricalDeletionBody: unknown = await responseHistoricalDeletion.json();
    expect(responseHistoricalDeletion.status).toBe(successStatus);
    expect(resultHistoricalDeletionBody).toMatchObject({
      contentTypeId: "historical-note",
      entryId: contextHistoricalDeletion.entryId,
      latestRevisionNumber: payloadByteOne,
    });
  },
  // Bun's test runner requires an async callback for the native Request and Response promises.
  // oxlint-disable-next-line effecttsgo/async-function -- HTTP contract assertions intentionally await native promises.
  verifyTemporaryDeletion = async (handler: DeletionHandler): Promise<void> => {
    const contextTemporaryDeletion = await readTemporaryDeletionContext(handler),
      requestTemporaryDeletion = new Request(
        `http://cms.test/api/v1/management/definition-spaces/delete-contract/content-types/temporary-note/entries/${contextTemporaryDeletion.entryId}`,
        { method: "DELETE" },
      ),
      responseTemporaryDeletion = await handler(requestTemporaryDeletion);
    expect(responseTemporaryDeletion.status).toBe(noContentStatus);
    expect(await responseTemporaryDeletion.text()).toBe("");
  };

export { verifyDeletionReceipt };
