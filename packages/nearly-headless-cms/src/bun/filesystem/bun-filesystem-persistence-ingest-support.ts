import {
  type Configuration,
  Effect,
  InvalidInput,
  type Management,
  type Metadata,
  emptyLength,
} from "./bun-filesystem-persistence-services-imports.ts";
import filesystemSupport from "./bun-filesystem-persistence-support.ts";

const { defaultMetadataMaximumByteLength, encode } = filesystemSupport,
  buildAssetMetadata = <Input extends Parameters<Management["Service"]["ingest"]>[0]>(
    input: Readonly<Input>,
    committedBlob: { readonly byteLength: number; readonly digest: string },
  ): Metadata => {
    let metadata: Metadata = {
      byteLength: committedBlob.byteLength,
      digest: committedBlob.digest,
      filename: input.filename,
      mediaType: input.mediaType,
    };
    if (input.width !== undefined) {
      metadata = { ...metadata, width: input.width };
    }
    if (input.height !== undefined) {
      metadata = { ...metadata, height: input.height };
    }
    if (input.defaultAlternativeText !== undefined) {
      metadata = { ...metadata, defaultAlternativeText: input.defaultAlternativeText };
    }
    return metadata;
  },
  validateIngestInput = <Input extends Parameters<Management["Service"]["ingest"]>[0]>(
    configuration: Readonly<Configuration>,
    input: Readonly<Input>,
  ): Effect.Effect<void, InvalidInput> => {
    if (input.filename.trim().length === emptyLength || !input.mediaType.includes("/")) {
      return Effect.fail(
        InvalidInput.make({ message: "Asset filename and media type are required" }),
      );
    }
    if (
      encode({
        defaultAlternativeText: input.defaultAlternativeText,
        filename: input.filename,
        height: input.height,
        mediaType: input.mediaType,
        width: input.width,
      }).byteLength > (configuration.maximumMetadataByteLength ?? defaultMetadataMaximumByteLength)
    ) {
      return Effect.fail(
        InvalidInput.make({ message: "Asset metadata exceeds the configured limit" }),
      );
    }
    return Effect.void;
  };

export default { buildAssetMetadata, validateIngestInput };
