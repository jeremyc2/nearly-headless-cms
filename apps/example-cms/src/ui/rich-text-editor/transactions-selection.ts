import { emptyIndex, firstIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import type { State } from "./transactions-types.ts";
import transactionsSupport from "./transactions-support.ts";

const { asParagraph, conditionalValue } = transactionsSupport,
  buildSelectedTextContext = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      anchor: State["selection"]["anchor"];
      focus: State["selection"]["focus"];
      resolved: {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      };
      rootBlock: RichText.BlockNode;
    },
  >({
    anchor,
    focus,
    resolved,
    rootBlock,
  }: Readonly<Input>):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly end: number;
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly rootBlock: RichText.BlockNode;
        readonly start: number;
        readonly text: RichText.TextNode;
      }
    | undefined => {
    const node = resolved.block.children[anchor.inlineIndex];
    if (node?.type !== "text") {
      return undefined;
    }
    return {
      block: resolved.block,
      end: Math.max(anchor.offset, focus.offset),
      replace: resolved.replace,
      rootBlock,
      start: Math.min(anchor.offset, focus.offset),
      text: node,
    };
  },
  resolveListInlineBlock = (
    rootBlock: RichText.ListNode,
    listItemIndex: number,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      }
    | undefined => {
    const listItem = rootBlock.children[listItemIndex],
      paragraph = listItem?.children[emptyIndex];
    if (paragraph?.type !== "paragraph") {
      return undefined;
    }
    return {
      block: paragraph,
      replace: (replacement) => ({
        ...rootBlock,
        children: rootBlock.children.map((candidate, index) =>
          conditionalValue(
            index === listItemIndex,
            {
              ...candidate,
              children: [asParagraph(replacement), ...candidate.children.slice(firstIndex)],
            },
            candidate,
          ),
        ),
      }),
    };
  },
  resolveQuoteInlineBlock = (
    rootBlock: RichText.QuoteNode,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      }
    | undefined => {
    const [paragraph] = rootBlock.children;
    if (paragraph === undefined) {
      return undefined;
    }
    return {
      block: paragraph,
      replace: (replacement) => ({
        ...rootBlock,
        children: [asParagraph(replacement), ...rootBlock.children.slice(firstIndex)],
      }),
    };
  },
  resolveSelectedBlock = (
    rootBlock: RichText.BlockNode,
    listItemIndex: number,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          replacement: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
      }
    | undefined => {
    if (rootBlock.type === "paragraph" || rootBlock.type === "heading") {
      return { block: rootBlock, replace: (replacement) => replacement };
    }
    if (rootBlock.type === "quote") {
      return resolveQuoteInlineBlock(rootBlock);
    }
    if (rootBlock.type === "ordered-list" || rootBlock.type === "unordered-list") {
      return resolveListInlineBlock(rootBlock, listItemIndex);
    }
    return undefined;
  },
  resolveSelectedTextContext = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-139] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      anchor: State["selection"]["anchor"];
      focus: State["selection"]["focus"];
      rootBlock: RichText.BlockNode;
    },
  >({
    anchor,
    focus,
    rootBlock,
  }: Readonly<Input>):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly end: number;
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly rootBlock: RichText.BlockNode;
        readonly start: number;
        readonly text: RichText.TextNode;
      }
    | undefined => {
    const resolved = resolveSelectedBlock(rootBlock, anchor.listItemIndex ?? emptyIndex);
    if (resolved === undefined) {
      return undefined;
    }
    return buildSelectedTextContext({ anchor, focus, resolved, rootBlock });
  },
  selectedText = (
    state: State,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly end: number;
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly rootBlock: RichText.BlockNode;
        readonly start: number;
        readonly text: RichText.TextNode;
      }
    | undefined => {
    const { anchor, focus } = state.selection,
      rootBlock = state.document.children[anchor.blockIndex],
      sameInlineSelection =
        anchor.blockIndex === focus.blockIndex && anchor.inlineIndex === focus.inlineIndex;
    if (!sameInlineSelection || rootBlock === undefined) {
      return undefined;
    }
    return resolveSelectedTextContext({ anchor, focus, rootBlock });
  };

export type SelectedTextContext = NonNullable<ReturnType<typeof selectedText>>;
export { selectedText };
