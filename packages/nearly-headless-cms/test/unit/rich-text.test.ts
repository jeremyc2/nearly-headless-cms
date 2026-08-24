import { describe, expect, test } from "bun:test";
import { RichText } from "../../src/index.ts";

describe("RichText", () => {
  test("validates semantic documents and discovers live references", () => {
    const document: RichText.Document = {
      children: [
        {
          children: [
            { marks: ["bold"], text: "Read ", type: "text" },
            {
              children: [{ text: "more", type: "text" }],
              entryId: "entry-1",
              type: "entry-reference",
            },
          ],
          type: "paragraph",
        },
        {
          alternativeText: "A lighthouse",
          assetId: "asset-1",
          children: [],
          type: "asset-reference",
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
        children: [{ children: [], configuration: {}, type: "com.example.callout", version: 1 }],
        format: "nearly-headless-cms/rich-text",
        version: 1,
      }),
    ).toThrow("Unsupported Rich Text extension");
  });
});
