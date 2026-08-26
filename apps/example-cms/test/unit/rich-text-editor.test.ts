import { describe, expect, test } from "bun:test";
import { RichTextEditor } from "../../src/presentation/rich-text-editor/index.ts";

const firstChildIndex = 0,
  initialBlockCount = 1,
  signalLength = 6,
  twoBlockCount = 2,
  selectRichTextRange = (
    state: ReturnType<typeof RichTextEditor.create>,
    start: number,
    end: number,
  ) =>
    RichTextEditor.transact(state, {
      anchor: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: start },
      focus: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: end },
      type: "select",
    }),
  selectRichTextCollapsed = (state: ReturnType<typeof RichTextEditor.create>, offset: number) =>
    selectRichTextRange(state, offset, offset),
  createEmptyLineBetweenBlocks = () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "fd", type: "insertText" });
    state = RichTextEditor.transact(state, { type: "splitBlock" });
    state = RichTextEditor.transact(state, { type: "splitBlock" });
    state = RichTextEditor.transact(state, { text: "fds", type: "insertText" });
    return state;
  },
  createMixedMarkSplitDocument = () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "bold", type: "insertText" });
    state = selectRichTextRange(state, firstChildIndex, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = selectRichTextCollapsed(state, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.transact(state, { text: "plain", type: "insertText" });
    return selectRichTextCollapsed(state, 4);
  };

describe("RichTextEditor text and history transactions", () => {
  test("normalizes semantic marks and tracks save state", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "Signal", type: "insertText" });
    state = RichTextEditor.transact(state, {
      anchor: {
        blockIndex: firstChildIndex,
        inlineIndex: firstChildIndex,
        offset: firstChildIndex,
      },
      focus: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: signalLength },
      type: "select",
    });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.markClean(state);
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      marks: ["bold"],
      text: "Signal",
      type: "text",
    });
    expect(RichTextEditor.isDirty(state)).toBeFalse();
  });

  test("undoes and redoes asset insertion", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "Signal", type: "insertText" });
    state = RichTextEditor.transact(state, {
      alternativeText: "A steady light",
      assetId: "asset-1",
      caption: "At sea",
      type: "insertAssetReference",
    });
    expect(state.document.children[initialBlockCount]?.type).toBe("asset-reference");
    state = RichTextEditor.transact(state, { type: "undo" });
    expect(state.document.children).toHaveLength(initialBlockCount);
    state = RichTextEditor.transact(state, { type: "redo" });
    expect(state.document.children).toHaveLength(twoBlockCount);
  });
});

describe("RichTextEditor list transactions", () => {
  test("creates semantic list items", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "First", type: "insertText" });
    state = RichTextEditor.transact(state, { listType: "unordered-list", type: "toggleList" });
    expect(state.document.children[firstChildIndex]?.type).toBe("unordered-list");
  });

  test("splits and outdents semantic list items", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "First", type: "insertText" });
    state = RichTextEditor.transact(state, { listType: "unordered-list", type: "toggleList" });
    state = RichTextEditor.transact(state, { type: "splitBlock" });
    const [list] = state.document.children;
    if (list?.type !== "unordered-list") {
      throw new Error("Expected an unordered list");
    }
    expect(list.children).toHaveLength(twoBlockCount);
    state = RichTextEditor.transact(state, { type: "deleteBackward" });
    expect(state.document.children.map((block) => block.type)).toEqual([
      "unordered-list",
      "paragraph",
    ]);
  });
});

describe("RichTextEditor whitespace transactions", () => {
  test("preserves multiple spaces and tabs", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "a  b\tc", type: "insertText" });
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "a  b\tc",
      type: "text",
    });
  });
});

describe("RichTextEditor mark split transactions", () => {
  test("splits inline nodes when turning bold off before typing plain text", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "bold", type: "insertText" });
    state = selectRichTextRange(state, firstChildIndex, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = selectRichTextCollapsed(state, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    expect(state.storedMarks).toEqual([]);
    state = RichTextEditor.transact(state, { text: " plain", type: "insertText" });
    expect(state.document.children[firstChildIndex]?.children).toEqual([
      { marks: ["bold"], text: "bold", type: "text" },
      { text: " plain", type: "text" },
    ]);
  });
});

describe("RichTextEditor mark toggle transactions", () => {
  test("tracks stored marks for toolbar toggling at a collapsed selection", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "word", type: "insertText" });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    expect(state.storedMarks).toEqual(["bold"]);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    expect(state.storedMarks).toEqual([]);
    state = RichTextEditor.transact(state, { mark: "strikethrough", type: "toggleMark" });
    state = RichTextEditor.transact(state, { text: "mark", type: "insertText" });
    expect(state.document.children[firstChildIndex]?.children).toEqual([
      { text: "word", type: "text" },
      { marks: ["strikethrough"], text: "mark", type: "text" },
    ]);
  });

  test("combines bold and strikethrough on the same inline run", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "both", type: "insertText" });
    state = selectRichTextRange(state, firstChildIndex, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = selectRichTextRange(state, firstChildIndex, 4);
    state = RichTextEditor.transact(state, { mark: "strikethrough", type: "toggleMark" });
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      marks: ["bold", "strikethrough"],
      text: "both",
      type: "text",
    });
  });
});

describe("RichTextEditor mark cursor transactions", () => {
  test("keeps the cursor at the end while typing after a mark split", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "bold", type: "insertText" });
    state = selectRichTextRange(state, firstChildIndex, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = selectRichTextCollapsed(state, 4);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.transact(state, { text: " plain", type: "insertText" });
    state = RichTextEditor.transact(state, { text: "!", type: "insertText" });
    expect(state.document.children[firstChildIndex]?.children).toEqual([
      { marks: ["bold"], text: "bold", type: "text" },
      { text: " plain!", type: "text" },
    ]);
    expect(state.selection).toEqual({
      anchor: { blockIndex: firstChildIndex, inlineIndex: 1, offset: 7 },
      focus: { blockIndex: firstChildIndex, inlineIndex: 1, offset: 7 },
    });
  });

  test("alternates plain and bold segments while typing", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "a", type: "insertText" });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.transact(state, { text: "b", type: "insertText" });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.transact(state, { text: "c", type: "insertText" });
    expect(state.document.children[firstChildIndex]?.children).toEqual([
      { text: "a", type: "text" },
      { marks: ["bold"], text: "b", type: "text" },
      { text: "c", type: "text" },
    ]);
  });
});

describe("RichTextEditor highlighted delete transactions", () => {
  test("deletes a highlighted range with deleteBackward", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "hello world", type: "insertText" });
    state = selectRichTextRange(state, 0, 5);
    state = RichTextEditor.transact(state, { type: "deleteBackward" });
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: " world",
      type: "text",
    });
  });

  test("deletes a highlighted range with deleteForward", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "hello world", type: "insertText" });
    state = selectRichTextRange(state, 6, 11);
    state = RichTextEditor.transact(state, { type: "deleteForward" });
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "hello ",
      type: "text",
    });
  });
});

describe("RichTextEditor collapsed delete transactions", () => {
  test("deletes one character before the cursor with deleteBackward", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "abc", type: "insertText" });
    state = selectRichTextCollapsed(state, 2);
    state = RichTextEditor.transact(state, { type: "deleteBackward" });
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "ac",
      type: "text",
    });
  });
});

describe("RichTextEditor cross-paragraph delete transactions", () => {
  test("deletes a selection that spans multiple paragraphs", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "first", type: "insertText" });
    state = RichTextEditor.transact(state, { type: "splitBlock" });
    state = RichTextEditor.transact(state, { text: "second", type: "insertText" });
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 2 },
      focus: { blockIndex: 1, inlineIndex: firstChildIndex, offset: 3 },
      type: "select",
    });
    state = RichTextEditor.transact(state, { type: "deleteForward" });
    expect(state.document.children).toHaveLength(initialBlockCount);
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "fiond",
      type: "text",
    });
  });
});

describe("RichTextEditor select-all delete transactions", () => {
  test("clears the document when the entire range is selected", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "everything", type: "insertText" });
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: firstChildIndex },
      focus: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 10 },
      type: "select",
    });
    state = RichTextEditor.transact(state, { type: "deleteBackward" });
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "",
      type: "text",
    });
  });
});

describe("RichTextEditor block kind transactions", () => {
  test("changes the current paragraph into a heading", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "Title", type: "insertText" });
    state = RichTextEditor.transact(state, {
      blockType: "heading",
      headingLevel: 2,
      type: "setBlockKind",
    });
    expect(state.document.children[firstChildIndex]).toEqual({
      children: [{ text: "Title", type: "text" }],
      level: 2,
      type: "heading",
    });
  });

  test("unwraps a quote back to a paragraph", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "Quoted", type: "insertText" });
    state = RichTextEditor.transact(state, { blockType: "quote", type: "setBlockKind" });
    state = RichTextEditor.transact(state, { blockType: "paragraph", type: "setBlockKind" });
    expect(state.document.children[firstChildIndex]).toEqual({
      children: [{ text: "Quoted", type: "text" }],
      type: "paragraph",
    });
  });

  test("converts a quote into a list", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "Quoted", type: "insertText" });
    state = RichTextEditor.transact(state, { blockType: "quote", type: "setBlockKind" });
    state = RichTextEditor.transact(state, { listType: "unordered-list", type: "toggleList" });
    expect(state.document.children[firstChildIndex]?.type).toBe("unordered-list");
  });
});

describe("RichTextEditor block join transactions", () => {
  test("removes an empty paragraph when backspacing at the start of a split line", () => {
    let state = createEmptyLineBetweenBlocks();
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: 1, inlineIndex: firstChildIndex, offset: firstChildIndex },
      focus: { blockIndex: 1, inlineIndex: firstChildIndex, offset: firstChildIndex },
      type: "select",
    });
    state = RichTextEditor.transact(state, { type: "deleteBackward" });
    expect(state.document.children).toHaveLength(twoBlockCount);
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "fd",
      type: "text",
    });
    expect(state.document.children[1]?.children[firstChildIndex]).toEqual({
      text: "fds",
      type: "text",
    });
    expect(state.selection.anchor).toEqual({
      blockIndex: firstChildIndex,
      inlineIndex: firstChildIndex,
      offset: 2,
    });
  });

  test("joins the next paragraph when deleting forward at the end of a line", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "fd", type: "insertText" });
    state = RichTextEditor.transact(state, { type: "splitBlock" });
    state = RichTextEditor.transact(state, { text: "fds", type: "insertText" });
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 2 },
      focus: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 2 },
      type: "select",
    });
    state = RichTextEditor.transact(state, { type: "deleteForward" });
    expect(state.document.children).toHaveLength(initialBlockCount);
    expect(state.document.children[firstChildIndex]?.children[firstChildIndex]).toEqual({
      text: "fdfds",
      type: "text",
    });
  });
});

describe("RichTextEditor split block transactions", () => {
  test("preserves mixed inline marks when splitting a block", () => {
    let state = createMixedMarkSplitDocument();
    state = RichTextEditor.transact(state, { type: "splitBlock" });
    expect(state.document.children).toHaveLength(twoBlockCount);
    expect(state.document.children[firstChildIndex]?.children).toEqual([
      { marks: ["bold"], text: "bold", type: "text" },
    ]);
    expect(state.document.children[1]?.children).toEqual([{ text: "plain", type: "text" }]);
  });
});

describe("RichTextEditor cross-node mark transactions", () => {
  test("toggles bold on a selection that spans inline nodes", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "aa", type: "insertText" });
    state = selectRichTextRange(state, firstChildIndex, 2);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = selectRichTextCollapsed(state, 2);
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.transact(state, { text: "bb", type: "insertText" });
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 1 },
      focus: { blockIndex: firstChildIndex, inlineIndex: 1, offset: 1 },
      type: "select",
    });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    expect(state.document.children[firstChildIndex]?.children).toEqual([
      { marks: ["bold"], text: "a", type: "text" },
      { text: "a", type: "text" },
      { marks: ["bold"], text: "b", type: "text" },
      { text: "b", type: "text" },
    ]);
  });

  test("preserves stored marks when the selection is synchronized without moving", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "word", type: "insertText" });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 4 },
      focus: { blockIndex: firstChildIndex, inlineIndex: firstChildIndex, offset: 4 },
      type: "select",
    });
    expect(state.storedMarks).toEqual(["bold"]);
  });
});
