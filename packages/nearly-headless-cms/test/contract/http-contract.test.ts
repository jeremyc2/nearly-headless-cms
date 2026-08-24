import { describe, test } from "bun:test";
import {
  verifyDeletionReceipt,
  verifyMultipartAssetUpload,
  verifyOpenApiSchemas,
  verifyPortableHttpApiRoutes,
  verifyTransportLimits,
  verifyVersionedManagementOperations,
} from "./http-contract-scenarios.ts";

describe("HTTP contract", () => {
  test("streams bounded multipart Asset uploads and rejects unexpected metadata", () =>
    verifyMultipartAssetUpload());

  test("returns a deletion receipt only for history-enabled Entries", () => verifyDeletionReceipt());

  test("serves versioned Management operations while keeping Headless CRUD absent", () =>
    verifyVersionedManagementOperations());

  test("mounts each declared operation through the portable Effect HttpApi route Layer", () =>
    verifyPortableHttpApiRoutes());

  test("maps transport limits, media, and methods to their stable HTTP failures", () =>
    verifyTransportLimits());

  test("derives stable OpenAPI request, success, parameter, and declared error schemas", () =>{ 
    verifyOpenApiSchemas(); });
});
