import { Effect, managementClient, queryClient, useMutation } from "./assets-page-imports.ts";

export const useAssetsPageMutations = (input: {
  readonly setDeletionAssetId: (assetId: string | undefined) => void;
  readonly setReplacementAssetId: (assetId: string | undefined) => void;
}) => {
  const deleteImage = useMutation({
      mutationFn: (assetId: string) =>
        Effect.runPromise(
          // oxlint-disable-next-line effecttsgo/crypto-random-uuid -- the management client accepts a synchronous idempotency key.
          managementClient.deleteImageAndClearAssignments(assetId, `delete-${crypto.randomUUID()}`),
        ),
      onSuccess: () => {
        input.setDeletionAssetId(undefined);
        return queryClient
          .invalidateQueries({ queryKey: ["assets"] })
          .then(() => queryClient.invalidateQueries({ queryKey: ["entry-state"] }))
          .then(() => queryClient.invalidateQueries({ queryKey: ["entries"] }));
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
        input.setReplacementAssetId(undefined);
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
        await queryClient.invalidateQueries({ queryKey: ["entry-state"] });
        await queryClient.invalidateQueries({ queryKey: ["entries"] });
      },
    }),
    upload = useMutation({
      mutationFn: (file: File) => Effect.runPromise(managementClient.uploadAsset(file)),
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async () => {
        await queryClient.invalidateQueries({ queryKey: ["assets"] });
      },
    });
  return { deleteImage, replace, upload };
};
