import { type Cms, CmsError, type ContentDefinition } from "nearly-headless-cms";
import { Effect } from "effect";
import managementSupport from "./management-support.ts";

interface CollectRichTextPublicationRulesInput {
  readonly issues: CmsError.ValidationIssue[];
  readonly path: readonly (string | number)[];
  readonly references: RichTextPublicationReference[];
  readonly value: unknown;
}

interface RichTextPublicationReference {
  readonly entryIdentifier: string;
  readonly path: readonly (string | number)[];
}

const { isRecord } = managementSupport,
  collectFeaturedImageAlternativeTextIssue = (
    issues: CmsError.ValidationIssue[],
    values: ContentDefinition.JsonObject,
  ): void => {
    if (
      typeof values["featured-asset"] === "string" &&
      (typeof values["featured-alternative-text"] !== "string" ||
        values["featured-alternative-text"].trim() === "")
    ) {
      issues.push({
        message: "A published featured image requires meaningful alternative text",
        path: ["featured-alternative-text"],
        reason: "missingAlternativeText",
      });
    }
  },
  collectRichTextAssetAlternativeTextIssue = (
    issues: CmsError.ValidationIssue[],
    path: readonly (string | number)[],
    objectValue: Record<string, unknown>,
  ): void => {
    const { alternativeText } = objectValue,
      nodeType = objectValue["type"];
    if (
      nodeType === "asset-reference" &&
      (typeof alternativeText !== "string" || alternativeText.trim() === "")
    ) {
      issues.push({
        message: "Published Rich Text images require meaningful alternative text",
        path: [...path, "alternativeText"],
        reason: "missingAlternativeText",
      });
    }
  },
  collectRichTextEntryReference = (
    objectValue: Record<string, unknown>,
    path: readonly (string | number)[],
    references: RichTextPublicationReference[],
  ): void => {
    const entryIdentifier = objectValue["entryId"],
      nodeType = objectValue["type"];
    if (nodeType === "entry-reference" && typeof entryIdentifier === "string") {
      references.push({ entryIdentifier, path: [...path, "entryId"] });
    }
  },
  collectRichTextPublicationRules = ({
    issues,
    path,
    references,
    value,
  }: CollectRichTextPublicationRulesInput): void => {
    if (Array.isArray(value)) {
      for (const [index, child] of value.entries()) {
        collectRichTextPublicationRules({
          issues,
          path: [...path, index],
          references,
          value: child,
        });
      }
      return;
    }
    if (value === null || typeof value !== "object" || !isRecord(value)) {
      return;
    }
    collectRichTextAssetAlternativeTextIssue(issues, path, value);
    collectRichTextEntryReference(value, path, references);
    for (const [key, child] of Object.entries(value)) {
      collectRichTextPublicationRules({
        issues,
        path: [...path, key],
        references,
        value: child,
      });
    }
  },
  resolvePublicationReferenceTarget = (
    cms: Cms.ServiceShape,
    entryIdentifier: string,
  ): Effect.Effect<Cms.ConsistentReadSnapshot["entries"][number] | null, CmsError.CmsError> =>
    Effect.gen(function* resolvePublicationReferenceTargetState() {
      for (const contentTypeIdentifier of ["post", "author", "category", "tag"]) {
        const target = yield* cms
          .getEntry({ contentTypeId: contentTypeIdentifier, entryId: entryIdentifier })
          .pipe(Effect.catchTag("NotFound", () => Effect.succeed(null)));
        if (target !== null) {
          return target;
        }
      }
      return null;
    }),
  validatePostPublication = (
    cms: Cms.ServiceShape,
    values: ContentDefinition.JsonObject,
  ): Effect.Effect<void, CmsError.CmsError> =>
    Effect.gen(function* validatePostPublicationState() {
      const issues: CmsError.ValidationIssue[] = [],
        references: RichTextPublicationReference[] = [];
      collectFeaturedImageAlternativeTextIssue(issues, values);
      collectRichTextPublicationRules({
        issues,
        path: ["body"],
        references,
        value: values["body"],
      });
      yield* validateRichTextPublicationReferences(cms, issues, references);
      if (issues.length > 0) {
        return yield* CmsError.InvalidInput.make({
          issues,
          message: "Post is not ready for publication",
        });
      }
      return yield* Effect.void;
    }),
  validateRichTextPublicationReferences = (
    cms: Cms.ServiceShape,
    issues: CmsError.ValidationIssue[],
    references: readonly RichTextPublicationReference[],
  ): Effect.Effect<void, CmsError.CmsError> =>
    Effect.gen(function* validateRichTextPublicationReferenceTargets() {
      for (const reference of references) {
        const target = yield* resolvePublicationReferenceTarget(cms, reference.entryIdentifier);
        if (
          target === null ||
          (target.contentTypeId === "post" && target.values["status"] !== "published")
        ) {
          issues.push({
            message: "Published Rich Text Entry references must resolve to public content",
            path: reference.path,
            reason: "referenceNotPublic",
          });
        }
      }
    });

export default {
  validatePostPublication,
};
