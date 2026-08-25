import {
  type Document,
  references as collectRichTextReferences,
  validate as validateRichText,
} from "./rich-text.ts";
import { type JsonValue, isJsonObject } from "./internal/json.ts";
import { InvalidInput } from "./cms-error.ts";

const validateRichTextDocument = (value: JsonValue): Document => {
  validateRichText(value);
  if (
    isJsonObject(value) &&
    value["format"] === "nearly-headless-cms/rich-text" &&
    value["version"] === 1 &&
    Array.isArray(value["children"])
  ) {
    return {
      children: value["children"],
      format: value["format"],
      version: value["version"],
    };
  }
  throw InvalidInput.make({
    message: "Rich Text must use nearly-headless-cms/rich-text version 1",
  });
};

export default {
  collectRichTextReferences,
  validateRichTextDocument,
};
