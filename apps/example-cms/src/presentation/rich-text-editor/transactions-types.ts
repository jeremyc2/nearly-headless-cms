import type { RichText } from "nearly-headless-cms";

export const fourthHeadingLevel = 4,
  secondHeadingLevel = 2,
  thirdHeadingLevel = 3;

export type HeadingLevel =
  | typeof secondHeadingLevel
  | typeof thirdHeadingLevel
  | typeof fourthHeadingLevel;

export interface Position {
  readonly blockIndex: number;
  readonly inlineIndex: number;
  readonly listItemIndex?: number;
  readonly offset: number;
}

export interface Selection {
  readonly anchor: Position;
  readonly focus: Position;
}

export interface State {
  readonly document: RichText.Document;
  readonly selection: Selection;
  readonly storedMarks: readonly RichText.Mark[] | null;
  readonly history: readonly RichText.Document[];
  readonly historyIndex: number;
  readonly cleanSignature: string;
  readonly composing: boolean;
}

export type Command =
  | { readonly type: "select"; readonly anchor: Position; readonly focus: Position }
  | { readonly type: "insertText"; readonly text: string }
  | { readonly type: "deleteBackward" }
  | { readonly type: "deleteForward" }
  | { readonly type: "splitBlock" }
  | {
      readonly type: "toggleList";
      readonly listType: "ordered-list" | "unordered-list";
    }
  | {
      readonly type: "setBlockKind";
      readonly blockType: "paragraph" | "heading" | "quote" | "code-block";
      readonly headingLevel?: HeadingLevel;
    }
  | { readonly type: "toggleMark"; readonly mark: RichText.Mark }
  | { readonly type: "wrapLink"; readonly url: string; readonly label?: string }
  | {
      readonly type: "insertEntryReference";
      readonly entryId: string;
      readonly label?: string;
    }
  | {
      readonly type: "insertAssetReference";
      readonly alternativeText: string;
      readonly assetId: string;
      readonly caption?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "composition"; readonly active: boolean };
