import { useQueries, useQuery } from "@tanstack/react-query";
import { Effect } from "effect";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { type RichText } from "nearly-headless-cms";
import { entryOptionLabel } from "./main-labels.ts";
import { contentTypes, managementClient } from "./main-shared.ts";
import { BrowserAdapter, RichTextEditor } from "./rich-text-editor/index.ts";
import type { State } from "./rich-text-editor/transactions-types.ts";
import type { RichTextInsertDialog } from "./entry-editor-types.ts";
import type { EntryRepresentation, QueryPage } from "../generated/management-client.ts";

const buildRichTextEntryOptions = (
    entryQueries: readonly { readonly data: QueryPage | undefined }[],
  ): readonly { readonly identifier: string; readonly label: string; readonly type: string }[] =>
    contentTypes.flatMap((contentType, index) => {
      const items: readonly EntryRepresentation[] = entryQueries[index]?.data?.items ?? [];
      return items.map((entry) => ({
        identifier: entry.id,
        label: entryOptionLabel(entry.values, entry.id),
        type: contentType.label,
      }));
    }),
  createRichTextFieldAdapter = ({
    hostElement,
    initialValue,
    onChangeReference,
    setDialog,
    setEditorState,
  }: {
    readonly hostElement: HTMLDivElement;
    readonly initialValue: RichText.Document;
    readonly onChangeReference: { readonly current: (document: RichText.Document) => void };
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
    readonly setEditorState: (state: State) => void;
  }): BrowserAdapter =>
    new BrowserAdapter({
      host: hostElement,
      initialState: RichTextEditor.create(initialValue),
      onChange: (document) => {
        onChangeReference.current(document);
      },
      onRequestLink: () => {
        setDialog({ label: "", type: "link", url: "" });
      },
      onStateChange: setEditorState,
    }),
  applyRichTextFieldAdapterEffect = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    AdapterRef extends { current: BrowserAdapter | null },
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    HostRef extends { current: HTMLDivElement | null },
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    OnChangeRef extends { current: (document: RichText.Document) => void },
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetDialog extends (dialog: RichTextInsertDialog) => void,
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    SetEditorState extends (state: State) => void,
  >({
    adapter,
    host,
    initialValue,
    onChangeReference,
    setDialog,
    setEditorState,
  }: {
    readonly adapter: AdapterRef;
    readonly host: HostRef;
    readonly initialValue: RichText.Document;
    readonly onChangeReference: OnChangeRef;
    readonly setDialog: SetDialog;
    readonly setEditorState: SetEditorState;
  }) => {
    useEffect(() => {
      const cleanup = (() => {
        const hostElement = host.current;
        if (hostElement === null) {
          return () => {};
        }
        adapter.current = createRichTextFieldAdapter({
          hostElement,
          initialValue,
          onChangeReference,
          setDialog,
          setEditorState,
        });
        return () => {
          adapter.current?.destroy();
        };
      })();
      return () => {
        cleanup();
      };
    }, [adapter, host, initialValue, onChangeReference, setDialog, setEditorState]);
  },
  applyRichTextFieldOnChangeEffect = <
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    OnChangeRef extends { current: (document: RichText.Document) => void },
    // oxlint-disable-next-line typescript/no-unnecessary-type-parameters -- [EH-201] React panel helpers preserve local prop aliases for component call sites.
    OnChange extends (document: RichText.Document) => void,
  >(
    onChangeReference: OnChangeRef,
    onChange: OnChange,
  ) => {
    useEffect(() => {
      onChangeReference.current = onChange;
    }, [onChange, onChangeReference]);
  },
  useEntryEditorRichTextFieldState = (
    onChange: (document: RichText.Document) => void,
    value: RichText.Document,
  ) => {
    const adapter = useRef<BrowserAdapter | null>(null),
      assets = useQuery({
        queryFn: () => Effect.runPromise(managementClient.listAssets()),
        queryKey: ["assets"],
      }),
      [dialog, setDialog] = useState<RichTextInsertDialog | undefined>(),
      [editorState, setEditorState] = useState<State | undefined>(),
      entryQueries = useQueries({
        queries: contentTypes.map((contentType) => ({
          queryFn: (): Promise<QueryPage> =>
            Effect.runPromise(
              managementClient.queryEntries(contentType.identifier, { pageSize: 100 }),
            ),
          queryKey: ["rich-text-entry-picker", contentType.identifier],
        })),
      }),
      host = useRef<HTMLDivElement>(null),
      initialValue = useMemo(() => value, []),
      onChangeReference = useRef(onChange),
      setEditorStateStable = useCallback((state: State) => {
        setEditorState(state);
      }, []),
      toolbar = useRef<HTMLDivElement>(null);
    applyRichTextFieldOnChangeEffect(onChangeReference, onChange);
    applyRichTextFieldAdapterEffect({
      adapter,
      host,
      initialValue,
      onChangeReference,
      setDialog,
      setEditorState: setEditorStateStable,
    });
    return {
      adapter,
      assets: assets.data,
      dialog,
      editorState,
      entryOptions: buildRichTextEntryOptions(entryQueries),
      host,
      setDialog,
      toolbar,
    };
  };

export default { useEntryEditorRichTextFieldState };
