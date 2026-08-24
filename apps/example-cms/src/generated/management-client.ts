import {
  type Asset as AssetRepresentation,
  type Entry as EntryRepresentation,
  type MutationResult,
  type OperationResponses,
  type EntryPage as QueryPage,
  makeGeneratedClient,
} from "./management-openapi-client.ts";
import { Effect, Schema } from "effect";

const makeTaggedErrorClass = Schema.TaggedError;

export const generatorFormatVersion = 1;

export type {
  Asset as AssetRepresentation,
  Entry as EntryRepresentation,
  EntryPage as QueryPage,
} from "./management-openapi-client.ts";

export interface ReplaceEntryInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly values: Readonly<Record<string, unknown>>;
  readonly writeToken?: string;
}

export interface RestoreRevisionInput {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly revisionNumber: number;
  readonly writeToken: string;
}

export interface RunEditorialCommandInput {
  readonly contentTypeId: "post" | "comment";
  readonly entryId: string;
  readonly status: "draft" | "published" | "approved" | "rejected";
  readonly writeToken: string;
}

export class ManagementClientFailure extends makeTaggedErrorClass<ManagementClientFailure>()(
  "ManagementClientFailure",
  {
    code: Schema.optional(Schema.String),
    details: Schema.optional(Schema.Json),
    message: Schema.String,
    status: Schema.Finite,
  },
) {}

const definitionSpaceId = "example-blog",
  unknownStatus = 0,
  mapFailure = <Value, Failure extends { readonly message: string }>(
    operation: Effect.Effect<Value, Failure>,
  ): Effect.Effect<Value, ManagementClientFailure> =>
    operation.pipe(
      Effect.mapError((failure) => {
        const failureProperties: {
          readonly code?: string;
          readonly details?: unknown;
          readonly message: string;
          readonly status: number;
        } = {
          message: failure.message,
          status: unknownStatus,
        };
        if (typeof failure === "object" && failure !== null && "code" in failure) {
          Object.assign(failureProperties, { code: String(failure.code) });
        }
        if (typeof failure === "object" && failure !== null && "details" in failure) {
          Object.assign(failureProperties, { details: failure.details });
        }
        if (typeof failure === "object" && failure !== null && "status" in failure) {
          Object.assign(failureProperties, { status: Number(failure.status) });
        }
        return ManagementClientFailure.make(failureProperties);
      }),
    );

type ContentDeletionResponse =
  | OperationResponses["deleteAuthorWithPostsAndComments"]
  | OperationResponses["deleteEntry"]
  | OperationResponses["deletePostWithComments"]
  | OperationResponses["detachAndDeleteCategory"]
  | OperationResponses["detachAndDeleteTag"];

export const makeManagementClient = (baseAddress = "") => {
  const generatedClient = makeGeneratedClient(baseAddress);
  function pathFor(contentTypeId: string): {
    readonly contentTypeId: string;
    readonly definitionSpaceId: string;
  };
  function pathFor(
    contentTypeId: string,
    entryId: string,
  ): {
    readonly contentTypeId: string;
    readonly definitionSpaceId: string;
    readonly entryId: string;
  };
  function pathFor(contentTypeId: string, entryId?: string) {
    const path = { contentTypeId, definitionSpaceId } as {
      contentTypeId: string;
      definitionSpaceId: string;
      entryId?: string;
    };
    if (entryId !== undefined) {path.entryId = entryId;}
    return path;
  }
  return {
    createEntry: (
      contentTypeId: string,
      values: Readonly<Record<string, unknown>>,
    ): Effect.Effect<MutationResult, ManagementClientFailure> =>
      mapFailure(
        generatedClient.createEntry({
          body: { values },
          path: pathFor(contentTypeId),
        }),
      ),
    deleteContentEntry: (
      contentTypeId: "post" | "author" | "category" | "tag" | "comment",
      entryId: string,
      writeToken: string,
    ): Effect.Effect<ContentDeletionResponse, ManagementClientFailure> => {
      const commandInput = {
        headers: { "cms-write-token": writeToken },
        path: { definitionSpaceId, entryId },
      };
      switch (contentTypeId) {
        case "post": {
          return mapFailure(generatedClient.deletePostWithComments(commandInput));
        }
        case "author": {
          return mapFailure(generatedClient.deleteAuthorWithPostsAndComments(commandInput));
        }
        case "category": {
          return mapFailure(generatedClient.detachAndDeleteCategory(commandInput));
        }
        case "tag": {
          return mapFailure(generatedClient.detachAndDeleteTag(commandInput));
        }
        case "comment": {
          return mapFailure(
            generatedClient.deleteEntry({
              headers: { "CMS-Write-Token": writeToken },
              path: pathFor(contentTypeId, entryId),
            }),
          );
        }
      }
    },
    deleteImageAndClearAssignments: (assetId: string, idempotencyKey: string) =>
      mapFailure(
        generatedClient.deleteImageAndClearAssignments({
          headers: { "idempotency-key": idempotencyKey },
          path: { assetId, definitionSpaceId },
        }),
      ),
    getCurrentState: (
      contentTypeId: string,
      entryId: string,
    ): Effect.Effect<OperationResponses["getCurrentEntryState"], ManagementClientFailure> =>
      mapFailure(generatedClient.getCurrentEntryState({ path: pathFor(contentTypeId, entryId) })),
    getEntry: (
      contentTypeId: string,
      entryId: string,
    ): Effect.Effect<EntryRepresentation, ManagementClientFailure> =>
      mapFailure(generatedClient.getEntry({ path: pathFor(contentTypeId, entryId) })),
    inspectRevision: (
      contentTypeId: string,
      entryId: string,
      revisionNumber: number,
    ): Effect.Effect<OperationResponses["inspectEntryRevision"], ManagementClientFailure> =>
      mapFailure(
        generatedClient.inspectEntryRevision({
          path: { ...pathFor(contentTypeId, entryId), revisionNumber },
        }),
      ),
    listAssets: (): Effect.Effect<readonly AssetRepresentation[], ManagementClientFailure> =>
      mapFailure(generatedClient.listExampleAssets({ path: { definitionSpaceId } })),
    listRevisions: (
      contentTypeId: string,
      entryId: string,
    ): Effect.Effect<OperationResponses["listEntryRevisions"], ManagementClientFailure> =>
      mapFailure(
        generatedClient.listEntryRevisions({
          path: pathFor(contentTypeId, entryId),
          query: { pageSize: 20 },
        }),
      ),
    permanentlyPurgeEntry: (
      contentTypeId: string,
      entryId: string,
      writeToken: string,
    ): Effect.Effect<undefined, ManagementClientFailure> =>
      mapFailure(
        generatedClient.permanentlyPurgeEntry({
          body: { writeToken },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    queryEntries: (
      contentTypeId: string,
      query: Readonly<Record<string, unknown>>,
    ): Effect.Effect<QueryPage, ManagementClientFailure> =>
      mapFailure(
        generatedClient.queryEntries({
          body: query,
          path: pathFor(contentTypeId),
        }),
      ),
    replaceEntry: ({
      contentTypeId,
      entryId,
      values,
      writeToken,
    }: ReplaceEntryInput): Effect.Effect<MutationResult, ManagementClientFailure> =>
      mapFailure(
        generatedClient.replaceEntry({
          body: { values },
          headers: { "CMS-Write-Token": writeToken ?? "" },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    replaceImage: (
      assetId: string,
      file: File,
      idempotencyKey: string,
    ): Effect.Effect<OperationResponses["replaceImage"], ManagementClientFailure> => {
      const formData = new FormData();
      formData.set(
        "metadata",
        JSON.stringify({
          filename: file.name,
          mediaType: file.type || "application/octet-stream",
        }),
      );
      formData.set("content", file);
      return mapFailure(
        generatedClient.replaceImage({
          body: formData,
          headers: { "idempotency-key": idempotencyKey },
          path: { assetId, definitionSpaceId },
        }),
      );
    },
    restoreRevision: ({
      contentTypeId,
      entryId,
      revisionNumber,
      writeToken,
    }: RestoreRevisionInput): Effect.Effect<
      OperationResponses["restoreEntryRevision"],
      ManagementClientFailure
    > =>
      mapFailure(
        generatedClient.restoreEntryRevision({
          body: { revisionNumber, writeToken },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    runEditorialCommand: ({
      contentTypeId,
      entryId,
      status,
      writeToken,
    }: RunEditorialCommandInput): Effect.Effect<
      OperationResponses["publishPost"],
      ManagementClientFailure
    > => {
      const input = {
        headers: { "cms-write-token": writeToken },
        path: { definitionSpaceId, entryId },
      };
      if (contentTypeId === "post") {
        if (status === "published") {return mapFailure(generatedClient.publishPost(input));}
        return mapFailure(generatedClient.returnPostToDraft(input));
      }
      if (status === "approved") {return mapFailure(generatedClient.approveComment(input));}
      return mapFailure(generatedClient.rejectComment(input));
    },
    uploadAsset: (file: File): Effect.Effect<AssetRepresentation, ManagementClientFailure> => {
      const formData = new FormData();
      formData.set(
        "metadata",
        JSON.stringify({
          filename: file.name,
          mediaType: file.type || "application/octet-stream",
        }),
      );
      formData.set("content", file);
      return mapFailure(
        generatedClient.ingestAsset({
          body: formData,
          path: { definitionSpaceId },
        }),
      );
    },
  };
};
