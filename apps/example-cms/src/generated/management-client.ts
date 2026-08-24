import { Effect, Schema } from "effect";
import {
  type Asset as AssetRepresentation,
  type Entry as EntryRepresentation,
  type EntryPage as QueryPage,
  type MutationResult,
  type OperationResponses,
  makeGeneratedClient,
} from "./management-openapi-client.ts";

export const generatorFormatVersion = 1;

export type { AssetRepresentation, EntryRepresentation, QueryPage };

export class ManagementClientFailure extends Schema.TaggedError<ManagementClientFailure>()(
  "ManagementClientFailure",
  {
    code: Schema.optional(Schema.String),
    details: Schema.optional(Schema.Json),
    message: Schema.String,
    status: Schema.Number,
  },
) {}

const definitionSpaceId = "example-blog",
  mapFailure = <Value, Failure extends { readonly message: string }>(
    operation: Effect.Effect<Value, Failure>,
  ): Effect.Effect<Value, ManagementClientFailure> =>
    operation.pipe(
      Effect.mapError((failure) =>
        ManagementClientFailure.make({
          ...(typeof failure === "object" && failure !== null && "code" in failure
            ? { code: String(failure.code) }
            : {}),
          ...(typeof failure === "object" && failure !== null && "details" in failure
            ? { details: failure.details }
            : {}),
          message: failure.message,
          status:
            typeof failure === "object" && failure !== null && "status" in failure
              ? Number(failure.status)
              : 0,
        }),
      ),
    );

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
    return {
      contentTypeId,
      definitionSpaceId,
      ...(entryId === undefined ? {} : { entryId }),
    };
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
    listAssets: (): Effect.Effect<ReadonlyArray<AssetRepresentation>, ManagementClientFailure> =>
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
    replaceEntry: (
      contentTypeId: string,
      entryId: string,
      values: Readonly<Record<string, unknown>>,
      writeToken?: string,
    ): Effect.Effect<MutationResult, ManagementClientFailure> =>
      mapFailure(
        generatedClient.replaceEntry({
          body: { values },
          headers: { "CMS-Write-Token": writeToken ?? "" },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    restoreRevision: (
      contentTypeId: string,
      entryId: string,
      revisionNumber: number,
      writeToken: string,
    ): Effect.Effect<OperationResponses["restoreEntryRevision"], ManagementClientFailure> =>
      mapFailure(
        generatedClient.restoreEntryRevision({
          body: { revisionNumber, writeToken },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    runEditorialCommand: (
      contentTypeId: "post" | "comment",
      entryId: string,
      status: "draft" | "published" | "approved" | "rejected",
      writeToken: string,
    ): Effect.Effect<OperationResponses["publishPost"], ManagementClientFailure> => {
      const input = {
        headers: { "cms-write-token": writeToken },
        path: { definitionSpaceId, entryId },
      };
      if (contentTypeId === "post") {
        return mapFailure(
          status === "published"
            ? generatedClient.publishPost(input)
            : generatedClient.returnPostToDraft(input),
        );
      }
      return mapFailure(
        status === "approved"
          ? generatedClient.approveComment(input)
          : generatedClient.rejectComment(input),
      );
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
