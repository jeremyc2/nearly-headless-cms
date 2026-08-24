import { CmsError, type ContentDefinition } from "nearly-headless-cms";
import { DateTime, Effect } from "effect";
import type { HttpContract } from "nearly-headless-cms/http";
import managementPublicationValidation from "./management-publication-validation.ts";
import managementSupport from "./management-support.ts";

interface ApplyPublishedTimestampInput {
  readonly contentTypeId: "post" | "comment";
  readonly currentValues: ContentDefinition.JsonObject;
  readonly status: "draft" | "published" | "approved" | "rejected";
  readonly values: ContentDefinition.JsonObject;
}

const { requiredParameter } = managementSupport,
  { validatePostPublication } = managementPublicationValidation,
  applyPublishedTimestamp = ({
    contentTypeId,
    currentValues,
    status,
    values,
  }: ApplyPublishedTimestampInput): Effect.Effect<ContentDefinition.JsonObject> =>
    Effect.gen(function* applyPublishedTimestampToValues() {
      if (
        contentTypeId === "post" &&
        status === "published" &&
        currentValues["published-at"] === null
      ) {
        Object.assign(values, { "published-at": DateTime.formatIso(yield* DateTime.now) });
      }
      return values;
    }),
  loadTransitionEntry = (
    cms: Parameters<NonNullable<HttpContract.ManagementOperation["execute"]>>[0]["cms"],
    contentTypeId: "post" | "comment",
    entryId: string,
    status: "draft" | "published" | "approved" | "rejected",
  ) =>
    Effect.gen(function* loadTransitionEntryState() {
      const current = yield* cms.getEntry({ contentTypeId, entryId });
      if (contentTypeId === "post" && status === "published") {
        yield* validatePostPublication(cms, current.values);
      }
      return current;
    }),
  transition =
    (
      contentTypeId: "post" | "comment",
      status: "draft" | "published" | "approved" | "rejected",
    ): HttpContract.ManagementOperation["execute"] =>
    ({ cms, parameters, request }) =>
      Effect.gen(function* transitionEntry() {
        const entryId = requiredParameter(parameters, "entryId"),
          writeToken = request.headers.get("cms-write-token");
        if (writeToken === null || writeToken.length === 0) {
          return yield* CmsError.InvalidInput.make({ message: "CMS-Write-Token is required" });
        }
        const current = yield* loadTransitionEntry(cms, contentTypeId, entryId, status);
        return yield* cms.updateEntry({
          contentTypeId,
          entryId,
          values: yield* applyPublishedTimestamp({
            contentTypeId,
            currentValues: current.values,
            status,
            values: { ...current.values, status },
          }),
          writeToken,
        });
      });

export default {
  transition,
};
