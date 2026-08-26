import { emptyIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsInlineSplit from "./transactions-inline-split.ts";
import transactionsSupport from "./transactions-support.ts";

const { canonicalMarks, conditionalValue, marksProperty } = transactionsSupport,
  buildTextSegment = (text: string, marks: readonly RichText.Mark[]): RichText.TextNode => ({
    text,
    type: "text",
    ...marksProperty(marks),
  }),
  pushRangeReplacement = (input: {
    readonly replacementInserted: boolean;
    readonly replacementMarks: readonly RichText.Mark[];
    readonly replacementText: string;
    readonly result: RichText.InlineNode[];
  }): boolean => {
    const { replacementInserted, replacementMarks, replacementText, result } = input;
    if (replacementInserted || replacementText.length === emptyIndex) {
      return replacementInserted;
    }
    result.push(buildTextSegment(replacementText, replacementMarks));
    return true;
  },
  pushOverlappingTextReplacement = (input: {
    readonly child: RichText.TextNode;
    readonly localEnd: number;
    readonly localStart: number;
    readonly nodeMarks: readonly RichText.Mark[];
    readonly replacementInserted: boolean;
    readonly replacementMarks: readonly RichText.Mark[];
    readonly replacementText: string;
    readonly result: RichText.InlineNode[];
  }): boolean => {
    const {
      child,
      localEnd,
      localStart,
      nodeMarks,
      replacementInserted,
      replacementMarks,
      replacementText,
      result,
    } = input;
    if (localStart > emptyIndex) {
      result.push(buildTextSegment(child.text.slice(emptyIndex, localStart), nodeMarks));
    }
    const inserted = pushRangeReplacement({
      replacementInserted,
      replacementMarks,
      replacementText,
      result,
    });
    if (localEnd < child.text.length) {
      result.push(buildTextSegment(child.text.slice(localEnd), nodeMarks));
    }
    return inserted;
  },
  processRangeReplacementNode = (input: {
    readonly child: RichText.TextNode;
    readonly nodeEnd: number;
    readonly nodeStart: number;
    readonly rangeEnd: number;
    readonly rangeStart: number;
    readonly replacementInserted: boolean;
    readonly replacementMarks: readonly RichText.Mark[];
    readonly replacementText: string;
    readonly result: RichText.InlineNode[];
  }): boolean => {
    const {
      child,
      nodeEnd,
      nodeStart,
      rangeEnd,
      rangeStart,
      replacementInserted,
      replacementMarks,
      replacementText,
      result,
    } = input;
    if (nodeEnd <= rangeStart) {
      result.push(child);
      return replacementInserted;
    }
    if (nodeStart >= rangeEnd) {
      const inserted = pushRangeReplacement({
        replacementInserted,
        replacementMarks,
        replacementText,
        result,
      });
      result.push(child);
      return inserted;
    }
    return pushOverlappingTextReplacement({
      child,
      localEnd: Math.min(rangeEnd, nodeEnd) - nodeStart,
      localStart: Math.max(rangeStart, nodeStart) - nodeStart,
      nodeMarks: child.marks ?? [],
      replacementInserted,
      replacementMarks,
      replacementText,
      result,
    });
  },
  pushToggledMiddleSegment = (input: {
    readonly child: RichText.TextNode;
    readonly localEnd: number;
    readonly localStart: number;
    readonly mark: RichText.Mark;
    readonly nodeMarks: readonly RichText.Mark[];
    readonly result: RichText.InlineNode[];
  }): void => {
    const { child, localEnd, localStart, mark, nodeMarks, result } = input;
    if (localStart > emptyIndex) {
      result.push(buildTextSegment(child.text.slice(emptyIndex, localStart), nodeMarks));
    }
    if (localEnd > localStart) {
      const toggledMarks = nodeMarks.includes(mark)
        ? nodeMarks.filter((candidate) => candidate !== mark)
        : canonicalMarks([...nodeMarks, mark]);
      result.push(buildTextSegment(child.text.slice(localStart, localEnd), toggledMarks));
    }
    if (localEnd < child.text.length) {
      result.push(buildTextSegment(child.text.slice(localEnd), nodeMarks));
    }
  },
  processMarkToggleNode = (input: {
    readonly child: RichText.TextNode;
    readonly mark: RichText.Mark;
    readonly nodeEnd: number;
    readonly nodeStart: number;
    readonly rangeEnd: number;
    readonly rangeStart: number;
    readonly result: RichText.InlineNode[];
  }): void => {
    const { child, mark, nodeEnd, nodeStart, rangeEnd, rangeStart, result } = input;
    if (nodeEnd <= rangeStart || nodeStart >= rangeEnd) {
      result.push(child);
      return;
    }
    pushToggledMiddleSegment({
      child,
      localEnd: Math.min(rangeEnd, nodeEnd) - nodeStart,
      localStart: Math.max(rangeStart, nodeStart) - nodeStart,
      mark,
      nodeMarks: child.marks ?? [],
      result,
    });
  },
  appendRangeReplacementChild = (input: {
    readonly child: RichText.InlineNode;
    readonly position: number;
    readonly rangeEnd: number;
    readonly rangeStart: number;
    readonly replacementInserted: boolean;
    readonly replacementMarks: readonly RichText.Mark[];
    readonly replacementText: string;
    readonly result: RichText.InlineNode[];
  }): { readonly nextPosition: number; readonly replacementInserted: boolean } => {
    if (input.child.type !== "text") {
      input.result.push(input.child);
      return { nextPosition: input.position, replacementInserted: input.replacementInserted };
    }
    const nodeStart = input.position,
      nodeEnd = input.position + input.child.text.length,
      replacementInserted = processRangeReplacementNode({
        child: input.child,
        nodeEnd,
        nodeStart,
        rangeEnd: input.rangeEnd,
        rangeStart: input.rangeStart,
        replacementInserted: input.replacementInserted,
        replacementMarks: input.replacementMarks,
        replacementText: input.replacementText,
        result: input.result,
      });
    return { nextPosition: nodeEnd, replacementInserted };
  },
  rebuildBlockWithRangeReplacement = (input: {
    readonly block: RichText.ParagraphNode | RichText.HeadingNode;
    readonly rangeEnd: number;
    readonly rangeStart: number;
    readonly replacementMarks: readonly RichText.Mark[];
    readonly replacementText: string;
  }): readonly RichText.InlineNode[] => {
    const { block, rangeEnd, rangeStart, replacementMarks, replacementText } = input,
      result: RichText.InlineNode[] = [];
    let position = emptyIndex,
      replacementInserted = false;
    for (const child of block.children) {
      const next = appendRangeReplacementChild({
        child,
        position,
        rangeEnd,
        rangeStart,
        replacementInserted,
        replacementMarks,
        replacementText,
        result,
      });
      ({ nextPosition: position, replacementInserted } = next);
    }
    replacementInserted = pushRangeReplacement({
      replacementInserted,
      replacementMarks,
      replacementText,
      result,
    });
    if (result.length === emptyIndex) {
      result.push(buildTextSegment("", replacementMarks));
    }
    return result;
  },
  rebuildBlockWithMarkToggle = (input: {
    readonly block: RichText.ParagraphNode | RichText.HeadingNode;
    readonly mark: RichText.Mark;
    readonly rangeEnd: number;
    readonly rangeStart: number;
  }): readonly RichText.InlineNode[] => {
    const { block, mark, rangeEnd, rangeStart } = input,
      result: RichText.InlineNode[] = [];
    let position = emptyIndex;
    for (const child of block.children) {
      if (child.type === "text") {
        const nodeStart = position,
          nodeEnd = position + child.text.length;
        processMarkToggleNode({
          child,
          mark,
          nodeEnd,
          nodeStart,
          rangeEnd,
          rangeStart,
          result,
        });
        position = nodeEnd;
      } else {
        result.push(child);
      }
    }
    return conditionalValue(result.length === emptyIndex, block.children, result);
  };

export default {
  rebuildBlockWithMarkToggle,
  rebuildBlockWithRangeReplacement,
  splitInlineBlockAtOffset: transactionsInlineSplit.splitInlineBlockAtOffset,
};
