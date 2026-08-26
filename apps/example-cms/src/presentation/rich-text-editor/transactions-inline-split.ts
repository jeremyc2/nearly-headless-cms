import { emptyIndex } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";
import transactionsSupport from "./transactions-support.ts";

const { marksProperty } = transactionsSupport,
  buildTextSegment = (text: string, marks: readonly RichText.Mark[]): RichText.TextNode => ({
    text,
    type: "text",
    ...marksProperty(marks),
  }),
  ensureSplitSideHasContent = (nodes: RichText.InlineNode[]): readonly RichText.InlineNode[] =>
    nodes.length === emptyIndex ? [buildTextSegment("", [])] : nodes,
  pushSplitNonTextNode = (input: {
    readonly after: RichText.InlineNode[];
    readonly before: RichText.InlineNode[];
    readonly child: RichText.InlineNode;
    readonly position: number;
    readonly splitAt: number;
  }): void => {
    if (input.position < input.splitAt) {
      input.before.push(input.child);
      return;
    }
    input.after.push(input.child);
  },
  pushSplitTextNode = (input: {
    readonly after: RichText.InlineNode[];
    readonly before: RichText.InlineNode[];
    readonly child: RichText.TextNode;
    readonly nodeEnd: number;
    readonly nodeStart: number;
    readonly splitAt: number;
  }): void => {
    const nodeMarks = input.child.marks ?? [];
    if (input.nodeEnd <= input.splitAt) {
      input.before.push(input.child);
      return;
    }
    if (input.nodeStart >= input.splitAt) {
      input.after.push(input.child);
      return;
    }
    pushSplitTextNodeAcross(input, nodeMarks);
  },
  pushSplitTextNodeAcross = (
    input: {
      readonly after: RichText.InlineNode[];
      readonly before: RichText.InlineNode[];
      readonly child: RichText.TextNode;
      readonly nodeStart: number;
      readonly splitAt: number;
    },
    nodeMarks: readonly RichText.Mark[],
  ): void => {
    const localSplit = input.splitAt - input.nodeStart;
    if (localSplit > emptyIndex) {
      input.before.push(buildTextSegment(input.child.text.slice(emptyIndex, localSplit), nodeMarks));
    }
    if (localSplit < input.child.text.length) {
      input.after.push(buildTextSegment(input.child.text.slice(localSplit), nodeMarks));
    }
  },
  splitInlineBlockAtOffset = (
    block: RichText.ParagraphNode | RichText.HeadingNode,
    splitAt: number,
  ): {
    readonly after: readonly RichText.InlineNode[];
    readonly before: readonly RichText.InlineNode[];
  } => {
    const before: RichText.InlineNode[] = [],
      after: RichText.InlineNode[] = [];
    let position = emptyIndex;
    for (const child of block.children) {
      if (child.type === "text") {
        const nodeStart = position,
          nodeEnd = position + child.text.length;
        pushSplitTextNode({ after, before, child, nodeEnd, nodeStart, splitAt });
        position = nodeEnd;
      } else {
        pushSplitNonTextNode({ after, before, child, position, splitAt });
      }
    }
    return {
      after: ensureSplitSideHasContent(after),
      before: ensureSplitSideHasContent(before),
    };
  };

export default { splitInlineBlockAtOffset };
