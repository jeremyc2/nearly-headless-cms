import {
  type HeadingLevel,
  fourthHeadingLevel,
  secondHeadingLevel,
  thirdHeadingLevel,
} from "./transactions-types.ts";
import { emptyIndex, firstIndex, markOrder, negativeOne } from "./transactions-constants.ts";
import type { RichText } from "nearly-headless-cms";

const asParagraph = (
    replacement: RichText.ParagraphNode | RichText.HeadingNode,
  ): RichText.ParagraphNode => {
    if (replacement.type === "paragraph") {
      return replacement;
    }
    return { children: replacement.children, type: "paragraph" };
  },
  canonicalMarks = (marks: readonly RichText.Mark[]): readonly RichText.Mark[] =>
    markOrder.filter((mark) => marks.includes(mark)),
  conditionalValue = <Value>(condition: boolean, whenTrue: Value, whenFalse: Value): Value => {
    if (condition) {
      return whenTrue;
    }
    return whenFalse;
  },
  emptyParagraph = (): RichText.ParagraphNode => ({
    children: [{ text: "", type: "text" }],
    type: "paragraph",
  }),
  marksEqual = (
    leftMarks: readonly RichText.Mark[] | undefined,
    rightMarks: readonly RichText.Mark[] | undefined,
  ): boolean => JSON.stringify(leftMarks ?? []) === JSON.stringify(rightMarks ?? []),
  marksProperty = (
    marks: readonly RichText.Mark[] | undefined,
  ): {
    readonly marks?: readonly RichText.Mark[];
  } => {
    if (marks === undefined || marks.length === emptyIndex) {
      return {};
    }
    return { marks: canonicalMarks(marks) };
  },
  normalizeHeadingLevel = (level: HeadingLevel): HeadingLevel => {
    if ([fourthHeadingLevel, secondHeadingLevel, thirdHeadingLevel].includes(level)) {
      return level;
    }
    return secondHeadingLevel;
  },
  normalizeInlineNodes = (
    nodes: readonly RichText.InlineNode[],
  ): readonly RichText.InlineNode[] => {
    const normalized: RichText.InlineNode[] = [];
    for (const [index, node] of nodes.entries()) {
      const previous = normalized.at(negativeOne),
        next = nodes[index + firstIndex],
        marksBoundary =
          (previous?.type === "text" &&
            node.type === "text" &&
            !marksEqual(previous.marks, node.marks)) ||
          (node.type === "text" &&
            next?.type === "text" &&
            !marksEqual(next.marks, node.marks)),
        shouldSkipEmptyText =
          node.type === "text" &&
          node.text.length === emptyIndex &&
          nodes.length > firstIndex &&
          !marksBoundary;
      if (!shouldSkipEmptyText) {
        if (
          node.type === "text" &&
          previous?.type === "text" &&
          marksEqual(previous.marks, node.marks)
        ) {
          normalized[normalized.length - firstIndex] = {
            text: `${previous.text}${node.text}`,
            type: "text",
            ...marksProperty(node.marks),
          };
        } else if (node.type === "text") {
          normalized.push({
            text: node.text,
            type: "text",
            ...marksProperty(node.marks),
          });
        } else {
          normalized.push(structuredClone(node));
        }
      }
    }
    return conditionalValue(
      normalized.length === emptyIndex,
      [{ text: "", type: "text" }],
      normalized,
    );
  },
  replaceInlineNode = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    Input extends {
      index: number;
      node: RichText.InlineNode;
      replacement: RichText.InlineNode;
      targetIndex: number;
    },
  >({
    index,
    node,
    replacement,
    targetIndex,
  }: Readonly<Input>): RichText.InlineNode => {
    if (index === targetIndex) {
      return replacement;
    }
    return node;
  };

export default {
  asParagraph,
  canonicalMarks,
  conditionalValue,
  emptyParagraph,
  marksEqual,
  marksProperty,
  normalizeHeadingLevel,
  normalizeInlineNodes,
  replaceInlineNode,
};
