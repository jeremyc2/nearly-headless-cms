import { RichText } from "nearly-headless-cms";

export const emptyDocument = (): RichText.Document => ({
    children: [{ children: [{ text: "", type: "text" }], type: "paragraph" }],
    format: RichText.format,
    version: RichText.formatVersion,
  }),
  emptyIndex = 0,
  firstIndex = 1,
  historyLimit = 100,
  markOrder: readonly RichText.Mark[] = ["bold", "code", "italic", "strikethrough"],
  negativeOne = -1,
  signature = (document: RichText.Document): string => JSON.stringify(document);
