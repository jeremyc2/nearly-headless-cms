import { describe, test } from "./http-socket-integration-scenarios-imports.ts";
import { verifyClientDisconnectReleasesLiveSocket } from "./http-socket-integration-disconnect-scenarios.ts";
import { verifyDiscoveryShutdown } from "./http-socket-integration-scenarios.ts";
import { verifyForcedShutdownAfterDrainTimeout } from "./http-socket-integration-forced-shutdown-scenarios.ts";
import { verifyMultipartUploadOverLiveSocket } from "./http-socket-integration-multipart-scenarios.ts";
import { verifyPayloadTooLargeOverLiveSocket } from "./http-socket-integration-body-limit-scenarios.ts";
import { verifyRequestTimeoutOverLiveSocket } from "./http-socket-integration-timeout-scenarios.ts";
import { verifyShutdownRejectsNewRequests } from "./http-socket-integration-shutdown-scenarios.ts";
import { verifySlowConsumerBackpressureOverLiveSocket } from "./http-socket-integration-backpressure-scenarios.ts";
import { verifySlowProducerBackpressureOverLiveSocket } from "./http-socket-integration-slow-producer-scenarios.ts";

describe("HTTP real-socket integration", () => {
  test("accepts bounded multipart Asset uploads over a live socket", () =>
    verifyMultipartUploadOverLiveSocket());

  test("rejects oversized JSON bodies over a live socket", () =>
    verifyPayloadTooLargeOverLiveSocket());

  test("accepts multipart Asset uploads from a slow producer over a live socket", () =>
    verifySlowProducerBackpressureOverLiveSocket());

  test("streams Asset downloads to a slow consumer over a live socket", () =>
    verifySlowConsumerBackpressureOverLiveSocket());

  test("returns request timeouts over a live socket", () => verifyRequestTimeoutOverLiveSocket());

  test("releases a live socket after the client disconnects an in-flight request", () =>
    verifyClientDisconnectReleasesLiveSocket());

  test("serves discovery over a live socket and releases the listener on shutdown", () =>
    verifyDiscoveryShutdown());

  test("stops accepting new requests during bounded shutdown drain", () =>
    verifyShutdownRejectsNewRequests());

  test("forces interruption when the shutdown drain window expires", () =>
    verifyForcedShutdownAfterDrainTimeout());
});
