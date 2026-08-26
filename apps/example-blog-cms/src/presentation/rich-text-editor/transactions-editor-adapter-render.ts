import type { RichText } from "nearly-headless-cms";
import { emptyIndex } from "./transactions-constants.ts";
import transactionsEditorAdapterSupport from "./transactions-editor-adapter-support.ts";
import transactionsSupport from "./transactions-support.ts";

type RenderBlock = (
  block: RichText.BlockNode,
  blockIndex?: number,
  listItemIndex?: number,
) => HTMLElement;

const { blockElementName } = transactionsEditorAdapterSupport,
  { conditionalValue } = transactionsSupport,
  applyTextMarks = (
    marks: readonly RichText.Mark[] | undefined,
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-229] DOM spans are mutated while applying rich-text marks.
    text: HTMLSpanElement,
  ): void => {
    if (marks?.includes("bold") === true) {
      text.style.fontWeight = "700";
    }
    if (marks?.includes("italic") === true) {
      text.style.fontStyle = "italic";
    }
    if (marks?.includes("code") === true) {
      text.className = "rich-inline-code";
    }
    if (marks?.includes("strikethrough") === true) {
      text.style.textDecoration = "line-through";
    }
  },
  assignTextSpanIndices = (
    // oxlint-disable-next-line typescript/prefer-readonly-parameter-types -- [EH-230] DOM spans are mutated while assigning editor selection indices.
    input: {
      readonly blockIndex: number;
      readonly inlineIndex: number;
      readonly listItemIndex: number | undefined;
      readonly text: HTMLSpanElement;
    },
  ): void => {
    const { blockIndex, inlineIndex, listItemIndex, text } = input;
    text.dataset["blockIndex"] = String(blockIndex);
    text.dataset["inlineIndex"] = String(inlineIndex);
    if (listItemIndex !== undefined) {
      text.dataset["listItemIndex"] = String(listItemIndex);
    }
  },
  isNestedBlockChild = (child: RichText.Node): child is RichText.BlockNode =>
    child.type === "paragraph" ||
    child.type === "heading" ||
    child.type === "quote" ||
    child.type === "code-block" ||
    child.type === "ordered-list" ||
    child.type === "unordered-list" ||
    child.type === "asset-reference",
  renderAssetReferenceBlock = (block: RichText.AssetReferenceNode): HTMLElement => {
    const element = document.createElement("figure"),
      label = document.createElement("strong");
    element.dataset["nodeType"] = block.type;
    element.contentEditable = "false";
    label.textContent = block.alternativeText || "Image without alternative text";
    element.append(label);
    if (block.caption !== undefined) {
      const caption = document.createElement("figcaption");
      caption.textContent = block.caption;
      element.append(caption);
    }
    return element;
  },
  renderBlockChildren = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    RenderBlockType extends RenderBlock,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      readonly block: RichText.BlockNode;
      readonly blockIndex: number | undefined;
      readonly element: HTMLElement;
      readonly listItemIndex: number | undefined;
      readonly renderBlock: RenderBlockType;
    },
  >({
    block,
    blockIndex,
    element,
    listItemIndex,
    renderBlock,
  }: Readonly<Input>): void => {
    if (!("children" in block)) {
      return;
    }
    for (const [inlineIndex, child] of block.children.entries()) {
      element.append(
        renderInlineChild({ blockIndex, child, inlineIndex, listItemIndex, renderBlock }),
      );
    }
  },
  renderBlockElement: RenderBlock = (block, blockIndex, listItemIndex) => {
    if (block.type === "asset-reference") {
      return renderAssetReferenceBlock(block);
    }
    const element = document.createElement(blockElementName(block));
    element.dataset["nodeType"] = block.type;
    renderBlockChildren({
      block,
      blockIndex,
      element,
      listItemIndex,
      renderBlock: renderBlockElement,
    });
    return element;
  },
  renderInlineChild = ({
    blockIndex,
    child,
    inlineIndex,
    listItemIndex,
    renderBlock,
  }: {
    readonly blockIndex: number | undefined;
    readonly child: RichText.Node;
    readonly inlineIndex: number;
    readonly listItemIndex: number | undefined;
    readonly renderBlock: RenderBlock;
  }): HTMLElement => {
    if (child.type === "text") {
      return renderTextSpan({ blockIndex, child, inlineIndex, listItemIndex });
    }
    if (isNestedBlockChild(child)) {
      return renderBlock(child, blockIndex, listItemIndex);
    }
    if (child.type === "link" || child.type === "entry-reference") {
      return renderLinkOrEntryReference(child);
    }
    if (child.type === "list-item") {
      return renderListItem({ blockIndex, child, listItemIndex: inlineIndex, renderBlock });
    }
    return renderUnsupportedInline((child as RichText.ExtensionNode).type);
  },
  renderLinkOrEntryReference = (
    child: Extract<RichText.InlineNode, { type: "entry-reference" | "link" }>,
  ): HTMLElement => {
    const inline = document.createElement(conditionalValue(child.type === "link", "a", "span"));
    inline.dataset["nodeType"] = child.type;
    if (child.type === "link") {
      inline.setAttribute("href", child.url);
    }
    for (const grandchild of child.children) {
      inline.append(document.createTextNode(grandchild.text));
    }
    return inline;
  },
  renderListItem = ({
    blockIndex,
    child,
    listItemIndex,
    renderBlock,
  }: {
    readonly blockIndex: number | undefined;
    readonly child: RichText.ListItemNode;
    readonly listItemIndex: number;
    readonly renderBlock: RenderBlock;
  }): HTMLElement => {
    const listItem = document.createElement("li");
    for (const grandchild of child.children) {
      listItem.append(renderBlock(grandchild, blockIndex, listItemIndex));
    }
    return listItem;
  },
  renderTextSpan = ({
    blockIndex,
    child,
    inlineIndex,
    listItemIndex,
  }: {
    readonly blockIndex: number | undefined;
    readonly child: RichText.TextNode;
    readonly inlineIndex: number;
    readonly listItemIndex: number | undefined;
  }): HTMLSpanElement => {
    const text = document.createElement("span");
    if (blockIndex !== undefined) {
      assignTextSpanIndices({ blockIndex, inlineIndex, listItemIndex, text });
    }
    text.textContent = conditionalValue(child.text.length === emptyIndex, "\u200B", child.text);
    applyTextMarks(child.marks, text);
    return text;
  },
  renderUnsupportedInline = (type: string): HTMLElement => {
    const unsupported = document.createElement("aside");
    unsupported.textContent = `Unsupported editor extension: ${type}`;
    return unsupported;
  };

export default {
  renderBlockElement,
};
