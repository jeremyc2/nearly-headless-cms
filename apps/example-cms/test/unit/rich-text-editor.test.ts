import { describe, expect, test } from "bun:test";
import { RichTextEditor } from "../../src/presentation/rich-text-editor/index.ts";

const firstChildIndex = 0,
  initialBlockCount = 1,
  signalLength = 6,
  twoBlockCount = 2;

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
