import { InvalidInput, type ValidationIssue } from "./cms-error.ts";
import { type JsonObject, type JsonValue, isJsonValue } from "./internal/json.ts";

/** Stable identifier stored in every Nearly Headless CMS Rich Text document. */
export const format = "nearly-headless-cms/rich-text";
/** Current serialized Rich Text document format version. */
export const formatVersion = 1;

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
  readonly level: 2 | 3 | 4;
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

const coreNodeTypes = new Set([
    "text",
    "link",
    "entry-reference",
    "paragraph",
    "heading",
    "quote",
    "code-block",
    "ordered-list",
    "unordered-list",
    "list-item",
    "asset-reference",
  ]),
  makeIssue = (
    path: readonly (string | number)[],
    reason: string,
    message: string,
  ): ValidationIssue => ({ message, path, reason }),
  isObject = (value: unknown): value is Readonly<Record<string, unknown>> =>
    value !== null && typeof value === "object" && !Array.isArray(value),
  validateText = (
    node: Readonly<Record<string, unknown>>,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    const issues: ValidationIssue[] = [];
    if (typeof node["text"] !== "string") {
      issues.push(makeIssue([...path, "text"], "expectedText", "Text leaves require text"));
    }
    const { marks } = node;
    if (marks !== undefined) {
      if (
        !Array.isArray(marks) ||
        marks.some((mark) => !["bold", "italic", "code", "strikethrough"].includes(String(mark))) ||
        new Set(marks).size !== marks.length
      ) {
        issues.push(
          makeIssue(
            [...path, "marks"],
            "invalidMarks",
            "Marks must be distinct core semantic marks",
          ),
        );
      }
    }
    return issues;
  },
  validateInline = (
    node: unknown,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (!isObject(node) || typeof node["type"] !== "string") {
      return [makeIssue(path, "invalidNode", "Expected a Rich Text inline node")];
    }
    switch (node["type"]) {
      case "text": {
        return validateText(node, path);
      }
      case "link": {
        const issues: ValidationIssue[] = [];
        if (typeof node["url"] === "string") {
          if (!URL.canParse(node["url"])) {
            issues.push(makeIssue([...path, "url"], "expectedUrl", "Link URL is invalid"));
          }
        } else {
          issues.push(makeIssue([...path, "url"], "expectedUrl", "Link requires a URL"));
        }
        if (Array.isArray(node["children"])) {
          node["children"].forEach((child, index) =>
            issues.push(...validateTextChild(child, [...path, "children", index])),
          );
        } else {
          issues.push(
            makeIssue([...path, "children"], "expectedChildren", "Link requires text children"),
          );
        }
        return issues;
      }
      case "entry-reference": {
        const issues: ValidationIssue[] = [];
        if (typeof node["entryId"] !== "string" || node["entryId"].length === 0) {
          issues.push(
            makeIssue(
              [...path, "entryId"],
              "expectedEntryId",
              "Entry reference requires an Entry ID",
            ),
          );
        }
        if (!Array.isArray(node["children"]) || node["children"].length === 0) {
          issues.push(
            makeIssue(
              [...path, "children"],
              "requiredLabel",
              "Entry reference requires an authored label",
            ),
          );
        } else {
          node["children"].forEach((child, index) =>
            issues.push(...validateTextChild(child, [...path, "children", index])),
          );
        }
        return issues;
      }
      default: {
        return [makeIssue(path, "invalidInlineNode", `Node ${node["type"]} is not allowed inline`)];
      }
    }
  },
  validateTextChild = (
    node: unknown,
    path: readonly (string | number)[],
  ): readonly ValidationIssue[] => {
    if (!isObject(node) || node["type"] !== "text") {
      return [
        makeIssue(
          path,
          "expectedTextLeaf",
          "Links and Entry references can contain only text leaves",
        ),
      ];
    }
    return validateText(node, path);
  },
  validateBlock = (
    node: unknown,
    path: readonly (string | number)[],
    extensions: ReadonlyMap<string, Extension>,
  ): readonly ValidationIssue[] => {
    if (!isObject(node) || typeof node["type"] !== "string") {
      return [makeIssue(path, "invalidNode", "Expected a Rich Text block node")];
    }
    const issues: ValidationIssue[] = [];
    switch (node["type"]) {
      case "paragraph":
      case "heading": {
        if (node["type"] === "heading" && ![2, 3, 4].includes(Number(node["level"]))) {
          issues.push(
            makeIssue(
              [...path, "level"],
              "invalidHeadingLevel",
              "Heading level must be 2, 3, or 4",
            ),
          );
        }
        if (Array.isArray(node["children"])) {
          node["children"].forEach((child, index) =>
            issues.push(...validateInline(child, [...path, "children", index])),
          );
        } else {
          issues.push(
            makeIssue([...path, "children"], "expectedChildren", "Block requires inline children"),
          );
        }
        return issues;
      }
      case "quote": {
        if (!Array.isArray(node["children"]) || node["children"].length === 0) {
          return [
            makeIssue(
              [...path, "children"],
              "expectedParagraph",
              "Quote requires paragraph children",
            ),
          ];
        }
        node["children"].forEach((child, index) => {
          if (!isObject(child) || child["type"] !== "paragraph") {
            issues.push(
              makeIssue(
                [...path, "children", index],
                "expectedParagraph",
                "Quote children must be paragraphs",
              ),
            );
          } else {
            issues.push(...validateBlock(child, [...path, "children", index], extensions));
          }
        });
        return issues;
      }
      case "code-block": {
        if (!Array.isArray(node["children"])) {
          return [
            makeIssue([...path, "children"], "expectedTextLeaf", "Code block requires text leaves"),
          ];
        }
        node["children"].forEach((child, index) =>
          issues.push(...validateTextChild(child, [...path, "children", index])),
        );
        return issues;
      }
      case "ordered-list":
      case "unordered-list": {
        if (!Array.isArray(node["children"]) || node["children"].length === 0) {
          return [makeIssue([...path, "children"], "expectedListItem", "List requires List items")];
        }
        node["children"].forEach((child, index) => {
          const childPath = [...path, "children", index];
          if (
            !isObject(child) ||
            child["type"] !== "list-item" ||
            !Array.isArray(child["children"])
          ) {
            issues.push(
              makeIssue(childPath, "expectedListItem", "List children must be List items"),
            );
          } else {
            child["children"].forEach((listChild, listChildIndex) =>
              issues.push(
                ...validateBlock(listChild, [...childPath, "children", listChildIndex], extensions),
              ),
            );
          }
        });
        return issues;
      }
      case "asset-reference": {
        if (typeof node["assetId"] !== "string" || node["assetId"].length === 0)
          issues.push(
            makeIssue(
              [...path, "assetId"],
              "expectedAssetId",
              "Asset reference requires an Asset ID",
            ),
          );
        if (typeof node["alternativeText"] !== "string")
          issues.push(
            makeIssue(
              [...path, "alternativeText"],
              "expectedAlternativeText",
              "Asset reference requires authored alternative text",
            ),
          );
        if (node["caption"] !== undefined && typeof node["caption"] !== "string")
          issues.push(makeIssue([...path, "caption"], "expectedCaption", "Caption must be text"));
        if (!Array.isArray(node["children"]) || node["children"].length !== 0)
          issues.push(
            makeIssue(
              [...path, "children"],
              "assetReferenceIsAtomic",
              "Asset reference cannot contain children",
            ),
          );
        return issues;
      }
      default: {
        if (coreNodeTypes.has(node["type"])) {
          return [
            makeIssue(path, "invalidBlockNode", `Node ${node["type"]} is not allowed as a block`),
          ];
        }
        const { version } = node;
        const extension =
          typeof version === "number" ? extensions.get(`${node["type"]}@${version}`) : undefined;
        if (extension === undefined) {
          return [
            makeIssue(
              path,
              "unsupportedExtension",
              `Unsupported Rich Text extension ${node["type"]}@${String(version)}`,
            ),
          ];
        }
        if (isJsonValue(node["configuration"])) {
          issues.push(
            ...extension.validateConfiguration(node["configuration"]).map((extensionIssue) => ({
              ...extensionIssue,
              path: [...path, "configuration", ...extensionIssue.path],
            })),
          );
        } else {
          issues.push(
            makeIssue(
              [...path, "configuration"],
              "expectedJsonValue",
              "Extension configuration must be JSON-compatible",
            ),
          );
        }
        if (!Array.isArray(node["children"])) {
          issues.push(
            makeIssue(
              [...path, "children"],
              "expectedChildren",
              "Extension requires a children array",
            ),
          );
        } else if (extension.allowedChildren === "none" && node["children"].length > 0) {
          issues.push(
            makeIssue(
              [...path, "children"],
              "childrenNotAllowed",
              "Extension does not permit children",
            ),
          );
        } else if (extension.allowedChildren === "inline") {
          node["children"].forEach((child, index) =>
            issues.push(...validateInline(child, [...path, "children", index])),
          );
        } else if (extension.allowedChildren === "block") {
          node["children"].forEach((child, index) =>
            issues.push(...validateBlock(child, [...path, "children", index], extensions)),
          );
        }
        if (isJsonValue(node) && !Array.isArray(node)) {
          issues.push(
            ...extension.validateNode(node as unknown as ExtensionNode).map((extensionIssue) => ({
              ...extensionIssue,
              path: [...path, ...extensionIssue.path],
            })),
          );
        }
        return issues;
      }
    }
  };

/** Validates and normalizes a Rich Text value, rejecting unsupported content visibly. */
export const validate = (value: unknown, options: ValidationOptions = {}): Document => {
  if (
    !isObject(value) ||
    value["format"] !== format ||
    value["version"] !== formatVersion ||
    !Array.isArray(value["children"])
  ) {
    throw InvalidInput.make({ message: `Rich Text must use ${format} version ${formatVersion}` });
  }
  const extensions = new Map(
      (options.extensions ?? []).map((extension) => [
        `${extension.identifier}@${extension.version}`,
        extension,
      ]),
    ),
    issues = value["children"].flatMap((child, index) =>
      validateBlock(child, ["children", index], extensions),
    );
  if (issues.length > 0) {
    throw InvalidInput.make({ issues, message: issues[0]?.message ?? "Invalid Rich Text" });
  }
  return structuredClone(value) as unknown as Document;
};

/** Validates a typed Rich Text document and returns its JSON-compatible persisted form. */
/** Validates and converts a Rich Text document to a JSON-compatible persisted value. */
export const toJson = (document: Document, options: ValidationOptions = {}): JsonObject =>
  validate(document, options) as unknown as JsonObject;

/** All distinct live Entry and Asset identifiers reachable from a document. */
export interface References {
  readonly entryIds: readonly string[];
  readonly assetIds: readonly string[];
}

/** Collects live references in linear time over the Rich Text tree. */
export const references = (document: Document): References => {
  const entryIds: string[] = [],
    assetIds: string[] = [],
    visit = (node: Node): void => {
      if (node.type === "entry-reference") {
        entryIds.push(node.entryId);
      }
      if (node.type === "asset-reference") {
        assetIds.push(node.assetId);
      }
      if ("children" in node) {
        for (const child of node.children) visit(child);
      }
    };
  for (const child of document.children) {
    visit(child);
  }
  return { assetIds: [...new Set(assetIds)], entryIds: [...new Set(entryIds)] };
};

/** Content Client callbacks for visibly rendering every supported semantic node. */
export interface Renderer<Result> {
  readonly text: (node: TextNode) => Result;
  readonly link: (node: LinkNode, children: readonly Result[]) => Result;
  readonly entryReference: (node: EntryReferenceNode, children: readonly Result[]) => Result;
  readonly block: (node: Exclude<BlockNode, ExtensionNode>, children: readonly Result[]) => Result;
  readonly extension: (node: ExtensionNode, children: readonly Result[]) => Result;
}

/** Renders a validated document through a Content Client-owned Renderer. */
export const render = <Result>(
  document: Document,
  renderer: Renderer<Result>,
): readonly Result[] => {
  const renderNode = (node: Node): Result => {
    if (node.type === "text") {
      return renderer.text(node);
    }
    const children = "children" in node ? node.children.map(renderNode) : [];
    if (node.type === "link") {
      return renderer.link(node, children);
    }
    if (node.type === "entry-reference") {
      return renderer.entryReference(node, children);
    }
    if (coreNodeTypes.has(node.type)) {
      return renderer.block(node as Exclude<BlockNode, ExtensionNode>, children);
    }
    return renderer.extension(node as ExtensionNode, children);
  };
  return document.children.map(renderNode);
};
