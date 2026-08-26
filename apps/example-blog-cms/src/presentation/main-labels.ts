import { DateTime } from "effect";

const activeStatusClass = (value: unknown): string => {
    if (value === "published") {
      return "published";
    }
    return "";
  },
  assetCaption = (caption: string): { caption?: string } => {
    if (caption.length > 0) {
      return { caption };
    }
    return {};
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-134] UI label helper is intentionally a direct two-argument operation.
  assetDimensions = (width: number | undefined, height: number | undefined): string => {
    if (width === undefined) {
      return "";
    }
    return ` · ${width} × ${height ?? "?"}`;
  },
  assetSelectValue = (value: unknown): string => {
    if (typeof value === "string") {
      return value;
    }
    return "";
  },
  deleteImageLabel = (isPending: boolean): string => {
    if (isPending) {
      return "Deleting…";
    }
    return "Clear assignments and delete";
  },
  deletionStatus = (isPending: boolean): string => {
    if (isPending) {
      return "Deleting…";
    }
    return "Delete Entry";
  },
  dialogHeading = (type: string): string => {
    if (type === "entry") {
      return "Entry reference";
    }
    return type;
  },
  draftPluralSuffix = (count: number): string => {
    if (count === 1) {
      return "";
    }
    return "s";
  },
  editorialButtonLabel = (value: unknown): string => {
    if (value === "published") {
      return "Return to draft";
    }
    return "Publish Post";
  },
  editorialConfirmationDescription = (value: string): string => {
    if (value === "published" || value === "approved") {
      return "This content becomes public-eligible and appears after the next static refresh.";
    }
    return "This content stops being public-eligible; an existing static build changes only after refresh.";
  },
  editorialConfirmationLabel = (value: string): string => {
    if (value === "published") {
      return "Publish this Post?";
    }
    if (value === "draft") {
      return "Return this Post to draft?";
    }
    if (value === "approved") {
      return "Approve this Comment?";
    }
    return "Reject this Comment?";
  },
  editorialStatus = (value: unknown): "draft" | "published" => {
    if (value === "published") {
      return "draft";
    }
    return "published";
  },
  entryDeletionTitle = (title: string): string => {
    if (title.length > 0) {
      return title;
    }
    return "this Entry";
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-134] UI label helper is intentionally a direct two-argument operation.
  entryOptionLabel = <Values extends Record<string, unknown>>(
    values: Readonly<Values>,
    identifier: string,
  ): string => {
    if (typeof values["title"] === "string") {
      return values["title"];
    }
    if (typeof values["name"] === "string") {
      return values["name"];
    }
    return identifier;
  },
  featuredAlternativeTextField = (rootField: string): string => {
    if (rootField === "featured-alternative-text") {
      return "field-featured-alternative-text";
    }
    return "field-body";
  },
  headingLevel = (
    blockType: string,
  ): typeof headingLevelValueTwo | typeof headingLevelValueThree | typeof headingLevelValueFour => {
    if (blockType.endsWith("2")) {
      return headingLevelValueTwo;
    }
    if (blockType.endsWith("3")) {
      return headingLevelValueThree;
    }
    return headingLevelValueFour;
  },
  headingLevelValueFour = 4,
  headingLevelValueThree = 3,
  headingLevelValueTwo = 2,
  pendingCommentClass = (count: number): string => {
    if (count > 0) {
      return "attention";
    }
    return "";
  },
  publicationInputMaxLength = 16,
  publicationInputValue = (value: unknown): string => {
    if (typeof value === "string") {
      return value.slice(0, publicationInputMaxLength);
    }
    return "";
  },
  publicationValue = (value: string): string | null => {
    if (value === "") {
      return null;
    }
    return DateTime.formatIso(DateTime.makeUnsafe(value));
  },
  purgeStatus = (isPending: boolean): string => {
    if (isPending) {
      return "Purging…";
    }
    return "Permanently purge";
  },
  rebuildLabel = (isPending: boolean): string => {
    if (isPending) {
      return "Building…";
    }
    return "Rebuild demonstration";
  },
  relatedContentType = (contentTypeId: string): string => {
    if (contentTypeId === "comment") {
      return "post";
    }
    return "author";
  },
  revisionClass = (index: number): string => {
    if (index === 0) {
      return "revision-dot current";
    }
    return "revision-dot";
  },
  revisionLabel = (index: number): string => {
    if (index === 0) {
      return "Current · inspect · ";
    }
    return "Inspect · ";
  },
  saveStatus = (isPending: boolean): string => {
    if (isPending) {
      return "Saving…";
    }
    return "Saved in CMS";
  },
  sortDirectionValue = (value: string): "ascending" | "descending" => {
    if (value === "ascending") {
      return "ascending";
    }
    return "descending";
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-134] UI label helper is intentionally a direct two-argument operation.
  sortLabel = (contentTypeId: string, newest: boolean): string => {
    if (contentTypeId === "post" || contentTypeId === "comment") {
      if (newest) {
        return "Newest first";
      }
      return "Oldest first";
    }
    if (newest) {
      return "Name Z–A";
    }
    return "Name A–Z";
  },
  statusOptions = (contentTypeId: string): readonly string[] => {
    if (contentTypeId === "post") {
      return ["draft", "published"];
    }
    return ["pending", "approved", "rejected"];
  },
  stringArrayValue = (value: unknown): string[] => {
    if (Array.isArray(value)) {
      return value.map(String);
    }
    return [];
  };

export {
  activeStatusClass,
  assetCaption,
  assetDimensions,
  assetSelectValue,
  deleteImageLabel,
  deletionStatus,
  dialogHeading,
  draftPluralSuffix,
  editorialButtonLabel,
  editorialConfirmationDescription,
  editorialConfirmationLabel,
  editorialStatus,
  entryDeletionTitle,
  entryOptionLabel,
  featuredAlternativeTextField,
  headingLevel,
  pendingCommentClass,
  publicationInputValue,
  publicationValue,
  purgeStatus,
  rebuildLabel,
  relatedContentType,
  revisionClass,
  revisionLabel,
  saveStatus,
  sortDirectionValue,
  sortLabel,
  statusOptions,
  stringArrayValue,
};
