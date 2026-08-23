import { describe, expect, test } from "bun:test";
import { RichText } from "../../src/index.ts";

describe("RichText", () => {
  test("validates semantic documents and discovers live references", () => {
    const document: RichText.Document = {
      children: [
        {
          type: "paragraph",
          children: [
            { type: "text", text: "Read ", marks: ["bold"] },
            {
              type: "entry-reference",
              entryId: "entry-1",
              children: [{ type: "text", text: "more" }],
            },
          ],
        },
        {
          type: "asset-reference",
          assetId: "asset-1",
          alternativeText: "A lighthouse",
          children: [],
        },
      ],
      format: "nearly-headless-cms/rich-text",
      version: 1,
    };

    expect(RichText.validate(document)).toEqual(document);
    expect(RichText.references(document)).toEqual({ assetIds: ["asset-1"], entryIds: ["entry-1"] });
  });

  test("rejects unsupported extensions instead of silently discarding them", () => {
    expect(() =>
      RichText.validate({
        children: [{ type: "com.example.callout", version: 1, configuration: {}, children: [] }],
        format: "nearly-headless-cms/rich-text",
        version: 1,
      }),
    ).toThrow("Unsupported Rich Text extension");
  });
});
