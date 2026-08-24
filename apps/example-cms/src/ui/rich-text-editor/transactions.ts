import { RichText } from "nearly-headless-cms";

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
  readonly pendingMarks: readonly RichText.Mark[];
  readonly history: readonly RichText.Document[];
  readonly historyIndex: number;
  readonly cleanSignature: string;
  readonly composing: boolean;
}

export type Command =
  | { readonly type: "select"; readonly anchor: Position; readonly focus: Position }
  | { readonly type: "insertText"; readonly text: string }
  | { readonly type: "deleteBackward" }
  | { readonly type: "splitBlock" }
  | { readonly type: "toggleList"; readonly listType: "ordered-list" | "unordered-list" }
  | {
      readonly type: "setBlockKind";
      readonly blockType: "paragraph" | "heading" | "quote" | "code-block";
      readonly headingLevel?: 2 | 3 | 4;
    }
  | { readonly type: "toggleMark"; readonly mark: RichText.Mark }
  | { readonly type: "wrapLink"; readonly url: string; readonly label?: string }
  | { readonly type: "insertEntryReference"; readonly entryId: string; readonly label?: string }
  | {
      readonly type: "insertAssetReference";
      readonly assetId: string;
      readonly alternativeText: string;
      readonly caption?: string;
    }
  | { readonly type: "undo" }
  | { readonly type: "redo" }
  | { readonly type: "composition"; readonly active: boolean };

const emptyParagraph = (): RichText.ParagraphNode => ({
    children: [{ text: "", type: "text" }],
    type: "paragraph",
  }),
  emptyDocument = (): RichText.Document => ({
    children: [emptyParagraph()],
    format: RichText.format,
    version: RichText.formatVersion,
  }),
  signature = (document: RichText.Document): string => JSON.stringify(document),
  marksEqual = (
    leftMarks: readonly RichText.Mark[] | undefined,
    rightMarks: readonly RichText.Mark[] | undefined,
  ): boolean => JSON.stringify(leftMarks ?? []) === JSON.stringify(rightMarks ?? []),
  markOrder: readonly RichText.Mark[] = ["bold", "italic", "code", "strikethrough"],
  canonicalMarks = (marks: readonly RichText.Mark[]): readonly RichText.Mark[] =>
    markOrder.filter((mark) => marks.includes(mark)),
  normalizeInlineNodes = (
    nodes: readonly RichText.InlineNode[],
  ): readonly RichText.InlineNode[] => {
    const normalized: RichText.InlineNode[] = [];
    for (const node of nodes) {
      if (node.type === "text" && node.text.length === 0 && nodes.length > 1) {
        continue;
      }
      const previous = normalized.at(-1);
      if (
        node.type === "text" &&
        previous?.type === "text" &&
        marksEqual(previous.marks, node.marks)
      ) {
        normalized[normalized.length - 1] = {
          text: `${previous.text}${node.text}`,
          type: "text",
          ...((node.marks?.length ?? 0) === 0 ? {} : { marks: canonicalMarks(node.marks!) }),
        };
      } else if (node.type === "text") {
        normalized.push({
          text: node.text,
          type: "text",
          ...((node.marks?.length ?? 0) === 0 ? {} : { marks: canonicalMarks(node.marks!) }),
        });
      } else {
        normalized.push(structuredClone(node));
      }
    }
    return normalized.length === 0 ? [{ text: "", type: "text" }] : normalized;
  };

export const normalize = (document: RichText.Document): RichText.Document => {
  const children = document.children.map((block): RichText.BlockNode => {
    if (block.type === "paragraph") {
      return { ...block, children: normalizeInlineNodes(block.children) };
    }
    if (block.type === "heading") {
      return {
        ...block,
        children: normalizeInlineNodes(block.children),
        level: [2, 3, 4].includes(block.level) ? block.level : 2,
      };
    }
    return structuredClone(block);
  });
  return {
    children: children.length === 0 ? [emptyParagraph()] : children,
    format: RichText.format,
    version: RichText.formatVersion,
  };
};

const selectedText = (
    state: State,
  ):
    | {
        readonly block: RichText.ParagraphNode | RichText.HeadingNode;
        readonly replace: (
          block: RichText.ParagraphNode | RichText.HeadingNode,
        ) => RichText.BlockNode;
        readonly rootBlock: RichText.BlockNode;
        readonly text: RichText.TextNode;
        readonly start: number;
        readonly end: number;
      }
    | undefined => {
    const { anchor, focus } = state.selection;
    if (anchor.blockIndex !== focus.blockIndex || anchor.inlineIndex !== focus.inlineIndex) {
      return undefined;
    }
    const rootBlock = state.document.children[anchor.blockIndex];
    if (rootBlock === undefined) {
      return undefined;
    }
    let block: RichText.ParagraphNode | RichText.HeadingNode,
      replace: (replacement: RichText.ParagraphNode | RichText.HeadingNode) => RichText.BlockNode;
    if (rootBlock.type === "paragraph" || rootBlock.type === "heading") {
      block = rootBlock;
      replace = (replacement) => replacement;
    } else if (rootBlock.type === "quote") {
      const paragraph = rootBlock.children[0];
      if (paragraph === undefined) {
        return undefined;
      }
      block = paragraph;
      replace = (replacement) => ({
        ...rootBlock,
        children: [
          replacement.type === "paragraph"
            ? replacement
            : { children: replacement.children, type: "paragraph" },
          ...rootBlock.children.slice(1),
        ],
      });
    } else if (rootBlock.type === "ordered-list" || rootBlock.type === "unordered-list") {
      const listItemIndex = anchor.listItemIndex ?? 0,
        listItem = rootBlock.children[listItemIndex],
        paragraph = listItem?.children[0];
      if (paragraph?.type !== "paragraph") {
        return undefined;
      }
      block = paragraph;
      replace = (replacement) => ({
        ...rootBlock,
        children: rootBlock.children.map((candidate, index) =>
          index === listItemIndex
            ? {
                ...candidate,
                children: [
                  replacement.type === "paragraph"
                    ? replacement
                    : { children: replacement.children, type: "paragraph" },
                  ...candidate.children.slice(1),
                ],
              }
            : candidate,
        ),
      });
    } else {
      return undefined;
    }
    const node = block.children[anchor.inlineIndex];
    if (node?.type !== "text") {
      return undefined;
    }
    return {
      block,
      end: Math.max(anchor.offset, focus.offset),
      start: Math.min(anchor.offset, focus.offset),
      text: node,
      replace,
      rootBlock,
    };
  },
  replaceBlock = (
    document: RichText.Document,
    blockIndex: number,
    block: RichText.BlockNode,
  ): RichText.Document => ({
    ...document,
    children: document.children.map((candidate, index) =>
      index === blockIndex ? block : candidate,
    ),
  }),
  commit = (state: State, document: RichText.Document, selection = state.selection): State => {
    const normalized = normalize(document);
    if (signature(normalized) === signature(state.document)) {
      return { ...state, selection };
    }
    const retainedHistory = state.history.slice(0, state.historyIndex + 1),
      nextHistory = [...retainedHistory, normalized].slice(-100);
    return {
      ...state,
      document: normalized,
      history: nextHistory,
      historyIndex: nextHistory.length - 1,
      selection,
    };
  };

export const create = (document: RichText.Document = emptyDocument()): State => {
  const normalized = normalize(RichText.validate(document));
  return {
    cleanSignature: signature(normalized),
    composing: false,
    document: normalized,
    history: [normalized],
    historyIndex: 0,
    pendingMarks: [],
    selection: {
      anchor: { blockIndex: 0, inlineIndex: 0, offset: 0 },
      focus: { blockIndex: 0, inlineIndex: 0, offset: 0 },
    },
  };
};

export const load = (document: RichText.Document): State => create(document);
export const markClean = (state: State): State => ({
  ...state,
  cleanSignature: signature(state.document),
});
export const isDirty = (state: State): boolean =>
  signature(state.document) !== state.cleanSignature;
export const persistedDocument = (state: State): RichText.Document =>
  structuredClone(state.document);

const insertText = (state: State, text: string): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    const position = state.selection.anchor,
      replacement: RichText.TextNode = {
        text: `${selected.text.text.slice(0, selected.start)}${text}${selected.text.text.slice(selected.end)}`,
        type: "text",
        ...((selected.text.marks?.length ?? 0) > 0
          ? { marks: selected.text.marks }
          : state.pendingMarks.length > 0
            ? { marks: state.pendingMarks }
            : {}),
      },
      children = selected.block.children.map((node, index) =>
        index === position.inlineIndex ? replacement : node,
      ),
      block = { ...selected.block, children } as RichText.ParagraphNode | RichText.HeadingNode,
      offset = selected.start + text.length,
      selection = { anchor: { ...position, offset }, focus: { ...position, offset } };
    return commit(
      state,
      replaceBlock(state.document, position.blockIndex, selected.replace(block)),
      selection,
    );
  },
  toggleMark = (state: State, mark: RichText.Mark): State => {
    const selected = selectedText(state);
    if (selected === undefined || selected.start === selected.end) {
      const pendingMarks = state.pendingMarks.includes(mark)
        ? state.pendingMarks.filter((candidate) => candidate !== mark)
        : canonicalMarks([...state.pendingMarks, mark]);
      return { ...state, pendingMarks };
    }
    const position = state.selection.anchor,
      activeMarks = selected.text.marks ?? [],
      nextMarks = activeMarks.includes(mark)
        ? activeMarks.filter((candidate) => candidate !== mark)
        : canonicalMarks([...activeMarks, mark]),
      replacement: RichText.TextNode[] = [
        ...(selected.start === 0
          ? []
          : [
              {
                text: selected.text.text.slice(0, selected.start),
                type: "text" as const,
                ...(activeMarks.length === 0 ? {} : { marks: activeMarks }),
              },
            ]),
        {
          text: selected.text.text.slice(selected.start, selected.end),
          type: "text",
          ...(nextMarks.length === 0 ? {} : { marks: nextMarks }),
        },
        ...(selected.end === selected.text.text.length
          ? []
          : [
              {
                text: selected.text.text.slice(selected.end),
                type: "text" as const,
                ...(activeMarks.length === 0 ? {} : { marks: activeMarks }),
              },
            ]),
      ],
      children = selected.block.children.flatMap((node, index) =>
        index === position.inlineIndex ? replacement : [node],
      );
    return commit(
      state,
      replaceBlock(
        state.document,
        position.blockIndex,
        selected.replace({ ...selected.block, children }),
      ),
    );
  },
  splitBlock = (state: State): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    const position = state.selection.anchor,
      before: RichText.TextNode = {
        ...selected.text,
        text: selected.text.text.slice(0, selected.start),
      },
      after: RichText.TextNode = { ...selected.text, text: selected.text.text.slice(selected.end) },
      firstBlock = { ...selected.block, children: [before] } as
        | RichText.ParagraphNode
        | RichText.HeadingNode,
      secondBlock: RichText.ParagraphNode = { children: [after], type: "paragraph" },
      rootBlock = selected.rootBlock;
    if (rootBlock.type === "ordered-list" || rootBlock.type === "unordered-list") {
      const listItemIndex = position.listItemIndex ?? 0,
        nextList: RichText.ListNode = {
          ...rootBlock,
          children: rootBlock.children.flatMap((listItem, index) =>
            index === listItemIndex
              ? [
                  { children: [{ ...secondBlock, children: [before] }], type: "list-item" },
                  { children: [secondBlock], type: "list-item" },
                ]
              : [listItem],
          ),
        },
        nextPosition = {
          blockIndex: position.blockIndex,
          inlineIndex: 0,
          listItemIndex: listItemIndex + 1,
          offset: 0,
        };
      return commit(state, replaceBlock(state.document, position.blockIndex, nextList), {
        anchor: nextPosition,
        focus: nextPosition,
      });
    }
    const children = [
        ...state.document.children.slice(0, position.blockIndex),
        firstBlock,
        secondBlock,
        ...state.document.children.slice(position.blockIndex + 1),
      ],
      nextPosition = { blockIndex: position.blockIndex + 1, inlineIndex: 0, offset: 0 };
    return commit(
      state,
      { ...state.document, children },
      { anchor: nextPosition, focus: nextPosition },
    );
  },
  insertReference = (
    state: State,
    reference: RichText.EntryReferenceNode | RichText.LinkNode,
  ): State => {
    const selected = selectedText(state);
    if (selected === undefined) {
      return state;
    }
    const position = state.selection.anchor,
      before = selected.text.text.slice(0, selected.start),
      after = selected.text.text.slice(selected.end),
      replacement: RichText.InlineNode[] = [
        ...(before.length === 0 ? [] : [{ ...selected.text, text: before }]),
        reference,
        ...(after.length === 0 ? [] : [{ ...selected.text, text: after }]),
      ],
      children = selected.block.children.flatMap((node, index) =>
        index === position.inlineIndex ? replacement : [node],
      );
    return commit(
      state,
      replaceBlock(
        state.document,
        position.blockIndex,
        selected.replace({ ...selected.block, children }),
      ),
    );
  };

export const transact = (state: State, command: Command): State => {
  switch (command.type) {
    case "select": {
      return { ...state, selection: { anchor: command.anchor, focus: command.focus } };
    }
    case "insertText": {
      return insertText(state, command.text);
    }
    case "deleteBackward": {
      const selected = selectedText(state);
      if (selected === undefined) {
        return state;
      }
      if (
        selected.start === 0 &&
        selected.end === 0 &&
        (selected.rootBlock.type === "ordered-list" || selected.rootBlock.type === "unordered-list")
      ) {
        const listItemIndex = state.selection.anchor.listItemIndex ?? 0,
          paragraph: RichText.ParagraphNode = {
            children: selected.block.children,
            type: "paragraph",
          },
          remainingItems = selected.rootBlock.children.filter(
            (_, index) => index !== listItemIndex,
          ),
          replacement = [
            ...state.document.children.slice(0, state.selection.anchor.blockIndex),
            ...(remainingItems.length === 0
              ? []
              : [{ ...selected.rootBlock, children: remainingItems }]),
            paragraph,
            ...state.document.children.slice(state.selection.anchor.blockIndex + 1),
          ],
          nextBlockIndex =
            state.selection.anchor.blockIndex + (remainingItems.length === 0 ? 0 : 1),
          position = { blockIndex: nextBlockIndex, inlineIndex: 0, offset: 0 };
        return commit(
          state,
          { ...state.document, children: replacement },
          { anchor: position, focus: position },
        );
      }
      const start =
          selected.start === selected.end ? Math.max(0, selected.start - 1) : selected.start,
        selection = {
          anchor: { ...state.selection.anchor, offset: start },
          focus: { ...state.selection.focus, offset: selected.end },
        };
      return insertText({ ...state, selection }, "");
    }
    case "splitBlock": {
      return splitBlock(state);
    }
    case "toggleList": {
      const { blockIndex } = state.selection.anchor,
        rootBlock = state.document.children[blockIndex];
      if (rootBlock === undefined) {
        return state;
      }
      if (rootBlock.type === "ordered-list" || rootBlock.type === "unordered-list") {
        if (rootBlock.type !== command.listType) {
          return commit(
            state,
            replaceBlock(state.document, blockIndex, {
              ...rootBlock,
              type: command.listType,
            }),
          );
        }
        const listItemIndex = state.selection.anchor.listItemIndex ?? 0,
          paragraph = rootBlock.children[listItemIndex]?.children[0];
        if (paragraph?.type !== "paragraph") {
          return state;
        }
        const remainingItems = rootBlock.children.filter((_, index) => index !== listItemIndex),
          children = [
            ...state.document.children.slice(0, blockIndex),
            ...(remainingItems.length === 0 ? [] : [{ ...rootBlock, children: remainingItems }]),
            paragraph,
            ...state.document.children.slice(blockIndex + 1),
          ],
          nextBlockIndex = blockIndex + (remainingItems.length === 0 ? 0 : 1),
          position = {
            blockIndex: nextBlockIndex,
            inlineIndex: state.selection.anchor.inlineIndex,
            offset: state.selection.anchor.offset,
          };
        return commit(
          state,
          { ...state.document, children },
          { anchor: position, focus: position },
        );
      }
      if (rootBlock.type !== "paragraph" && rootBlock.type !== "heading") {
        return state;
      }
      const list: RichText.ListNode = {
          children: [
            {
              children: [{ children: rootBlock.children, type: "paragraph" }],
              type: "list-item",
            },
          ],
          type: command.listType,
        },
        position = {
          ...state.selection.anchor,
          listItemIndex: 0,
        },
        focus = {
          ...state.selection.focus,
          listItemIndex: 0,
        };
      return commit(state, replaceBlock(state.document, blockIndex, list), {
        anchor: position,
        focus,
      });
    }
    case "setBlockKind": {
      const { blockIndex } = state.selection.anchor;
      const block = state.document.children[blockIndex];
      if (block?.type !== "paragraph" && block?.type !== "heading") {
        return state;
      }
      const replacement: RichText.BlockNode =
        command.blockType === "heading"
          ? { children: block.children, level: command.headingLevel ?? 2, type: "heading" }
          : command.blockType === "paragraph"
            ? { children: block.children, type: "paragraph" }
            : command.blockType === "code-block"
              ? {
                  children: [
                    {
                      text: block.children
                        .map((node) => (node.type === "text" ? node.text : ""))
                        .join(""),
                      type: "text",
                    },
                  ],
                  type: "code-block",
                }
              : { children: [{ children: block.children, type: "paragraph" }], type: "quote" };
      return commit(state, replaceBlock(state.document, blockIndex, replacement));
    }
    case "toggleMark": {
      return toggleMark(state, command.mark);
    }
    case "wrapLink": {
      const selected = selectedText(state);
      if (selected === undefined) {
        return state;
      }
      const label =
        selected.start === selected.end
          ? (command.label ?? "")
          : selected.text.text.slice(selected.start, selected.end);
      if (label.length === 0) {
        return state;
      }
      return insertReference(state, {
        children: [
          {
            text: label,
            type: "text",
            ...(selected.text.marks === undefined ? {} : { marks: selected.text.marks }),
          },
        ],
        type: "link",
        url: command.url,
      });
    }
    case "insertEntryReference": {
      const selected = selectedText(state);
      if (selected === undefined) {
        return state;
      }
      const label =
        selected.start === selected.end
          ? (command.label ?? "")
          : selected.text.text.slice(selected.start, selected.end);
      if (label.length === 0) {
        return state;
      }
      return insertReference(state, {
        children: [{ text: label, type: "text" }],
        entryId: command.entryId,
        type: "entry-reference",
      });
    }
    case "insertAssetReference": {
      const asset: RichText.AssetReferenceNode = {
          type: "asset-reference",
          assetId: command.assetId,
          alternativeText: command.alternativeText,
          ...(command.caption === undefined ? {} : { caption: command.caption }),
          children: [],
        },
        { blockIndex } = state.selection.focus;
      const children = [
          ...state.document.children.slice(0, blockIndex + 1),
          asset,
          ...state.document.children.slice(blockIndex + 1),
        ],
        position = { blockIndex: blockIndex + 1, inlineIndex: 0, offset: 0 };
      return commit(state, { ...state.document, children }, { anchor: position, focus: position });
    }
    case "undo": {
      const historyIndex = Math.max(0, state.historyIndex - 1);
      return { ...state, document: structuredClone(state.history[historyIndex]!), historyIndex };
    }
    case "redo": {
      const historyIndex = Math.min(state.history.length - 1, state.historyIndex + 1);
      return { ...state, document: structuredClone(state.history[historyIndex]!), historyIndex };
    }
    case "composition": {
      return { ...state, composing: command.active };
    }
  }
  return command;
};
