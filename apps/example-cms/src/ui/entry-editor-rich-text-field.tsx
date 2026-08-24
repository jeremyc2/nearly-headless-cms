import { useQueries, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import type { RichText } from "nearly-headless-cms";
import { useEffect, useMemo, useRef, useState } from "react";
import { entryOptionLabel } from "./main-labels.ts";
import { contentTypes, managementClient } from "./main-shared.ts";
import { BrowserAdapter, RichTextEditor } from "./rich-text-editor/index.ts";
import type { RichTextInsertDialog } from "./entry-editor-types.ts";
import { EntryEditorRichTextInsertDialog } from "./entry-editor-rich-text-insert-dialog.tsx";
import { EntryEditorRichTextToolbar } from "./entry-editor-rich-text-toolbar.tsx";

export const EntryEditorRichTextField = ({
  onChange,
  surfaceId,
  value,
}: {
  readonly onChange: (document: RichText.Document) => void;
  readonly surfaceId: string;
  readonly value: RichText.Document;
}) => {
  const adapter = useRef<BrowserAdapter | null>(null),
    host = useRef<HTMLDivElement>(null),
    initialValue = useMemo(() => value, []),
    onChangeReference = useRef(onChange),
    toolbar = useRef<HTMLDivElement>(null),
    [dialog, setDialog] = useState<RichTextInsertDialog | undefined>(),
    assets = useQuery({
      queryFn: () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    entryQueries = useQueries({
      queries: contentTypes.map((contentType) => ({
        queryFn: () =>
          Effect.runPromise(
            managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
          ),
        queryKey: ["rich-text-entry-picker", contentType.identifier],
      })),
    }),
    entryOptions = contentTypes.flatMap((contentType, index) =>
      (entryQueries[index]?.data?.items ?? []).map((entry) => ({
        identifier: entry.id,
        label: entryOptionLabel(entry.values, entry.id),
        type: contentType.label,
      })),
    ),
    closeDialog = () => {
      setDialog(undefined);
      queueMicrotask(() => toolbar.current?.querySelector<HTMLButtonElement>("button")?.focus());
    };
  useEffect(() => {
    onChangeReference.current = onChange;
  }, [onChange]);
  useEffect(() => {
    if (host.current === null) {
      return;
    }
    const browserAdapter = new BrowserAdapter({
      host: host.current,
      initialState: RichTextEditor.create(initialValue),
      onChange: (document) => {
        onChangeReference.current(document);
      },
      onRequestLink: () => {
        setDialog({ label: "", type: "link", url: "" });
      },
    });
    adapter.current = browserAdapter;
    return () => {
      browserAdapter.destroy();
    };
  }, [initialValue]);
  return (
    <div className="rich-text-shell" id={surfaceId}>
      <EntryEditorRichTextToolbar
        adapter={adapter}
        onOpenAssetDialog={() => {
          setDialog({ alternativeText: "", assetId: "", caption: "", type: "asset" });
        }}
        onOpenEntryDialog={() => {
          setDialog({ entryId: "", label: "", type: "entry" });
        }}
        onOpenLinkDialog={() => {
          setDialog({ label: "", type: "link", url: "" });
        }}
        toolbar={toolbar}
      />
      <div aria-label="Rich Text content" className="rich-surface" ref={host} />
      {dialog !== undefined && (
        <EntryEditorRichTextInsertDialog
          adapter={adapter}
          assets={assets.data}
          closeDialog={closeDialog}
          dialog={dialog}
          entryOptions={entryOptions}
          setDialog={setDialog}
        />
      )}
    </div>
  );
};
