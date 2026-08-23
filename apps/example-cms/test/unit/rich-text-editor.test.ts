import { describe, expect, test } from "bun:test";
import { RichTextEditor } from "../../src/ui/rich-text-editor/index.ts";

describe("RichTextEditor transaction engine", () => {
  test("normalizes semantic edits and keeps bounded undo/redo independent of saving", () => {
    let state = RichTextEditor.create();
    state = RichTextEditor.transact(state, { text: "Signal", type: "insertText" });
    state = RichTextEditor.transact(state, {
      anchor: { blockIndex: 0, inlineIndex: 0, offset: 0 },
      focus: { blockIndex: 0, inlineIndex: 0, offset: 6 },
      type: "select",
    });
    state = RichTextEditor.transact(state, { mark: "bold", type: "toggleMark" });
    state = RichTextEditor.markClean(state);
    expect(state.document.children[0]?.children[0]).toEqual({
      marks: ["bold"],
      text: "Signal",
      type: "text",
    });
    expect(RichTextEditor.isDirty(state)).toBeFalse();

    state = RichTextEditor.transact(state, {
      alternativeText: "A steady light",
      assetId: "asset-1",
      caption: "At sea",
      type: "insertAssetReference",
    });
    expect(state.document.children[1]?.type).toBe("asset-reference");
    state = RichTextEditor.transact(state, { type: "undo" });
    expect(state.document.children).toHaveLength(1);
    state = RichTextEditor.transact(state, { type: "redo" });
    expect(state.document.children).toHaveLength(2);
  });
});
