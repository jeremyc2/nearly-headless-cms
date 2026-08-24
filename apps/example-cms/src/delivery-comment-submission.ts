import { CmsError } from "nearly-headless-cms";
import type { HttpContract } from "nearly-headless-cms/http";
import { DateTime, Effect, Schema } from "effect";
import type { CommandReceiptStore } from "./command-receipt-store.ts";
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
  readStoredCommentReceipt = (
    commandReceiptStore: CommandReceiptStore,
    postIdentifier: string,
    idempotencyKey: string,
  ) =>
    commandReceiptStore.read(`comment-submission:${postIdentifier}`, idempotencyKey).pipe(
      Effect.mapError(commentReceiptLookupFailure),
    ),
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
  validateCommentFields = (
    body: Record<string, unknown>,
  ): Effect.Effect<
    { commentBody: string; displayName: string; websiteUrl: string | null | undefined },
    CmsError.InvalidInput
  > => {
    const { displayName } = body,
      commentBody = body["body"],
      { websiteUrl } = body;
    if (
      typeof displayName !== "string" ||
      typeof commentBody !== "string" ||
      (websiteUrl !== undefined && websiteUrl !== null && typeof websiteUrl !== "string")
    ) {
      return Effect.fail(CmsError.InvalidInput.make({ message: "Comment fields are invalid" }));
    }
    return Effect.succeed({ commentBody, displayName, websiteUrl });
  },
  submissionIdentifier = (
    result: { id: string } | { entry: { id: string }; writeToken: string },
  ): string => {
    if ("writeToken" in result) {
      return result.entry.id;
    }
    return result.id;
  },
  writeCommentReceipt = (input: {
    canonicalInput: string;
    commandReceiptStore: CommandReceiptStore;
    idempotencyKey: string;
    postIdentifier: string;
    receipt: Record<string, unknown>;
  }) =>
    input.commandReceiptStore
      .write(`comment-submission:${input.postIdentifier}`, input.idempotencyKey, {
        canonicalInput: input.canonicalInput,
        receipt: input.receipt,
      })
      .pipe(Effect.mapError(commentReceiptPersistenceFailure)),
  makeSubmitCommentExecute =
    (commandReceiptStore: CommandReceiptStore): HttpContract.DeliveryOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* submitComment() {
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
        const post = yield* cms.getEntry({
          contentTypeId: "post",
          entryId: postIdentifier,
        });
        if (post.values["status"] !== "published") {
          return yield* CmsError.NotFound.make({ message: "Published Post was not found" });
        }
        const { commentBody, displayName, websiteUrl } = yield* validateCommentFields(body),
          result = yield* cms.createEntry({
            contentTypeId: "comment",
            values: {
              body: commentBody,
              "created-at": DateTime.formatIso(yield* DateTime.now),
              "display-name": displayName,
              post: post.id,
              status: "pending",
              "website-url": websiteUrl ?? null,
            },
          }),
          receipt = {
            status: "pending",
            submissionId: submissionIdentifier(result),
          };
        yield* writeCommentReceipt({
          canonicalInput,
          commandReceiptStore,
          idempotencyKey,
          postIdentifier,
          receipt,
        });
        return receipt;
      });

export default {
  makeSubmitCommentExecute,
};
