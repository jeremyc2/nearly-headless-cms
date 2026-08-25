import {
  AssetsPageHeader,
  AssetsPageStatus,
  assetsPagePanelsSupport,
  useAssetsPage,
} from "./assets-page-bindings.ts";

const { AssetsPageDeleteDialog, AssetsPageGrid, AssetsPageReplaceDialog } = assetsPagePanelsSupport,
  AssetsPage = () => {
    const page = useAssetsPage();
    return (
      <div className="page">
        <AssetsPageHeader
          chooseFile={page.chooseFile}
          input={page.input}
          replace={page.replace}
          replacementAssetId={page.replacementAssetId}
          replacementInput={page.replacementInput}
          upload={page.upload}
        />
        <AssetsPageStatus
          deleteImage={page.deleteImage}
          replace={page.replace}
          upload={page.upload}
        />
        <AssetsPageGrid
          assets={page.assets}
          chooseFile={page.chooseFile}
          deleteImage={page.deleteImage}
          replace={page.replace}
          setDeletionAssetId={page.setDeletionAssetId}
          setReplacementConfirmationAssetId={page.setReplacementConfirmationAssetId}
        />
        {page.replacementConfirmationAssetId !== undefined && (
          <AssetsPageReplaceDialog
            replacementConfirmationAssetId={page.replacementConfirmationAssetId}
            replacementInput={page.replacementInput}
            setReplacementAssetId={page.setReplacementAssetId}
            setReplacementConfirmationAssetId={page.setReplacementConfirmationAssetId}
          />
        )}
        {page.deletionAssetId !== undefined && (
          <AssetsPageDeleteDialog
            deleteImage={page.deleteImage}
            deletionAssetId={page.deletionAssetId}
            setDeletionAssetId={page.setDeletionAssetId}
          />
        )}
      </div>
    );
  };

export { AssetsPage };

