/* oxlint-disable effecttsgo/missing-pipeable-signature -- Rich Text helpers are not pipeable Effect APIs. */
import * as Function from "effect/Function";
import { InvalidInput, type ValidationIssue } from "./cms-error.ts";
import { type JsonObject, type JsonValue, isJsonObject } from "./internal/json.ts";
import blockValidation from "./rich-text-validation-block.ts";
import rendering from "./rich-text-rendering.ts";

const emptyLength = 0,
  format = "nearly-headless-cms/rich-text",
  formatVersion = 1,
  serializeRichTextDocumentImpl = (
    document: Document,
    options: ValidationOptions = {},
  ): JsonObject => {
    validateDocumentImpl(document, options);
    if (!isJsonObject(document)) {
      throw InvalidInput.make({ message: "Rich Text document is not JSON-compatible" });
    }
    return document;
  },
  validateDocumentImpl = (value: unknown, options: ValidationOptions = {}): Document => {
    if (
      !blockValidation.isObject(value) ||
      value["format"] !== format ||
      value["version"] !== formatVersion ||
      !Array.isArray(value["children"])
    ) {
      throw InvalidInput.make({
        message: `Rich Text must use ${format} version ${formatVersion}`,
      });
    }
    const extensions = new Map(
        (options.extensions ?? []).map((extension) => [
          `${extension.identifier}@${extension.version}`,
          extension,
        ]),
      ),
      issues = value["children"].flatMap((child, index) =>
        blockValidation.validateBlock(child, ["children", index], extensions),
      );
    if (issues.length > emptyLength) {
      throw InvalidInput.make({
        issues,
        message: issues.at(emptyLength)?.message ?? "Invalid Rich Text",
      });
    }
    return structuredClone({
      children: value["children"],
      format,
      version: formatVersion,
    });
  },

 dualInputArity = 2,
  headingLevelFour = 4,
  headingLevelThree = 3,
  headingLevelTwo = 2,
  headingLevels = [headingLevelTwo, headingLevelThree, headingLevelFour] as const,
  parseRichTextDocument = validateDocumentImpl,
  /** Collects live references in linear time over the Rich Text tree. */
  references = (document: Document): References => rendering.collectReferences(document),
  /** Renders a validated document through a Content Client-owned Renderer. */
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
  render = Function.dual(
    dualInputArity,
    <Result>(document: Document, renderer: Renderer<Result>): readonly Result[] =>
      rendering.renderDocument(document, renderer),
  ),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- public serialize helper is not a pipeable Effect API.
  serializeRichTextDocument = serializeRichTextDocumentImpl,
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
  toJsonDual = Function.dual(
    (arguments_) =>
      arguments_.length === dualInputArity || blockValidation.isObject(arguments_[0]),
    serializeRichTextDocumentImpl,
  ),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- dual's generic overload is not inferred by the linter for this public helper.
  validateDual = Function.dual(
    (arguments_) =>
      arguments_.length === dualInputArity || blockValidation.isObject(arguments_[0]),
    validateDocumentImpl,
  );

/** The closed core vocabulary of semantic inline text marks. */
export type Mark = "bold" | "italic" | "code" | "strikethrough";

/** A text leaf with canonicalized semantic marks. */
export interface TextNode {
  readonly type: "text";
  readonly text: string;
  readonly marks?: readonly Mark[];
}

/** An external link with validated non-nested inline children. */
export interface LinkNode {
  readonly type: "link";
  readonly url: string;
  readonly children: readonly TextNode[];
}

/** A live Entry reference whose children provide its authored label. */
export interface EntryReferenceNode {
  readonly type: "entry-reference";
  readonly entryId: string;
  readonly children: readonly TextNode[];
}

/** Every node permitted in an inline Rich Text position. */
export type InlineNode = TextNode | LinkNode | EntryReferenceNode;

/** A paragraph block containing inline children. */
export interface ParagraphNode {
  readonly type: "paragraph";
  readonly children: readonly InlineNode[];
}

/** A semantic heading block at levels two through four. */
export interface HeadingNode {
  readonly type: "heading";
  readonly level: (typeof headingLevels)[number];
  readonly children: readonly InlineNode[];
}

/** A quotation block containing inline children. */
export interface QuoteNode {
  readonly type: "quote";
  readonly children: readonly ParagraphNode[];
}

/** A literal code block whose text has no inline structure. */
export interface CodeBlockNode {
  readonly type: "code-block";
  readonly language?: string;
  readonly children: readonly TextNode[];
}

/** One ordered or unordered list item containing block children. */
export interface ListItemNode {
  readonly type: "list-item";
  readonly children: readonly (ParagraphNode | ListNode)[];
}

/** An ordered or unordered list block. */
export interface ListNode {
  readonly type: "ordered-list" | "unordered-list";
  readonly children: readonly ListItemNode[];
}

/** An atomic live Asset reference with authored accessible text and caption. */
export interface AssetReferenceNode {
  readonly type: "asset-reference";
  readonly assetId: string;
  readonly alternativeText: string;
  readonly caption?: string;
  readonly children: readonly [];
}

/** A versioned Builder-defined semantic Rich Text node. */
export interface ExtensionNode {
  readonly type: `${string}.${string}`;
  readonly version: number;
  readonly configuration: JsonValue;
  readonly children: readonly Node[];
}

/** Every node permitted at the Rich Text document block level. */
export type BlockNode =
  | ParagraphNode
  | HeadingNode
  | QuoteNode
  | CodeBlockNode
  | ListNode
  | AssetReferenceNode
  | ExtensionNode;
/** Every node in the Rich Text semantic tree. */
export type Node = InlineNode | BlockNode | ListItemNode;

/** A versioned semantic Rich Text document with no presentation or editor state. */
export interface Document {
  readonly format: typeof format;
  readonly version: typeof formatVersion;
  readonly children: readonly BlockNode[];
}

/** Runtime validation and rendering contract for one Extension version. */
export interface Extension {
  readonly identifier: string;
  readonly version: number;
  readonly allowedChildren: "none" | "inline" | "block";
  readonly referenceBehavior: "none" | "entry" | "asset";
  readonly validateConfiguration: (configuration: JsonValue) => readonly ValidationIssue[];
  readonly validateNode: (node: ExtensionNode) => readonly ValidationIssue[];
}

/** Registered Extensions and live-reference checks used during validation. */
export interface ValidationOptions {
  readonly extensions?: readonly Extension[];
}

/** All distinct live Entry and Asset identifiers reachable from a document. */
export interface References {
  readonly entryIds: readonly string[];
  readonly assetIds: readonly string[];
}

/** Content Client callbacks for visibly rendering every supported semantic node. */
export interface Renderer<Result> {
  readonly text: (node: TextNode) => Result;
  readonly link: (node: LinkNode, children: readonly Result[]) => Result;
  readonly entryReference: (node: EntryReferenceNode, children: readonly Result[]) => Result;
  readonly block: (
    node: Exclude<BlockNode, ExtensionNode> | ListItemNode,
    children: readonly Result[],
  ) => Result;
  readonly extension: (node: ExtensionNode, children: readonly Result[]) => Result;
}

export {
  emptyLength,
  format,
  formatVersion,
  headingLevels,
  references,
  render,
  validateDual as validate,
  toJsonDual as toJson,
  parseRichTextDocument,
  serializeRichTextDocument,
};
