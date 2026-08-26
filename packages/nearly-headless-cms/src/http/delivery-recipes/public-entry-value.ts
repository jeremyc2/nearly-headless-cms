import type { JsonObject, JsonValue } from "../../content-definition-types.ts";

/** Options for projecting Entry values into public wire shapes. */
export interface PublicEntryValueOptions {
  readonly nullableWireFields?: Readonly<Record<string, readonly string[]>>;
}

const lowerCamelCase = (key: string): string =>
    key.replaceAll(/-(?<letter>[a-z])/gu, (_match, letter: string) => letter.toUpperCase()),
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-299] public Entry projection is intentionally a pure value transform helper.
  publicEntryValue = (
    entry: {
      readonly contentTypeId?: string;
      readonly id: string;
      readonly values: JsonObject;
    },
    options: PublicEntryValueOptions = {},
  ): JsonObject => {
    const value: Record<string, JsonValue> = { id: entry.id };
    for (const [key, fieldValue] of Object.entries(entry.values)) {
      value[lowerCamelCase(key)] = fieldValue;
    }
    if (entry.contentTypeId !== undefined) {
      for (const nullableKey of options.nullableWireFields?.[entry.contentTypeId] ?? []) {
        if (!(nullableKey in value)) {
          value[nullableKey] = null;
        }
      }
    }
    return value;
  },
  // oxlint-disable-next-line effecttsgo/missing-pipeable-signature -- [EH-298] public Entry page projection is intentionally a pure value transform helper.
  publicEntryPage = <
    Page extends {
      items: readonly {
        contentTypeId?: string;
        id: string;
        values: JsonObject;
      }[];
      nextCursor?: string;
    },
  >(
    page: Readonly<Page>,
    options: PublicEntryValueOptions = {},
  ): { items: readonly JsonObject[]; nextCursor?: string } => {
    if (page.nextCursor !== undefined) {
      return {
        items: page.items.map((entry) => publicEntryValue(entry, options)),
        nextCursor: page.nextCursor,
      };
    }
    return { items: page.items.map((entry) => publicEntryValue(entry, options)) };
  };

/** Projects one Entry into a public JSON object with camelCase field names. */
export { publicEntryValue };

/** Projects every Entry in a page into public wire values. */
export { publicEntryPage };
