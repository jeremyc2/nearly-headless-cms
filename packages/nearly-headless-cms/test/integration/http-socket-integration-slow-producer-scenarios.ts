import {
  DevelopmentCms,
  Effect,
  HttpTransport,
  acceptedStatus,
  expect,
  payloadByteFive,
  payloadByteFour,
  payloadByteOne,
  payloadByteThree,
  payloadByteTwo,
  snapshot,
  startBunHttpTransport,
} from "./http-socket-integration-slow-producer-scenarios-imports.ts";

const assetHandlerEffect = HttpTransport.makeHandler({
    maximumMultipartFileByteLength: payloadByteFive,
    maximumMultipartMetadataByteLength: 256,
  }).pipe(
    // oxlint-disable-next-line effecttsgo/strict-effect-provide -- [EH-162] test entry point needs a fresh isolated layer.
    Effect.provide(DevelopmentCms.layer({ snapshot })),
  ),
  assetUploadBytes = [
    payloadByteOne,
    payloadByteTwo,
    payloadByteThree,
    payloadByteFour,
    payloadByteFive,
  ] as const,
  assetUploadPath = "api/v1/management/definition-spaces/example-blog/assets",
  multipartBoundary = "nhcmsSlowProducerBoundary",
  multipartFooterBytes = new TextEncoder().encode(`\r\n--${multipartBoundary}--\r\n`),
  multipartHeaderBytes = new TextEncoder().encode(
    `--${multipartBoundary}\r\nContent-Disposition: form-data; name="metadata"\r\n\r\n{"filename":"pixel.bin","mediaType":"application/octet-stream"}\r\n--${multipartBoundary}\r\nContent-Disposition: form-data; name="content"; filename="pixel.bin"\r\nContent-Type: application/octet-stream\r\n\r\n`,
  ),
  makeSlowProducerUploadBody = (): ReadableStream<Uint8Array> => {
    const multipartChunks = [
      multipartHeaderBytes,
      ...assetUploadBytes.map((assetByte) => new Uint8Array([assetByte])),
      multipartFooterBytes,
    ];
    return new ReadableStream<Uint8Array>({
      start(controller) {
        const enqueueNextChunk = (chunkIndex: number): void => {
          const multipartChunk = multipartChunks.at(chunkIndex);
          if (multipartChunk === undefined) {
            controller.close();
            return;
          }
          void Bun.sleep(slowProducerDelayMilliseconds).then(() => {
            controller.enqueue(multipartChunk);
            enqueueNextChunk(chunkIndex + 1);
          });
        };
        enqueueNextChunk(0);
      },
    });
  },
  slowProducerDelayMilliseconds = 5,
  verifySlowProducerBackpressureOverLiveSocket = (): Promise<void> =>
    Effect.runPromise(
      assetHandlerEffect.pipe(Effect.flatMap((handler) => startBunHttpTransport({ handler }))),
    ).then((transport) => {
      const uploadUrl = `${transport.address}${assetUploadPath}`;
      return (
        // oxlint-disable-next-line effecttsgo/global-fetch -- [EH-111] integration test uploads a paced multipart Asset body through the live HTTP listener.
        fetch(uploadUrl, {
          body: makeSlowProducerUploadBody(),
          headers: {
            "content-type": `multipart/form-data; boundary=${multipartBoundary}`,
          },
          method: "POST",
        })
      )
        .then((response) => {
          expect(response.status).toBe(acceptedStatus);
          return Effect.runPromise(transport.close);
        })
        .then(() => {});
    });

export { verifySlowProducerBackpressureOverLiveSocket };
