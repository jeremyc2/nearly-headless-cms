import { Effect, Predicate, Stream } from "effect";
import { HttpServerRequest, Multipart } from "effect/unstable/http";
import { InfrastructureFailure, InvalidInput } from "../cms-error.ts";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.
import { mkdtemp, open, rm } from "node:fs/promises";
import type { IngestInput } from "../asset.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.
import { join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.
import { tmpdir } from "node:os";
import transportResponse from "./http-transport-response.ts";

interface MultipartAssetLimits {
  readonly body: number;
  readonly file: number;
  readonly metadata: number;
}

interface MultipartAssetState {
  contentMediaType: string | undefined;
  contentSeen: boolean;
  metadata: Omit<IngestInput, "content"> | undefined;
}

interface StagedAssetUpload {
  readonly cleanup: () => Promise<void>;
  readonly content: Stream.Stream<Uint8Array, InfrastructureFailure>;
  readonly metadata: Omit<IngestInput, "content">;
}

interface StageMultipartAssetInput {
  readonly limits: MultipartAssetLimits;
  readonly parseAssetMetadata: (text: string) => Omit<IngestInput, "content">;
  readonly request: Request;
  readonly signal: AbortSignal;
}

interface BuildMultipartAssetStreamInput {
  readonly contentPath: string;
  readonly limits: MultipartAssetLimits;
  readonly parseAssetMetadata: (text: string) => Omit<IngestInput, "content">;
  readonly request: Request;
  readonly state: MultipartAssetState;
}

interface FinalizeStagedAssetUploadInput {
  readonly contentMediaType: string | undefined;
  readonly contentPath: string;
  readonly contentSeen: boolean;
  readonly directory: string;
  readonly metadata: Omit<IngestInput, "content"> | undefined;
}

interface HandleMultipartAssetPartInput {
  readonly contentPath: string;
  readonly maximumFileByteLength: number;
  readonly parseAssetMetadata: (text: string) => Omit<IngestInput, "content">;
  readonly part: Multipart.Part;
  readonly state: MultipartAssetState;
}

const { encodeChunk } = transportResponse,
  buildMultipartAssetStream = ({
    contentPath,
    limits,
    parseAssetMetadata,
    request,
    state,
  }: BuildMultipartAssetStreamInput): Effect.Effect<void, InvalidInput | RequestFailureError> =>
    Stream.runForEach(HttpServerRequest.fromWeb(request).multipartStream, (part) =>
      handleMultipartAssetPart({
        contentPath,
        maximumFileByteLength: limits.file,
        parseAssetMetadata,
        part,
        state,
      }),
    ).pipe(
      Effect.provide(
        Multipart.limitsServices({
          fieldMimeTypes: ["application/json", "text/plain"],
          maxFieldSize: limits.metadata,
          maxParts: 3,
          maxTotalSize: limits.body,
        }),
      ),
      Effect.mapError(mapMultipartFailure),
    ),
  finalizeStagedAssetUpload = ({
    contentMediaType,
    contentPath,
    contentSeen,
    directory,
    metadata,
  }: FinalizeStagedAssetUploadInput): StagedAssetUpload => {
    if (metadata === undefined || !contentSeen) {
      throw InvalidInput.make({
        message: "Asset upload requires exactly metadata and content parts",
      });
    }
    if (contentMediaType !== metadata.mediaType) {
      throw InvalidInput.make({
        message: "Asset metadata mediaType must match the content part media type",
      });
    }
    return {
      cleanup: () => rm(directory, { force: true, recursive: true }),
      content: stagedContent(contentPath),
      metadata,
    };
  },
  handleMultipartAssetPart = ({
    contentPath,
    maximumFileByteLength,
    parseAssetMetadata,
    part,
    state,
  }: HandleMultipartAssetPartInput): Effect.Effect<void, InvalidInput | RequestFailureError> => {
    if (Multipart.isField(part)) {
      if (part.key !== "metadata" || state.metadata !== undefined) {
        return Effect.fail(
          InvalidInput.make({
            message: "Asset upload requires exactly one metadata field",
          }),
        );
      }
      return Effect.sync(() => {
        state.metadata = parseAssetMetadata(part.value);
      });
    }
    if (part.key !== "content" || state.contentSeen) {
      return Effect.fail(
        InvalidInput.make({ message: "Asset upload requires exactly one content file" }),
      );
    }
    state.contentSeen = true;
    state.contentMediaType = part.contentType;
    return stageFilePart(part, contentPath, maximumFileByteLength);
  },
  mapMultipartFailure = (
    error: InvalidInput | Multipart.MultipartError | RequestFailureError,
  ): InvalidInput | RequestFailureError => {
    if (error instanceof Multipart.MultipartError) {
      return multipartFailure(error);
    }
    return error;
  },
  multipartFailure = (error: Multipart.MultipartError): RequestFailureError | InvalidInput => {
    if (
      Predicate.isTagged(error.reason, "BodyTooLarge") ||
      Predicate.isTagged(error.reason, "FieldTooLarge") ||
      Predicate.isTagged(error.reason, "FileTooLarge") ||
      Predicate.isTagged(error.reason, "TooManyParts")
    ) {
      return new RequestFailureError(
        "PayloadTooLarge",
        "Multipart request exceeds the configured limit",
        413,
      );
    }
    if (Predicate.isTagged(error.reason, "InternalError")) {
      return new RequestFailureError("InternalError", "Multipart request processing failed", 500);
    }
    return InvalidInput.make({ message: "Malformed multipart Asset upload" });
  },
  stageFilePart = (
    part: Multipart.File,
    path: string,
    maximumByteLength: number,
  ): Effect.Effect<void, InvalidInput | RequestFailureError> => {
    let byteLength = 0;
    return Effect.acquireUseRelease(
      Effect.tryPromise({
        catch: () => new RequestFailureError("InternalError", "Upload staging failed", 500),
        try: () => open(path, "wx"),
      }),
      (handle) =>
        Stream.runForEach(part.content, (chunk) => {
          byteLength += chunk.byteLength;
          if (byteLength > maximumByteLength) {
            return Effect.fail(
              new RequestFailureError(
                "PayloadTooLarge",
                "Multipart request exceeds the configured limit",
                413,
              ),
            );
          }
          return Effect.tryPromise({
            catch: () => new RequestFailureError("InternalError", "Upload staging failed", 500),
            // oxlint-disable-next-line effecttsgo/async-function -- FileHandle.write is Promise-based and must remain ordered.
            try: async () => {
              let offset = 0;
              while (offset < chunk.byteLength) {
                // File writes must remain sequential so each offset follows the prior write.
                // oxlint-disable-next-line no-await-in-loop -- preserve ordered chunk writes.
                const result = await handle.write(chunk, offset, chunk.byteLength - offset, null);
                if (result.bytesWritten === 0) {
                  throw new Error("Upload staging write made no progress");
                }
                offset += result.bytesWritten;
              }
            },
          });
        }).pipe(Effect.mapError(mapMultipartFailure)),
      (handle) => Effect.promise(() => handle.close().catch(() => {})),
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- multipart parsing is Promise-based and this helper is not a pipeable Effect API.
  stageMultipartAsset = async ({
    limits,
    parseAssetMetadata,
    request,
    signal,
  }: StageMultipartAssetInput): Promise<StagedAssetUpload> => {
    const directory = await mkdtemp(join(tmpdir(), "nearly-headless-cms-upload-")),
      uploadContentPath = join(directory, "content");
    try {
      const holder = {
          state: {
            contentMediaType: undefined,
            contentSeen: false,
            metadata: undefined,
          } satisfies MultipartAssetState,
        },
        parse = buildMultipartAssetStream({
          contentPath: uploadContentPath,
          limits,
          parseAssetMetadata,
          request,
          state: holder.state,
        });
      await Effect.runPromise(parse, { signal });
      return finalizeStagedAssetUpload({
        contentMediaType: holder.state.contentMediaType,
        contentPath: uploadContentPath,
        contentSeen: holder.state.contentSeen,
        directory,
        metadata: holder.state.metadata,
      });
    } catch (error) {
      await rm(directory, { force: true, recursive: true }).catch(() => {});
      throw error;
    }
  },
  stagedContent = (path: string): Stream.Stream<Uint8Array, InfrastructureFailure> =>
    Stream.fromAsyncIterable(Bun.file(path).stream(), (cause) =>
      InfrastructureFailure.make({
        cause,
        message: "Staged multipart Asset read failed",
        retryable: false,
      }),
    ).pipe(Stream.map((chunk) => encodeChunk(chunk)));

export default {
  stageMultipartAsset,
};

export type { MultipartAssetLimits, StagedAssetUpload };
