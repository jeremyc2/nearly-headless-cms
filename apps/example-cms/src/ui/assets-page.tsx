import { useMutation, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { useRef, useState } from "react";
import type { AssetRepresentation } from "../generated/management-client.ts";
import { assetDimensions, deleteImageLabel } from "./main-labels.ts";
import { managementClient, queryClient } from "./main-shared.ts";

export const AssetsPage = () => {
  const input = useRef<HTMLInputElement>(null),
    replacementInput = useRef<HTMLInputElement>(null),
    [replacementAssetId, setReplacementAssetId] = useState<string>(),
    [replacementConfirmationAssetId, setReplacementConfirmationAssetId] = useState<string>(),
    [deletionAssetId, setDeletionAssetId] = useState<string>(),
    assets = useQuery({
      queryFn: () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    upload = useMutation({
      mutationFn: (file: File) => Effect.runPromise(managementClient.uploadAsset(file)),
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
      },
    }),
    replace = useMutation({
      mutationFn: ({ assetId, file }: { readonly assetId: string; readonly file: File }) =>
        Effect.runPromise(
          // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- the management client accepts a synchronous idempotency key.
          managementClient.replaceImage(assetId, file, `replace-${crypto.randomUUID()}`),
        ),
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async () => {
        setReplacementAssetId(undefined);
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
        await queryClient.invalidateQueries({ queryKey: ["entry-state"] });
        await queryClient.invalidateQueries({ queryKey: ["entries"] });
      },
    }),
    deleteImage = useMutation({
      mutationFn: (assetId: string) =>
        Effect.runPromise(
          // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- the management client accepts a synchronous idempotency key.
          managementClient.deleteImageAndClearAssignments(assetId, `delete-${crypto.randomUUID()}`),
        ),
      onSuccess: () => {
        setDeletionAssetId(undefined);
        return queryClient
          .invalidateQueries({ queryKey: ["assets"] })
          .then(() => queryClient.invalidateQueries({ queryKey: ["entry-state"] }))
          .then(() => queryClient.invalidateQueries({ queryKey: ["entries"] }));
      },
    }),
    chooseFile = () => {
      input.current?.click();
    };
  return (
    <div className="page">
      <header className="page-header">
        <div>
          <p className="eyebrow">Library</p>
          <h1>Assets</h1>
          <p>Immutable files referenced by Entries and Rich Text.</p>
        </div>
        <button className="primary-button" disabled={upload.isPending} onClick={chooseFile}>
          Upload Asset
        </button>
        <input
          ref={input}
          className="visually-hidden"
          type="file"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined) {
              upload.mutate(file);
            }
          }}
        />
        <input
          ref={replacementInput}
          className="visually-hidden"
          type="file"
          accept="image/*"
          onChange={(event) => {
            const file = event.target.files?.[0];
            if (file !== undefined && replacementAssetId !== undefined) {
              replace.mutate({ assetId: replacementAssetId, file });
            }
            event.currentTarget.value = "";
          }}
        />
      </header>
      {upload.isSuccess && <p role="status">Asset uploaded successfully.</p>}
      {replace.isSuccess && (
        <p role="status">
          Replacement completed: {replace.data.reassignedEntryCount} Entries reassigned.
        </p>
      )}
      {deleteImage.isSuccess && (
        <p role="status">
          Image deleted after clearing {deleteImage.data.clearedPostCount} Post and{" "}
          {deleteImage.data.clearedAuthorCount} Author assignments.
        </p>
      )}
      {upload.error && (
        <p role="alert" className="error-state">
          {upload.error.message}
        </p>
      )}
      {(replace.error ?? deleteImage.error) !== null &&
        (replace.error ?? deleteImage.error) !== undefined && (
          <p role="alert" className="error-state">
            {(replace.error ?? deleteImage.error)?.message}
          </p>
        )}
      <section className="asset-grid">
        {assets.data?.map((asset: AssetRepresentation) => (
          <article className="asset-card" key={asset.id}>
            <div className="asset-preview">
              {asset.metadata.mediaType.startsWith("image/") && (
                <img
                  src={`/api/v1/management/definition-spaces/example-blog/assets/${encodeURIComponent(asset.id)}/content`}
                  alt={asset.metadata.defaultAlternativeText ?? asset.metadata.filename}
                />
              )}
              {!asset.metadata.mediaType.startsWith("image/") && <span aria-hidden="true">◫</span>}
            </div>
            <strong>{asset.metadata.filename}</strong>
            <small>
              {asset.metadata.mediaType} · {asset.metadata.byteLength.toLocaleString()} bytes
              {assetDimensions(asset.metadata.width, asset.metadata.height)}
            </small>
            <div className="asset-actions">
              <button
                className="secondary-button"
                type="button"
                disabled={replace.isPending || deleteImage.isPending}
                onClick={() => {
                  setReplacementConfirmationAssetId(asset.id);
                }}
              >
                Replace…
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={replace.isPending || deleteImage.isPending}
                onClick={() => {
                  setDeletionAssetId(asset.id);
                }}
              >
                Delete…
              </button>
            </div>
          </article>
        ))}
        <button className="asset-upload" onClick={chooseFile}>
          ＋<span>Upload a new Asset</span>
        </button>
      </section>
      {replacementConfirmationAssetId !== undefined && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog destructive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="replace-image-title"
          >
            <p className="eyebrow">Confirm replacement</p>
            <h2 id="replace-image-title">Replace this immutable image?</h2>
            <p>
              A new Asset will be ingested, every direct and Rich Text reference will be reassigned
              atomically, and the old Asset will be deleted last.
            </p>
            <div className="editor-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setReplacementConfirmationAssetId(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                onClick={() => {
                  setReplacementAssetId(replacementConfirmationAssetId);
                  setReplacementConfirmationAssetId(undefined);
                  queueMicrotask(() => replacementInput.current?.click());
                }}
              >
                Choose replacement file
              </button>
            </div>
          </div>
        </div>
      )}
      {deletionAssetId !== undefined && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog destructive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-image-title"
          >
            <p className="eyebrow">Confirm deletion</p>
            <h2 id="delete-image-title">Delete this image Asset?</h2>
            <p>
              Optional featured-image and portrait assignments will be cleared automatically. Rich
              Text references still block deletion so authored content is never silently removed.
            </p>
            <div className="editor-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setDeletionAssetId(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="danger-button"
                type="button"
                disabled={deleteImage.isPending}
                onClick={() => {
                  deleteImage.mutate(deletionAssetId);
                }}
              >
                {deleteImageLabel(deleteImage.isPending)}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
