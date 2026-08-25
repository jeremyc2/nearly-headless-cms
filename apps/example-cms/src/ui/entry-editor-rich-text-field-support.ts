import {
  BrowserAdapter,
  Effect,
  type RichText,
  RichTextEditor,
  type RichTextInsertDialog,
  contentTypes,
  entryOptionLabel,
  managementClient,
  useEffect,
  useMemo,
  useQueries,
  useQuery,
  useRef,
  useState,
} from "./entry-editor-rich-text-field-imports.ts";
import type { EntryRepresentation, QueryPage } from "../generated/management-client.ts";

const applyRichTextFieldAdapterEffect = <
    AdapterRef extends { current: BrowserAdapter | null },
    HostRef extends { current: HTMLDivElement | null },
    OnChangeRef extends { current: (document: RichText.Document) => void },
    SetDialog extends (dialog: RichTextInsertDialog) => void,
  >({
    adapter,
    host,
    initialValue,
    onChangeReference,
    setDialog,
  }: {
    readonly adapter: Readonly<AdapterRef>;
    readonly host: Readonly<HostRef>;
    readonly initialValue: RichText.Document;
    readonly onChangeReference: Readonly<OnChangeRef>;
    readonly setDialog: Readonly<SetDialog>;
  }) => {
    useEffect(() => {
      const cleanup = (() => {
        const hostElement = host.current;
        if (hostElement === null) {
          return () => {};
        }
        adapter.current = new BrowserAdapter({
          host: hostElement,
          initialState: RichTextEditor.create(initialValue),
          onChange: (document) => {
            onChangeReference.current(document);
          },
          onRequestLink: () => {
            setDialog({ label: "", type: "link", url: "" });
          },
        });
        return () => {
          adapter.current?.destroy();
        };
      })();
      return () => {
        cleanup();
      };
    }, [adapter, host, initialValue, onChangeReference, setDialog]);
  },
  applyRichTextFieldOnChangeEffect = <
    OnChangeRef extends { current: (document: RichText.Document) => void },
    OnChange extends (document: RichText.Document) => void,
  >(
    onChangeReference: Readonly<OnChangeRef>,
    onChange: Readonly<OnChange>,
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
      toolbar = useRef<HTMLDivElement>(null);
    applyRichTextFieldOnChangeEffect(onChangeReference, onChange);
    applyRichTextFieldAdapterEffect({
      adapter,
      host,
      initialValue,
      onChangeReference,
      setDialog,
    });
    return {
      adapter,
      assets: assets.data,
      dialog,
      entryOptions: contentTypes.flatMap((contentType, index) => {
        const items: readonly EntryRepresentation[] = entryQueries[index]?.data?.items ?? [];
        return items.map((entry) => ({
          identifier: entry.id,
          label: entryOptionLabel(entry.values, entry.id),
          type: contentType.label,
        }));
      }),
      host,
      setDialog,
      toolbar,
    };
  };

export default { useEntryEditorRichTextFieldState };
