import { useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { useRef, useState } from "react";
import { managementClient } from "./main-shared.ts";
import { useAssetsPageMutations } from "./assets-page-mutations-support.ts";

export const useAssetsPage = () => {
  const assets = useQuery({
      queryFn: () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    [deletionAssetId, setDeletionAssetId] = useState<string>(),
    input = useRef<HTMLInputElement>(null),
    [replacementAssetId, setReplacementAssetId] = useState<string>(),
    [replacementConfirmationAssetId, setReplacementConfirmationAssetId] = useState<string>(),
    replacementInput = useRef<HTMLInputElement>(null),
    { deleteImage, replace, upload } = useAssetsPageMutations({
      setDeletionAssetId,
      setReplacementAssetId,
    });
  return {
    assets,
    chooseFile: () => {
      input.current?.click();
    },
    deleteImage,
    deletionAssetId,
    input,
    replace,
    replacementAssetId,
    replacementConfirmationAssetId,
    replacementInput,
    setDeletionAssetId,
    setReplacementAssetId,
    setReplacementConfirmationAssetId,
    upload,
  };
};
