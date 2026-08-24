import { generateClientSource } from "./openapi-client-generator/source.ts";
import { parseOpenApiDocument } from "./openapi-client-generator/operations.ts";

const generatorFormatVersion = 3,
  zGenerateOpenApiClient = (documentValue: unknown): string => {
    const parsedDocument = parseOpenApiDocument(documentValue);
    return generateClientSource({
      ...parsedDocument,
      formatVersion: generatorFormatVersion,
    });
  };

export { generatorFormatVersion, zGenerateOpenApiClient as generateOpenApiClient };
