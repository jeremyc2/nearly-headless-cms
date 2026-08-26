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
    selectRichTextRange(state, offset, offset);

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

describe("RichTextEditor mark transactions", () => {
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
