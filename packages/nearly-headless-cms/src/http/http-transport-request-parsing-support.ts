import { Effect, Predicate, Stream } from "effect";
import { HttpServerRequest, Multipart } from "effect/unstable/http";
import { InfrastructureFailure, InvalidInput } from "../cms-error.ts";
import {
  type ReadonlyTransportAbortSignal,
  type ReadonlyTransportRequest,
  toAbortSignal,
  toWebRequest,
} from "./http-transport-readonly-types.ts";
import { httpStatusInternalServerError, httpStatusPayloadTooLarge } from "./http-status-codes.ts";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-103] Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.
import { mkdtemp, open, rm } from "node:fs/promises";
import type { IngestInput } from "../asset.ts";
import { RequestFailureError } from "./http-transport-request-failure.ts";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-103] Temporary upload staging requires node fs primitives unavailable in the HTTP FileSystem abstraction.
import { createReadStream } from "node:fs";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-105] Temporary upload staging requires node path primitives unavailable in the HTTP FileSystem abstraction.
import { join } from "node:path";
// oxlint-disable-next-line effecttsgo/node-builtin-import -- [EH-104] Temporary upload staging requires node os primitives unavailable in the HTTP FileSystem abstraction.
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
  readonly request: ReadonlyTransportRequest;
  readonly signal: ReadonlyTransportAbortSignal;
}

interface BuildMultipartAssetStreamInput {
  readonly contentPath: string;
  readonly limits: MultipartAssetLimits;
  readonly parseAssetMetadata: (text: string) => Omit<IngestInput, "content">;
  readonly request: ReadonlyTransportRequest;
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
  part: Multipart.Part;
  readonly state: MultipartAssetState;
}

const { encodeChunk } = transportResponse,
  buildMultipartAssetStream = <Input extends BuildMultipartAssetStreamInput>(
    input: Readonly<Input>,
  ): Effect.Effect<void, InvalidInput | RequestFailureError> => {
    const { contentPath, limits, parseAssetMetadata, request, state } = input;
    return Stream.runForEach(
      HttpServerRequest.fromWeb(toWebRequest(request)).multipartStream,
      (part) =>
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
    );
  },
  finalizeStagedAssetUpload = <Input extends FinalizeStagedAssetUploadInput>(
    input: Readonly<Input>,
  ): StagedAssetUpload => {
    const { contentMediaType, contentPath, contentSeen, directory, metadata } = input;
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
  handleMultipartAssetPart = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-183] multipart state is mutated while parsing asset parts.
    input: Readonly<HandleMultipartAssetPartInput>,
  ): Effect.Effect<void, InvalidInput | RequestFailureError> => {
    const { contentPath, maximumFileByteLength, parseAssetMetadata, part, state } = input;
    if (Multipart.isField(part)) {
      if (part.key !== "metadata" || state.metadata !== undefined) {
        return InvalidInput.make({
          message: "Asset upload requires exactly one metadata field",
        });
      }
      return Effect.sync(() => {
        state.metadata = parseAssetMetadata(part.value);
      });
    }
    if (part.key !== "content" || state.contentSeen) {
      return InvalidInput.make({ message: "Asset upload requires exactly one content file" });
    }
    state.contentSeen = true;
    state.contentMediaType = part.contentType;
    return stageFilePart(part, contentPath, maximumFileByteLength);
  },
  mapMultipartFailure = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-180] multipart errors are inspected via instanceof and Predicate.isTagged without mutation.
    error: InvalidInput | Multipart.MultipartError | RequestFailureError,
  ): InvalidInput | RequestFailureError => {
    if (error instanceof Multipart.MultipartError) {
      return multipartFailure(error);
    }
    return error;
  },
  multipartFailure = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-181] multipart errors are inspected via Predicate.isTagged without mutation.
    error: Multipart.MultipartError,
  ): RequestFailureError | InvalidInput => {
    if (
      Predicate.isTagged(error.reason, "BodyTooLarge") ||
      Predicate.isTagged(error.reason, "FieldTooLarge") ||
      Predicate.isTagged(error.reason, "FileTooLarge") ||
      Predicate.isTagged(error.reason, "TooManyParts")
    ) {
      return new RequestFailureError(
        "PayloadTooLarge",
        "Multipart request exceeds the configured limit",
        httpStatusPayloadTooLarge,
      );
    }
    if (Predicate.isTagged(error.reason, "InternalError")) {
      return new RequestFailureError(
        "InternalError",
        "Multipart request processing failed",
        httpStatusInternalServerError,
      );
    }
    return InvalidInput.make({ message: "Malformed multipart Asset upload" });
  },
  stageFilePart = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-182] multipart file parts expose mutable content streams for staging writes.
    part: Multipart.File,
    path: string,
    maximumByteLength: number,
  ): Effect.Effect<void, InvalidInput | RequestFailureError> => {
    let byteLength = 0;
    return Effect.acquireUseRelease(
      Effect.tryPromise({
        catch: () =>
          new RequestFailureError(
            "InternalError",
            "Upload staging failed",
            httpStatusInternalServerError,
          ),
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
                httpStatusPayloadTooLarge,
              ),
            );
          }
          return writeOrderedFileChunk(handle, chunk);
        }).pipe(Effect.mapError(mapMultipartFailure)),
      (handle) => Effect.promise(() => handle.close().catch(() => {})),
    );
  },
  // oxlint-disable-next-line effecttsgo/async-function, effecttsgo/missing-pipeable-signature -- [EH-040, EH-090] multipart parsing is Promise-based and this helper is not a pipeable Effect API.
  stageMultipartAsset = async <Input extends StageMultipartAssetInput>(
    input: Readonly<Input>,
  ): Promise<StagedAssetUpload> => {
    const { limits, parseAssetMetadata, request, signal } = input,
      directory = await mkdtemp(join(tmpdir(), "nearly-headless-cms-upload-")),
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
      await Effect.runPromise(parse, { signal: toAbortSignal(signal) });
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
    Stream.fromAsyncIterable<Uint8Array, InfrastructureFailure>(createReadStream(path), (cause) =>
      InfrastructureFailure.make({
        cause,
        message: "Staged multipart Asset read failed",
        retryable: false,
      }),
    ).pipe(Stream.map((chunk) => encodeChunk(chunk))),
  writeOrderedFileChunk = (
    handle: Readonly<Awaited<ReturnType<typeof open>>>,
    chunk: Readonly<Uint8Array>,
  ): Effect.Effect<void, InvalidInput | RequestFailureError> =>
    Effect.tryPromise({
      catch: () =>
        new RequestFailureError(
          "InternalError",
          "Upload staging failed",
          httpStatusInternalServerError,
        ),
      // oxlint-disable-next-line effecttsgo/async-function -- [EH-021] FileHandle.write is Promise-based and must remain ordered.
      try: async () => {
        let offset = 0;
        while (offset < chunk.byteLength) {
          // oxlint-disable-next-line no-await-in-loop -- [EH-137] preserve ordered chunk writes.
          const result = await handle.write(chunk, offset, chunk.byteLength - offset, null);
          if (result.bytesWritten === 0) {
            throw new Error("Upload staging write made no progress");
          }
          offset += result.bytesWritten;
        }
      },
    });

export default {
  stageMultipartAsset,
};

export type { MultipartAssetLimits, StagedAssetUpload };
