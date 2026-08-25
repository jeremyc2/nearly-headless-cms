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

const applyRichTextFieldAdapterEffect = ({
    adapter,
    host,
    initialValue,
    onChangeReference,
    setDialog,
  }: {
    readonly adapter: { current: BrowserAdapter | null };
    readonly host: { current: HTMLDivElement | null };
    readonly initialValue: RichText.Document;
    readonly onChangeReference: { current: (document: RichText.Document) => void };
    readonly setDialog: (dialog: RichTextInsertDialog) => void;
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
  applyRichTextFieldOnChangeEffect = (
    onChangeReference: { current: (document: RichText.Document) => void },
    onChange: (document: RichText.Document) => void,
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
          queryFn: () =>
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
      entryOptions: contentTypes.flatMap((contentType, index) =>
        (entryQueries[index]?.data?.items ?? []).map((entry) => ({
          identifier: entry.id,
          label: entryOptionLabel(entry.values, entry.id),
          type: contentType.label,
        })),
      ),
      host,
      setDialog,
      toolbar,
    };
  };

export default { useEntryEditorRichTextFieldState };
