import {
  CmsError,
  type CommandReceiptStore,
  DateTime,
  Effect,
  type HttpContract,
  Schema,
} from "./delivery-comment-submission-imports.ts";
import deliverySupport from "./delivery-support.ts";

const { canonicalizeJsonValue, parseBody, requiredParameter } = deliverySupport,
  commentReceiptLookupFailure = (cause: unknown) =>
    CmsError.InfrastructureFailure.make({
      cause,
      message: "Comment receipt lookup failed",
      retryable: true,
    }),
  commentReceiptPersistenceFailure = (cause: unknown) =>
    CmsError.InfrastructureFailure.make({
      cause,
      message: "Comment receipt persistence failed",
      retryable: true,
    }),
  createPendingCommentReceipt = <
    Input extends {
      body: Record<string, unknown>;
      canonicalInput: string;
      cms: Parameters<HttpContract.DeliveryOperation["execute"]>[0]["cms"];
      commandReceiptStore: CommandReceiptStore;
      idempotencyKey: string;
      post: { id: string };
      postIdentifier: string;
    },
  >(
    input: Readonly<Input>,
  ) =>
    Effect.gen(function* createPendingCommentReceiptEffect() {
      const { commentBody, displayName, websiteUrl } = yield* validateCommentFields(input.body),
        receipt = pendingCommentReceipt(
          yield* input.cms.createEntry({
            contentTypeId: "comment",
            values: {
              body: commentBody,
              "created-at": DateTime.formatIso(yield* DateTime.now),
              "display-name": displayName,
              post: input.post.id,
              status: "pending",
              "website-url": websiteUrl ?? null,
            },
          }),
        );
      yield* writeCommentReceipt({
        canonicalInput: input.canonicalInput,
        commandReceiptStore: input.commandReceiptStore,
        idempotencyKey: input.idempotencyKey,
        postIdentifier: input.postIdentifier,
        receipt,
      });
      return receipt;
    }),
  isStoredCommentReceipt = (
    prior: unknown,
  ): prior is { canonicalInput: string; receipt: Record<string, unknown> } =>
    prior !== undefined &&
    prior !== null &&
    typeof prior === "object" &&
    "canonicalInput" in prior &&
    "receipt" in prior &&
    typeof prior.canonicalInput === "string" &&
    prior.receipt !== null &&
    typeof prior.receipt === "object",
  makeSubmitCommentExecute =
    (commandReceiptStore: CommandReceiptStore): HttpContract.DeliveryOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* submitCommentEffect() {
        const body = yield* parseBody(request),
          canonicalInput = yield* Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown))(
            canonicalizeJsonValue(body),
          ).pipe(Effect.orDie),
          idempotencyKey = request.headers.get("idempotency-key") ?? "",
          postIdentifier = requiredParameter(parameters, "postId"),
          prior = yield* readStoredCommentReceipt(
            commandReceiptStore,
            postIdentifier,
            idempotencyKey,
          ),
          storedReceipt = yield* resolveStoredCommentReceipt(prior, canonicalInput);
        if (storedReceipt !== undefined) {
          return storedReceipt;
        }
        return yield* submitNewComment({
          body,
          canonicalInput,
          cms,
          commandReceiptStore,
          idempotencyKey,
          postIdentifier,
        });
      }),
  pendingCommentReceipt = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- mutation receipts use discriminated union shapes from CMS operations.
    result: { id: string } | { entry: { id: string }; writeToken: string },
  ): { status: "pending"; submissionId: string } => ({
    status: "pending",
    submissionId: submissionIdentifier(result),
  }),
  readStoredCommentReceipt = (
    commandReceiptStore: CommandReceiptStore,
    postIdentifier: string,
    idempotencyKey: string,
  ) =>
    commandReceiptStore
      .read(`comment-submission:${postIdentifier}`, idempotencyKey)
      .pipe(Effect.mapError(commentReceiptLookupFailure)),
  resolveStoredCommentReceipt = (
    prior: unknown,
    canonicalInput: string,
  ): Effect.Effect<Record<string, unknown> | undefined, CmsError.CmsError> => {
    if (!isStoredCommentReceipt(prior)) {
      return Effect.succeed(undefined as Record<string, unknown> | undefined);
    }
    if (prior.canonicalInput !== canonicalInput) {
      return Effect.fail(
        CmsError.IdempotencyConflict.make({
          message: "Idempotency key was reused with different Comment input",
        }),
      );
    }
    if (!Schema.is(Schema.JsonObject)(prior.receipt)) {
      return Effect.fail(
        CmsError.InfrastructureFailure.make({
          message: "Stored Comment receipt is not JSON-compatible",
          retryable: false,
        }),
      );
    }
    return Effect.succeed(prior.receipt);
  },
  submissionIdentifier = (
    result: { readonly id: string } | { readonly entry: { readonly id: string }; readonly writeToken: string },
  ): string => {
    if ("writeToken" in result) {
      return result.entry.id;
    }
    return result.id;
  },
  submitNewComment = <
    Input extends {
      body: Record<string, unknown>;
      canonicalInput: string;
      cms: Parameters<HttpContract.DeliveryOperation["execute"]>[0]["cms"];
      commandReceiptStore: CommandReceiptStore;
      idempotencyKey: string;
      postIdentifier: string;
    },
  >(
    input: Readonly<Input>,
  ) =>
    Effect.gen(function* submitNewCommentEffect() {
      const post = yield* input.cms.getEntry({
        contentTypeId: "post",
        entryId: input.postIdentifier,
      });
      if (post.values["status"] !== "published") {
        return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
      }
      return yield* createPendingCommentReceipt({
        body: input.body,
        canonicalInput: input.canonicalInput,
        cms: input.cms,
        commandReceiptStore: input.commandReceiptStore,
        idempotencyKey: input.idempotencyKey,
        post,
        postIdentifier: input.postIdentifier,
      });
    }),
  validateCommentFields = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- comment submission bodies are validated as loosely typed JSON records.
    body: Record<string, unknown>,
  ): Effect.Effect<
    { commentBody: string; displayName: string; websiteUrl: string | null | undefined },
    CmsError.InvalidInput
  > => {
    const commentBody = body["body"],
      {displayName} = body,
      {websiteUrl} = body;
    if (
      typeof displayName !== "string" ||
      typeof commentBody !== "string" ||
      (websiteUrl !== undefined && websiteUrl !== null && typeof websiteUrl !== "string")
    ) {
      return Effect.fail(CmsError.InvalidInput.make({ message: "Comment fields are invalid" }));
    }
    return Effect.succeed({ commentBody, displayName, websiteUrl });
  },
  writeCommentReceipt = <
    Input extends {
      canonicalInput: string;
      commandReceiptStore: CommandReceiptStore;
      idempotencyKey: string;
      postIdentifier: string;
      receipt: Record<string, unknown>;
    },
  >(
    input: Readonly<Input>,
  ) =>
    input.commandReceiptStore
      .write(`comment-submission:${input.postIdentifier}`, input.idempotencyKey, {
        canonicalInput: input.canonicalInput,
        receipt: input.receipt,
      })
      .pipe(Effect.mapError(commentReceiptPersistenceFailure));

export default {
  makeSubmitCommentExecute,
};
