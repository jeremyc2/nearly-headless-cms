import { RichText } from "nearly-headless-cms";
import { emptyIndex } from "./transactions-constants.ts";
import transactionsSupport from "./transactions-support.ts";

const { conditionalValue, emptyParagraph, normalizeHeadingLevel, normalizeInlineNodes } =
  transactionsSupport,
  normalize = (document: RichText.Document): RichText.Document => {
    const children = document.children.map((block): RichText.BlockNode => {
      if (block.type === "paragraph") {
        return { ...block, children: normalizeInlineNodes(block.children) };
      }
      if (block.type === "heading") {
        return {
          ...block,
          children: normalizeInlineNodes(block.children),
          level: normalizeHeadingLevel(block.level),
        };
      }
      return structuredClone(block);
    });
    return {
      children: conditionalValue(children.length === emptyIndex, [emptyParagraph()], children),
      format: RichText.format,
      version: RichText.formatVersion,
    };
  };

export { normalize };
