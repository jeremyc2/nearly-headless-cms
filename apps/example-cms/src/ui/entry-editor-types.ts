import type { EntryRepresentation } from "../generated/management-client.ts";

export type EditorialConfirmationStatus = "approved" | "draft" | "published" | "rejected";

export interface DeletionRecord {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken: string;
}

export interface EntryConflict {
  readonly latest: {
    readonly entry: EntryRepresentation;
    readonly revisionNumber: number;
    readonly writeToken: string;
  };
}

export type RichTextInsertDialog =
  | { readonly label: string; readonly type: "link"; readonly url: string }
  | { readonly entryId: string; readonly label: string; readonly type: "entry" }
  | {
      readonly alternativeText: string;
      readonly assetId: string;
      readonly caption: string;
      readonly type: "asset";
    };

