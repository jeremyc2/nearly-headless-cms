import { type Command, type State, secondHeadingLevel } from "./transactions-types.ts";
import { emptyIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsSelection from "./transactions-selection.ts";
import transactionsState from "./transactions-state.ts";
import transactionsListCommandHandlers from "./transactions-list-command-handlers.ts";

const { readSelectedInlineRangeContext } = transactionsSelection,
  { liftCurrentListItem } = transactionsListCommandHandlers,
  { commit, replaceBlock } = transactionsState,
  buildBlockReplacement = (
    block: RichText.ParagraphNode | RichText.HeadingNode,
    command: Extract<Command, { type: "setBlockKind" }>,
  ): RichText.BlockNode => {
    if (command.blockType === "heading") {
      return {
        children: block.children,
        level: command.headingLevel ?? secondHeadingLevel,
        type: "heading",
      };
    }
    if (command.blockType === "paragraph") {
      return { children: block.children, type: "paragraph" };
    }
    if (command.blockType === "code-block") {
      return {
        children: [
          {
            text: block.children
              .map((node) => {
                if ("text" in node) {
                  return node.text;
                }
                return "";
              })
              .join(""),
            type: "text",
          },
        ],
        type: "code-block",
      };
    }
    return {
      children: [{ children: block.children, type: "paragraph" }],
      type: "quote",
    };
  },
  codeBlockToParagraph = (block: RichText.CodeBlockNode): RichText.ParagraphNode => ({
    children:
      block.children.length === emptyIndex
        ? [{ text: "", type: "text" }]
        : block.children.map((node) => ({ ...node })),
    type: "paragraph",
  }),
  applySetBlockKindAtRoot = (input: {
    readonly blockIndex: number;
    readonly command: Extract<Command, { type: "setBlockKind" }>;
    readonly rootBlock: RichText.ParagraphNode | RichText.HeadingNode;
    readonly state: State;
  }): State =>
    commit(
      input.state,
      replaceBlock(
        input.state.document,
        input.blockIndex,
        buildBlockReplacement(input.rootBlock, input.command),
      ),
    ),
  applySetBlockKindForCodeBlock = (input: {
    readonly blockIndex: number;
    readonly command: Extract<Command, { type: "setBlockKind" }>;
    readonly rootBlock: RichText.CodeBlockNode;
    readonly state: State;
  }): State => {
    if (input.command.blockType !== "paragraph") {
      return input.state;
    }
    return commit(
      input.state,
      replaceBlock(input.state.document, input.blockIndex, codeBlockToParagraph(input.rootBlock)),
    );
  },
  applyLiftedListItemBlockKind = (
    state: State,
    command: Extract<Command, { type: "setBlockKind" }>,
  ): State => {
    const lifted = liftCurrentListItem(state);
    if (lifted === undefined) {
      return state;
    }
    const liftedBlock = lifted.document.children[lifted.selection.anchor.blockIndex];
    if (liftedBlock?.type !== "paragraph" && liftedBlock?.type !== "heading") {
      return state;
    }
    return applySetBlockKindAtRoot({
      blockIndex: lifted.selection.anchor.blockIndex,
      command,
      rootBlock: liftedBlock,
      state: lifted,
    });
  },
  applyInlineContainerParagraphKind = (input: {
    readonly blockIndex: number;
    readonly command: Extract<Command, { type: "setBlockKind" }>;
    readonly replace: (
      block: RichText.ParagraphNode | RichText.HeadingNode,
    ) => RichText.BlockNode;
    readonly resolvedBlock: RichText.ParagraphNode | RichText.HeadingNode;
    readonly state: State;
  }): State => {
    const replacement = buildBlockReplacement(input.resolvedBlock, input.command);
    if (replacement.type !== "paragraph" && replacement.type !== "heading") {
      return input.state;
    }
    return commit(
      input.state,
      replaceBlock(input.state.document, input.blockIndex, input.replace(replacement)),
    );
  },
  applySetBlockKindForInlineContainer = (input: {
    readonly blockIndex: number;
    readonly command: Extract<Command, { type: "setBlockKind" }>;
    readonly state: State;
  }): State => {
    const context = readSelectedInlineRangeContext(input.state);
    if (context === undefined) {
      return input.state;
    }
    const { replace, resolvedBlock } = context;
    if (resolvedBlock.type !== "paragraph" && resolvedBlock.type !== "heading") {
      return input.state;
    }
    if (input.command.blockType === "quote" || input.command.blockType === "code-block") {
      return applyLiftedListItemBlockKind(input.state, input.command);
    }
    return applyInlineContainerParagraphKind({
      blockIndex: input.blockIndex,
      command: input.command,
      replace,
      resolvedBlock,
      state: input.state,
    });
  },
  applySetBlockKindForQuote = (input: {
    readonly blockIndex: number;
    readonly command: Extract<Command, { type: "setBlockKind" }>;
    readonly quote: RichText.QuoteNode;
    readonly state: State;
  }): State => {
    const inner = input.quote.children[emptyIndex];
    if (inner?.type !== "paragraph" && inner?.type !== "heading") {
      return input.state;
    }
    if (input.command.blockType === "quote") {
      return input.state;
    }
    return commit(
      input.state,
      replaceBlock(
        input.state.document,
        input.blockIndex,
        buildBlockReplacement(inner, input.command),
      ),
    );
  },
  applySetBlockKindForRootBlock = (input: {
    readonly blockIndex: number;
    readonly command: Extract<Command, { type: "setBlockKind" }>;
    readonly rootBlock: RichText.BlockNode;
    readonly state: State;
  }): State => {
    if (input.rootBlock.type === "code-block") {
      return applySetBlockKindForCodeBlock({
        blockIndex: input.blockIndex,
        command: input.command,
        rootBlock: input.rootBlock,
        state: input.state,
      });
    }
    if (input.rootBlock.type === "quote") {
      return applySetBlockKindForQuote({
        blockIndex: input.blockIndex,
        command: input.command,
        quote: input.rootBlock,
        state: input.state,
      });
    }
    if (input.rootBlock.type === "ordered-list" || input.rootBlock.type === "unordered-list") {
      return applySetBlockKindForInlineContainer({
        blockIndex: input.blockIndex,
        command: input.command,
        state: input.state,
      });
    }
    if (input.rootBlock.type === "paragraph" || input.rootBlock.type === "heading") {
      return applySetBlockKindAtRoot({
        blockIndex: input.blockIndex,
        command: input.command,
        rootBlock: input.rootBlock,
        state: input.state,
      });
    }
    return input.state;
  },
  applySetBlockKind = (
    state: State,
    command: Extract<Command, { type: "setBlockKind" }>,
  ): State => {
    const {blockIndex} = state.selection.anchor,
      rootBlock = state.document.children[blockIndex];
    if (rootBlock === undefined) {
      return state;
    }
    return applySetBlockKindForRootBlock({ blockIndex, command, rootBlock, state });
  };

export default { applySetBlockKind, buildBlockReplacement };
