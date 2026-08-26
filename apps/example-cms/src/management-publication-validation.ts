import { type Cms, CmsError, type ContentDefinition } from "nearly-headless-cms";
import { Effect } from "effect";
import managementSupport from "./management-support.ts";

interface CollectRichTextPublicationRulesInput<Issues extends CmsError.ValidationIssue[]> {
  readonly issues: Issues;
  readonly path: readonly (string | number)[];
  readonly references: RichTextPublicationReference[];
  readonly value: unknown;
}

interface RichTextPublicationReference {
  readonly entryIdentifier: string;
  readonly path: readonly (string | number)[];
}

const { isRecord } = managementSupport,
  collectFeaturedImageAlternativeTextIssue = <Issues extends CmsError.ValidationIssue[]>(
    issues: Issues,
    values: Readonly<ContentDefinition.JsonObject>,
  ): Issues => {
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
    return issues;
  },
  collectRichTextAssetAlternativeTextIssue = <
    Issues extends CmsError.ValidationIssue[],
    ObjectValue extends Record<string, unknown>,
  >(
    issues: Issues,
    path: readonly (string | number)[],
    objectValue: Readonly<ObjectValue>,
  ): Issues => {
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
    return issues;
  },
  collectRichTextEntryReference = <
    References extends RichTextPublicationReference[],
    ObjectValue extends Record<string, unknown>,
  >(
    objectValue: Readonly<ObjectValue>,
    path: readonly (string | number)[],
    references: References,
  ): References => {
    const entryIdentifier = objectValue["entryId"],
      nodeType = objectValue["type"];
    if (nodeType === "entry-reference" && typeof entryIdentifier === "string") {
      references.push({ entryIdentifier, path: [...path, "entryId"] });
    }
    return references;
  },
  collectRichTextPublicationRules = <
    Issues extends CmsError.ValidationIssue[],
    Input extends Readonly<CollectRichTextPublicationRulesInput<Issues>>,
  >(
    input: Input,
  ): Input["issues"] => {
    const { issues, path, references, value } = input;
    if (Array.isArray(value)) {
      for (const [index, child] of value.entries()) {
        collectRichTextPublicationRules({
          issues,
          path: [...path, index],
          references,
          value: child as unknown,
        });
      }
      return issues;
    }
    if (value === null || typeof value !== "object" || !isRecord(value)) {
      return issues;
    }
    return collectRichTextPublicationRulesForObject({ issues, path, references, value });
  },
  collectRichTextPublicationRulesForObject = <
    Issues extends CmsError.ValidationIssue[],
    Input extends Readonly<
      CollectRichTextPublicationRulesInput<Issues> & {
        readonly value: Record<string, unknown>;
      }
    >,
  >(
    input: Input,
  ): Input["issues"] => {
    const { issues, path, references, value } = input;
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
    return issues;
  },
  resolvePublicationReferenceTarget = <CmsService extends Cms.ServiceShape>(
    cms: Readonly<CmsService>,
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
  validatePostPublication = <CmsService extends Cms.ServiceShape>(
    cms: Readonly<CmsService>,
    values: Readonly<ContentDefinition.JsonObject>,
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
  validateRichTextPublicationReferences = <
    CmsService extends Cms.ServiceShape,
    Issues extends CmsError.ValidationIssue[],
  >(
    cms: Readonly<CmsService>,
    issues: Issues,
    references: readonly RichTextPublicationReference[],
  ): Effect.Effect<Issues, CmsError.CmsError> =>
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
      return issues;
    });

export default {
  validatePostPublication,
};
