import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  describe,
  expect,
  notModifiedStatus,
  partialContentStatus,
  payloadByteFive,
  payloadByteFour,
  payloadByteOne,
  payloadByteThree,
  payloadByteTwo,
  snapshot,
  successStatus,
  test,
} from "./asset-http-delivery-scenarios-imports.ts";

const assetUrl = "http://cms.test/api/v1/management/definition-spaces/example-blog/assets",
  // oxlint-disable-next-line eslint/sort-vars -- [EH-133] handler effect is declared before the form factory it configures.
  assetHandlerEffect = HttpTransport.makeHandler({
    maximumMultipartFileByteLength: payloadByteFive,
    maximumMultipartMetadataByteLength: 256,
  }).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-112] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  makeAcceptedForm = (): FormData => {
    const form = new FormData();
    form.set(
      "metadata",
      JSON.stringify({
        filename: "pixel.bin",
        mediaType: "application/octet-stream",
      }),
    );
    form.set(
      "content",
      new File(
        [new Uint8Array([payloadByteOne, payloadByteTwo, payloadByteThree, payloadByteFour, payloadByteFive])],
        "pixel.bin",
        { type: "application/octet-stream" },
      ),
    );
    return form;
  },
  // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] HttpTransport handler mirrors the Web Request callback contract.
  makeHandler = (): Promise<(request: Request) => Response | Promise<Response>> =>
    Effect.runPromise(assetHandlerEffect),
  rangeNotSatisfiableStatus = 416,
  requestAssetContent = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    handler: (request: Request) => Response | Promise<Response>,
    contentUrl: string,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] RequestInit is passed directly into the Web Request constructor.
    requestInit?: RequestInit,
  ): Promise<Response> =>
    Promise.resolve(handler(new Request(contentUrl, requestInit))),
  uploadAssetIdentifier = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    handler: (request: Request) => Response | Promise<Response>,
  ): Promise<string> => {
    const uploadRequest = new Request(assetUrl, { body: makeAcceptedForm(), method: "POST" });
    return Promise.resolve(handler(uploadRequest))
      .then((uploadResponse) => uploadResponse.json())
      .then((uploadBody: unknown) => {
        if (
          uploadBody === null ||
          typeof uploadBody !== "object" ||
          !("id" in uploadBody) ||
          typeof uploadBody["id"] !== "string"
        ) {
          throw new TypeError("Expected uploaded Asset identifier");
        }
        return uploadBody["id"];
      });
  },
  verifyFullAssetResponse = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    handler: (request: Request) => Response | Promise<Response>,
    contentUrl: string,
  ): Promise<string> =>
    requestAssetContent(handler, contentUrl).then((fullResponse) => {
      const etag = fullResponse.headers.get("etag");
      expect(fullResponse.status).toBe(successStatus);
      return fullResponse.arrayBuffer().then((body) => {
        expect(new Uint8Array(body)).toEqual(
          new Uint8Array([
            payloadByteOne,
            payloadByteTwo,
            payloadByteThree,
            payloadByteFour,
            payloadByteFive,
          ]),
        );
        if (etag === null) {
          throw new TypeError("Expected Asset ETag");
        }
        return etag;
      });
    }),
  // oxlint-disable-next-line eslint/sort-vars -- [EH-133] response verifiers follow the HTTP scenario narrative order.
  verifyConditionalAndRangeResponses = (
    contentUrl: string,
    etag: string,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-173] Effect programs are executed by runPromise without mutation.
    handler: (request: Request) => Response | Promise<Response>,
  ): Promise<void> =>
    requestAssetContent(handler, contentUrl, {
      headers: { "if-none-match": `"unrelated", W/${etag}` },
    })
      .then((conditionalResponse) => {
        expect(conditionalResponse.status).toBe(notModifiedStatus);
        return requestAssetContent(handler, contentUrl, { method: "HEAD" });
      })
      .then((headResponse) => {
        expect(headResponse.status).toBe(successStatus);
        expect(headResponse.headers.get("content-length")).toBe(String(payloadByteFive));
        return headResponse.arrayBuffer();
      })
      .then((headBody) => {
        expect(headBody.byteLength).toBe(0);
        return requestAssetContent(handler, contentUrl, { headers: { range: "bytes=1-3" } });
      })
      .then((rangeResponse) => {
        expect(rangeResponse.status).toBe(partialContentStatus);
        expect(rangeResponse.headers.get("content-range")).toBe("bytes 1-3/5");
        return requestAssetContent(handler, contentUrl, { headers: { range: "bytes=100-200" } });
      })
      .then((unsatisfiableResponse) => {
        expect(unsatisfiableResponse.status).toBe(rangeNotSatisfiableStatus);
        expect(unsatisfiableResponse.headers.get("content-range")).toBe("bytes */5");
      });

describe("Asset HTTP delivery integration", () => {
  test("streams full, ranged, conditional, and unsatisfiable Asset responses", () =>
    makeHandler().then((handler) =>
      uploadAssetIdentifier(handler).then((assetIdentifier) => {
        const contentUrl = `${assetUrl}/${assetIdentifier}/content`;
        return verifyFullAssetResponse(handler, contentUrl).then((resolvedEtag) =>
          verifyConditionalAndRangeResponses(contentUrl, resolvedEtag, handler),
        );
      }),
    ));
});
