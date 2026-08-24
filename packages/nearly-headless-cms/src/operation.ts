export type Action =
  | "definition.read"
  | "definition.write"
  | "definition.activate"
  | "entry.create"
  | "entry.read"
  | "entry.update"
  | "entry.delete"
  | "entry.query"
  | "entry.expand"
  | "entry.history.read"
  | "entry.history.restore"
  | "entry.history.purge"
  | "asset.create"
  | "asset.read"
  | "asset.delete"
  | "public.read";

export type Resource =
  | { readonly kind: "definitionSpace"; readonly definitionSpaceId: string }
  | {
      readonly kind: "contentType";
      readonly definitionSpaceId: string;
      readonly contentTypeId: string;
    }
  | {
      readonly kind: "entry";
      readonly definitionSpaceId: string;
      readonly contentTypeId: string;
      readonly entryId?: string;
    }
  | { readonly kind: "asset"; readonly definitionSpaceId: string; readonly assetId?: string };

export interface DeliveryOperation<Request, Response> {
  readonly identifier: string;
  readonly method: "GET" | "POST" | "PUT" | "DELETE" | "HEAD";
  readonly path: string;
  readonly reachableContentTypeIds: readonly string[];
  readonly requiresIdempotencyKey?: boolean;
  readonly handler: (request: Request) => Response;
}
