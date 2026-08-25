import { Effect, Schema } from "effect";
import {
  type MutationResult,
  type OperationResponses,
  makeGeneratedClient,
} from "./management-openapi-client.ts";

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

type ContentDeletionResponse =
  | OperationResponses["deleteAuthorWithPostsAndComments"]
  | OperationResponses["deleteEntry"]
  | OperationResponses["deletePostWithComments"]
  | OperationResponses["detachAndDeleteCategory"]
  | OperationResponses["detachAndDeleteTag"];

type GeneratedClient = ReturnType<typeof makeGeneratedClient>;

interface PathFor {
  (contentTypeId: string): {
    readonly contentTypeId: string;
    readonly definitionSpaceId: string;
  };
  (
    contentTypeId: string,
    entryId: string,
  ): {
    readonly contentTypeId: string;
    readonly definitionSpaceId: string;
    readonly entryId: string;
  };
}

const buildAssetFormData = (file: File): FormData => {
    const formData = new FormData();
    formData.set(
      "metadata",
      JSON.stringify({ filename: file.name, mediaType: file.type || "application/octet-stream" }),
    );
    formData.set("content", file);
    return formData;
  },
  createPathFor = (): PathFor => {
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
      if (entryId !== undefined) {
        path.entryId = entryId;
      }
      return path;
    }
    return pathFor;
  },
  definitionSpaceId = "example-blog",
  deleteContentEntryFor = (
    generatedClient: Readonly<GeneratedClient>,
    pathFor: PathFor,
    input: {
      readonly contentTypeId: "post" | "author" | "category" | "tag" | "comment";
      readonly entryId: string;
      readonly writeToken: string;
    },
  ): Effect.Effect<ContentDeletionResponse, ManagementClientFailure> => {
    const commandInput = {
      headers: { "cms-write-token": input.writeToken },
      path: { definitionSpaceId, entryId: input.entryId },
    };
    switch (input.contentTypeId) {
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
            headers: { "CMS-Write-Token": input.writeToken },
            path: pathFor(input.contentTypeId, input.entryId),
          }),
        );
      }
      default: {
        input.contentTypeId satisfies never;
        return Effect.die("Unexpected content type");
      }
    }
  },
  makeAssetMethods = (generatedClient: Readonly<GeneratedClient>) => ({
    deleteImageAndClearAssignments: (assetId: string, idempotencyKey: string) =>
      mapFailure(
        generatedClient.deleteImageAndClearAssignments({
          headers: { "idempotency-key": idempotencyKey },
          path: { assetId, definitionSpaceId },
        }),
      ),
    listAssets: () =>
      mapFailure(generatedClient.listExampleAssets({ path: { definitionSpaceId } })),
    replaceImage: (assetId: string, file: File, idempotencyKey: string) =>
      mapFailure(
        generatedClient.replaceImage({
          body: buildAssetFormData(file),
          headers: { "idempotency-key": idempotencyKey },
          path: { assetId, definitionSpaceId },
        }),
      ),
    uploadAsset: (file: File) =>
      mapFailure(
        generatedClient.ingestAsset({
          body: buildAssetFormData(file),
          path: { definitionSpaceId },
        }),
      ),
  }),
  makeEditorialMethods = (generatedClient: Readonly<GeneratedClient>) => ({
    runEditorialCommand: ({
      contentTypeId,
      entryId,
      status,
      writeToken,
    }: Readonly<RunEditorialCommandInput>) => {
      const input = {
        headers: { "cms-write-token": writeToken },
        path: { definitionSpaceId, entryId },
      };
      if (contentTypeId === "post") {
        if (status === "published") {
          return mapFailure(generatedClient.publishPost(input));
        }
        return mapFailure(generatedClient.returnPostToDraft(input));
      }
      if (status === "approved") {
        return mapFailure(generatedClient.approveComment(input));
      }
      return mapFailure(generatedClient.rejectComment(input));
    },
  }),
  makeEntryMutationMethods = (generatedClient: Readonly<GeneratedClient>, pathFor: PathFor) => ({
    createEntry: (contentTypeId: string, values: Readonly<Record<string, unknown>>) =>
      mapFailure(generatedClient.createEntry({ body: { values }, path: pathFor(contentTypeId) })),
    deleteContentEntry: (
      contentTypeId: "post" | "author" | "category" | "tag" | "comment",
      entryId: string,
      writeToken: string,
    ) => deleteContentEntryFor(generatedClient, pathFor, { contentTypeId, entryId, writeToken }),
    permanentlyPurgeEntry: (contentTypeId: string, entryId: string, writeToken: string) =>
      mapFailure(
        generatedClient.permanentlyPurgeEntry({
          body: { writeToken },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    replaceEntry: ({
      contentTypeId,
      entryId,
      values,
      writeToken,
    }: Readonly<ReplaceEntryInput>): Effect.Effect<MutationResult, ManagementClientFailure> =>
      mapFailure(
        generatedClient.replaceEntry({
          body: { values },
          headers: { "CMS-Write-Token": writeToken ?? "" },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
    restoreRevision: ({
      contentTypeId,
      entryId,
      revisionNumber,
      writeToken,
    }: Readonly<RestoreRevisionInput>) =>
      mapFailure(
        generatedClient.restoreEntryRevision({
          body: { revisionNumber, writeToken },
          path: pathFor(contentTypeId, entryId),
        }),
      ),
  }),
  makeEntryQueryMethods = (generatedClient: Readonly<GeneratedClient>, pathFor: PathFor) => ({
    getCurrentState: (contentTypeId: string, entryId: string) =>
      mapFailure(generatedClient.getCurrentEntryState({ path: pathFor(contentTypeId, entryId) })),
    getEntry: (contentTypeId: string, entryId: string) =>
      mapFailure(generatedClient.getEntry({ path: pathFor(contentTypeId, entryId) })),
    inspectRevision: (contentTypeId: string, entryId: string, revisionNumber: number) =>
      mapFailure(
        generatedClient.inspectEntryRevision({
          path: { ...pathFor(contentTypeId, entryId), revisionNumber },
        }),
      ),
    listRevisions: (contentTypeId: string, entryId: string) =>
      mapFailure(
        generatedClient.listEntryRevisions({
          path: pathFor(contentTypeId, entryId),
          query: { pageSize: 20 },
        }),
      ),
    queryEntries: (contentTypeId: string, query: Readonly<Record<string, unknown>>) =>
      mapFailure(generatedClient.queryEntries({ body: query, path: pathFor(contentTypeId) })),
  }),
  makeManagementClient = (baseAddress = "") => {
    const generatedClient = makeGeneratedClient(baseAddress),
      pathFor = createPathFor();
    return {
      ...makeEntryQueryMethods(generatedClient, pathFor),
      ...makeEntryMutationMethods(generatedClient, pathFor),
      ...makeAssetMethods(generatedClient),
      ...makeEditorialMethods(generatedClient),
    };
  },
  makeTaggedErrorClass = Schema.TaggedError,
  mapFailure = <Success, Failure extends { readonly message: string }>(
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- Effect programs are mapped without mutation.
    operation: Effect.Effect<Success, Failure>,
  ): Effect.Effect<Success, ManagementClientFailure> =>
    operation.pipe(
      Effect.mapError((failure) => {
        const failureProperties: {
          readonly code?: string;
          readonly details?: unknown;
          readonly message: string;
          readonly status: number;
        } = { message: failure.message, status: unknownStatus };
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
    ),
  generatorFormatVersion = 1,
  unknownStatus = 0;

export class ManagementClientFailure extends makeTaggedErrorClass<ManagementClientFailure>()(
  "ManagementClientFailure",
  {
    code: Schema.optional(Schema.String),
    details: Schema.optional(Schema.Json),
    message: Schema.String,
    status: Schema.Finite,
  },
) {}

export { generatorFormatVersion, makeManagementClient };
