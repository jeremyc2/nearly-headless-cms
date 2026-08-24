import { useMutation, useQueries, useQuery } from "@tanstack/react-query";
import { Link, useNavigate, useParams } from "@tanstack/react-router";
import { DateTime, Effect, Schema } from "effect";
import type { RichText } from "nearly-headless-cms";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  type EntryRepresentation,
  ManagementClientFailure,
} from "../generated/management-client.ts";
import {
  deletionConsequence,
  deletionRecordFrom,
  displayName,
  editorialIssues,
  stringValue,
  suggestedSlug,
} from "./main-entry-support.ts";
import {
  assetCaption,
  assetSelectValue,
  deletionStatus,
  dialogHeading,
  editorialButtonLabel,
  editorialConfirmationDescription,
  editorialConfirmationLabel,
  editorialStatus,
  entryDeletionTitle,
  entryOptionLabel,
  featuredAlternativeTextField,
  headingLevel,
  publicationInputValue,
  publicationValue,
  purgeStatus,
  revisionClass,
  revisionLabel,
  saveStatus,
  stringArrayValue,
} from "./main-labels.ts";
import {
  contentTypes,
  managementClient,
  preserveSelection,
  queryClient,
  richTextDocumentFrom,
} from "./main-shared.ts";
import { BrowserAdapter, RichTextEditor } from "./rich-text-editor/index.ts";

export const EntryEditor = () => {
  const { contentTypeId, entryId } = useParams({ from: "/content/$contentTypeId/$entryId" }),
    navigate = useNavigate(),
    state = useQuery({
      queryFn: () => Effect.runPromise(managementClient.getCurrentState(contentTypeId, entryId)),
      queryKey: ["entry-state", contentTypeId, entryId],
    }),
    authors = useQuery({
      enabled: contentTypeId === "post",
      queryFn: () => Effect.runPromise(managementClient.queryEntries("author", { pageSize: 100 })),
      queryKey: ["relationship-options", "author"],
    }),
    categories = useQuery({
      enabled: contentTypeId === "post",
      queryFn: () =>
        Effect.runPromise(managementClient.queryEntries("category", { pageSize: 100 })),
      queryKey: ["relationship-options", "category"],
    }),
    tags = useQuery({
      enabled: contentTypeId === "post",
      queryFn: () => Effect.runPromise(managementClient.queryEntries("tag", { pageSize: 100 })),
      queryKey: ["relationship-options", "tag"],
    }),
    assets = useQuery({
      enabled: contentTypeId === "post" || contentTypeId === "author",
      queryFn: () => Effect.runPromise(managementClient.listAssets()),
      queryKey: ["assets"],
    }),
    loadedEntryIdentifier = useRef<string | null>(null),
    [values, setValues] = useState<Record<string, unknown>>({}),
    [confirmDeletion, setConfirmDeletion] = useState(false),
    [confirmPurge, setConfirmPurge] = useState(false),
    [editorialConfirmation, setEditorialConfirmation] = useState<
      "draft" | "published" | "approved" | "rejected"
    >(),
    [deletionRecord, setDeletionRecord] = useState<{
      readonly contentTypeId: string;
      readonly entryId: string;
      readonly writeToken: string;
    }>(),
    [conflict, setConflict] = useState<
      | {
          readonly latest: {
            readonly entry: EntryRepresentation;
            readonly revisionNumber: number;
            readonly writeToken: string;
          };
        }
      | undefined
    >();
  useEffect(() => {
    if (state.data !== undefined && loadedEntryIdentifier.current !== entryId) {
      loadedEntryIdentifier.current = entryId;
      setValues(structuredClone(state.data.entry.values));
      setConflict(undefined);
    }
  }, [entryId, state.data]);
  const save = useMutation({
      mutationFn: ({
        replacementValues,
        writeToken,
      }: {
        readonly replacementValues: Readonly<Record<string, unknown>>;
        readonly writeToken?: string;
      }) =>
        Effect.runPromise(
          managementClient.replaceEntry({
            contentTypeId,
            entryId,
            values: replacementValues,
            writeToken,
          }),
        ),
      // oxlint-disable-next-line effecttsgo/async-function -- React query error callback awaits the latest server state.
      onError: async (error) => {
        if (Schema.is(ManagementClientFailure)(error) && error.status === 409) {
          const latest = await Effect.runPromise(
            managementClient.getCurrentState(contentTypeId, entryId),
          );
          setConflict({ latest });
        }
      },
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async (result) => {
        let updatedState;
        if ("entry" in result) {
          updatedState = result;
        } else {
          updatedState = { entry: result };
        }
        setValues(structuredClone(updatedState.entry.values));
        setConflict(undefined);
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] });
      },
    }),
    editorialCommand = useMutation({
      mutationFn: (status: "draft" | "published" | "approved" | "rejected") => {
        if (state.data === undefined || (contentTypeId !== "post" && contentTypeId !== "comment")) {
          throw new Error("Current Entry state is unavailable");
        }
        return Effect.runPromise(
          managementClient.runEditorialCommand({
            contentTypeId,
            entryId,
            status,
            writeToken: state.data.writeToken,
          }),
        );
      },
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async (result) => {
        setValues(structuredClone(result.entry.values));
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    }),
    deleteEntry = useMutation({
      // oxlint-disable-next-line effecttsgo/async-function -- deletion sequence requires awaited server state.
      mutationFn: async () => {
        if (
          state.data === undefined ||
          (contentTypeId !== "post" &&
            contentTypeId !== "author" &&
            contentTypeId !== "category" &&
            contentTypeId !== "tag" &&
            contentTypeId !== "comment")
        ) {
          throw new Error("Current Entry deletion state is unavailable");
        }
        const outcome = await Effect.runPromise(
            managementClient.deleteContentEntry(contentTypeId, entryId, state.data.writeToken),
          ),
          receipt = deletionRecordFrom(outcome);
        if (receipt === undefined) {
          throw new Error("The deletion did not return a retained deletion record");
        }
        return receipt;
      },
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async (receipt) => {
        setConfirmDeletion(false);
        setDeletionRecord(receipt);
        await queryClient.invalidateQueries({ queryKey: ["entries", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["count", contentTypeId] });
        await queryClient.invalidateQueries({ queryKey: ["navigation"] });
      },
    }),
    permanentlyPurge = useMutation({
      mutationFn: () => {
        if (deletionRecord === undefined) {
          throw new Error("Deletion record is unavailable");
        }
        return Effect.runPromise(
          managementClient.permanentlyPurgeEntry(
            deletionRecord.contentTypeId,
            deletionRecord.entryId,
            deletionRecord.writeToken,
          ),
        );
      },
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits navigation.
      // oxlint-disable-next-line effecttsgo/async-function -- asset invalidation follows the completed upload.
      // oxlint-disable-next-line effecttsgo/async-function -- cache invalidation follows deletion completion.
      // oxlint-disable-next-line effecttsgo/async-function -- asset invalidation follows deletion completion.
      onSuccess: async () => {
        await navigate({ params: { contentTypeId }, to: "/content/$contentTypeId" });
      },
    });
  let titleField = "display-name";
  if ("title" in values) {
    titleField = "title";
  } else if ("name" in values) {
    titleField = "name";
  }
  const title = stringValue(values[titleField], ""),
    bodyDocument = richTextDocumentFrom(values["body"]),
    profileDocument = richTextDocumentFrom(values["profile"]),
    updateField = (key: string, value: unknown) => {
      setValues((current) => {
        const replacement = { ...current, [key]: value };
        if (
          (key === "title" || key === "name") &&
          typeof value === "string" &&
          typeof current["slug"] === "string" &&
          (current["slug"] === suggestedSlug(stringValue(current[key], "")) ||
            current["slug"].startsWith("untitled-"))
        ) {
          return { ...replacement, slug: suggestedSlug(value) };
        }
        return replacement;
      });
    },
    saveValues = (replacementValues = values, writeToken = state.data?.writeToken) => {
      save.mutate({ replacementValues, writeToken });
    },
    setEditorialStatus = (status: "draft" | "published" | "approved" | "rejected") => {
      editorialCommand.mutate(status);
    };
  return (
    <div className="page editor-page">
      <header className="editor-header">
        <div>
          <Link to="/content/$contentTypeId" params={{ contentTypeId }} className="back-link">
            ← {contentTypeId}
          </Link>
          <h1>{title || "Entry"}</h1>
          <p>
            <span className="saved-dot" /> {saveStatus(save.isPending)} · Revision{" "}
            {state.data?.revisionNumber ?? "—"}
          </p>
        </div>
        <div className="editor-actions">
          <button className="secondary-button" type="button">
            Preview readiness
          </button>
          <button
            className="primary-button"
            type="button"
            disabled={save.isPending || state.data === undefined}
            onClick={() => {
              saveValues();
            }}
          >
            Save changes
          </button>
        </div>
      </header>
      {save.error && (
        <p className="error-state" role="alert">
          {save.error.message}
        </p>
      )}
      {conflict !== undefined && (
        <section className="conflict-panel" role="alert" aria-labelledby="conflict-title">
          <div>
            <p className="eyebrow">Conflict</p>
            <h2 id="conflict-title">A newer CMS revision exists</h2>
            <p>
              Your complete local draft is preserved. Compare it with revision{" "}
              {conflict.latest.revisionNumber}, then deliberately reapply or discard it.
            </p>
          </div>
          <div className="conflict-comparison">
            <details>
              <summary>Your local draft</summary>
              <pre>{JSON.stringify(values, null, 2)}</pre>
            </details>
            <details>
              <summary>Latest CMS revision</summary>
              <pre>{JSON.stringify(conflict.latest.entry.values, null, 2)}</pre>
            </details>
          </div>
          <div className="editor-actions">
            <button
              className="primary-button"
              type="button"
              disabled={save.isPending}
              onClick={() => {
                saveValues(values, conflict.latest.writeToken);
              }}
            >
              Reapply my draft
            </button>
            <button
              className="secondary-button"
              type="button"
              onClick={() => {
                setValues(structuredClone(conflict.latest.entry.values));
                queryClient.setQueryData(["entry-state", contentTypeId, entryId], conflict.latest);
                setConflict(undefined);
              }}
            >
              Discard my draft
            </button>
          </div>
        </section>
      )}
      {state.isLoading && <p>Loading current state…</p>}
      {!state.isLoading && (
        <div className="editor-layout">
          <section className="story-canvas panel">
            <p className="eyebrow">Story canvas</p>
            <label className="field full">
              <span>Title or name</span>
              <input
                value={title}
                onChange={(event) => {
                  updateField(titleField, event.target.value);
                }}
              />
            </label>
            {"slug" in values && (
              <div className="field">
                <label htmlFor="entry-slug">Slug</label>
                <input
                  id="entry-slug"
                  value={String(values["slug"])}
                  onChange={(event) => {
                    updateField("slug", event.target.value);
                  }}
                />
                <button
                  className="text-button"
                  type="button"
                  onClick={() => {
                    updateField("slug", suggestedSlug(title));
                  }}
                >
                  Suggest from title or name
                </button>
              </div>
            )}
            {"excerpt" in values && (
              <label className="field full">
                <span>Excerpt</span>
                <textarea
                  value={String(values["excerpt"])}
                  onChange={(event) => {
                    updateField("excerpt", event.target.value);
                  }}
                  rows={4}
                />
              </label>
            )}
            {"biography" in values && (
              <label className="field full">
                <span>Short biography</span>
                <textarea
                  value={stringValue(values["biography"], "")}
                  onChange={(event) => {
                    updateField("biography", event.target.value);
                  }}
                  rows={5}
                />
              </label>
            )}
            {"description" in values && (
              <label className="field full">
                <span>Description</span>
                <textarea
                  value={stringValue(values["description"], "")}
                  onChange={(event) => {
                    updateField("description", event.target.value || null);
                  }}
                  rows={4}
                />
              </label>
            )}
            {"body" in values && typeof values["body"] === "string" && (
              <label className="field full">
                <span>Body</span>
                <textarea
                  value={values["body"]}
                  onChange={(event) => {
                    updateField("body", event.target.value);
                  }}
                  rows={8}
                />
              </label>
            )}
            {bodyDocument !== undefined && (
              <RichTextField
                value={bodyDocument}
                onChange={(document) => {
                  updateField("body", document);
                }}
              />
            )}
            {profileDocument !== undefined && (
              <div className="field full">
                <span>Author profile</span>
                <RichTextField
                  value={profileDocument}
                  onChange={(document) => {
                    updateField("profile", document);
                  }}
                />
              </div>
            )}
            {contentTypeId === "post" && (
              <fieldset className="field-group full">
                <legend>Featured image</legend>
                <label className="field">
                  <span>Immutable Asset</span>
                  <select
                    value={assetSelectValue(values["featured-asset"])}
                    onChange={(event) => {
                      const assetIdentifier = event.target.value,
                        selectedAsset = assets.data?.find(
                          (candidate) => candidate.id === assetIdentifier,
                        );
                      updateField("featured-asset", assetIdentifier || null);
                      if (
                        selectedAsset?.metadata.defaultAlternativeText !== undefined &&
                        (values["featured-alternative-text"] === undefined ||
                          values["featured-alternative-text"] === null ||
                          values["featured-alternative-text"] === "")
                      ) {
                        updateField(
                          "featured-alternative-text",
                          selectedAsset.metadata.defaultAlternativeText,
                        );
                      }
                    }}
                  >
                    <option value="">No featured Asset</option>
                    {assets.data?.map((asset) => (
                      <option value={asset.id} key={asset.id}>
                        {asset.metadata.filename} · {asset.metadata.mediaType}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  <span>Featured image alternative text</span>
                  <input
                    id="field-featured-alternative-text"
                    value={stringValue(values["featured-alternative-text"], "")}
                    onChange={(event) => {
                      updateField("featured-alternative-text", event.target.value || null);
                    }}
                  />
                </label>
                {typeof values["featured-asset"] === "string" && (
                  <p className="field-help">
                    {assets.data?.find((asset) => asset.id === values["featured-asset"])?.metadata
                      .filename ?? "Selected immutable Asset"}
                  </p>
                )}
              </fieldset>
            )}
            {contentTypeId === "author" && (
              <fieldset className="field-group full">
                <legend>Portrait</legend>
                <label className="field">
                  <span>Immutable Asset</span>
                  <select
                    value={assetSelectValue(values["portrait"])}
                    onChange={(event) => {
                      updateField("portrait", event.target.value || null);
                    }}
                  >
                    <option value="">No portrait</option>
                    {assets.data?.map((asset) => (
                      <option value={asset.id} key={asset.id}>
                        {asset.metadata.filename}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="field full">
                  <span>Portrait alternative text</span>
                  <input
                    value={stringValue(values["portrait-alternative-text"], "")}
                    onChange={(event) => {
                      updateField("portrait-alternative-text", event.target.value || null);
                    }}
                  />
                </label>
              </fieldset>
            )}
          </section>
          <aside className="editor-sidebar">
            <section className="panel">
              <p className="eyebrow">Publication</p>
              <h2>CMS state</h2>
              {contentTypeId === "post" && (
                <>
                  <label className="field">
                    <span>Author</span>
                    <select
                      value={stringValue(values["author"], "")}
                      onChange={(event) => {
                        updateField("author", event.target.value);
                      }}
                    >
                      {authors.data?.items.map((author) => (
                        <option value={author.id} key={author.id}>
                          {displayName(author)}
                        </option>
                      ))}
                    </select>
                    <small>The Author describes the content; it is not a login identity.</small>
                  </label>
                  <label className="field">
                    <span>Categories</span>
                    <select
                      multiple
                      value={stringArrayValue(values["categories"])}
                      onChange={(event) => {
                        updateField(
                          "categories",
                          [...event.currentTarget.selectedOptions].map((option) => option.value),
                        );
                      }}
                    >
                      {categories.data?.items.map((category) => (
                        <option value={category.id} key={category.id}>
                          {displayName(category)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Tags</span>
                    <select
                      multiple
                      value={stringArrayValue(values["tags"])}
                      onChange={(event) => {
                        updateField(
                          "tags",
                          [...event.currentTarget.selectedOptions].map((option) => option.value),
                        );
                      }}
                    >
                      {tags.data?.items.map((tag) => (
                        <option value={tag.id} key={tag.id}>
                          {displayName(tag)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span>Publication time</span>
                    <input
                      type="datetime-local"
                      value={publicationInputValue(values["published-at"])}
                      onChange={(event) => {
                        updateField("published-at", publicationValue(event.target.value));
                      }}
                    />
                  </label>
                </>
              )}
              {"status" in values && (
                <div className="field">
                  <span>Status</span>
                  <output className="status-readout">
                    {stringValue(values["status"], "active")}
                  </output>
                  <small>Status changes only through the explicit editorial command below.</small>
                </div>
              )}
              <p className="boundary-note">
                Saving changes the CMS. Publishing makes a Post eligible for the next static build.
              </p>
              {editorialCommand.error && (
                <div className="error-state issue-summary" role="alert">
                  <strong>{editorialCommand.error.message}</strong>
                  {editorialIssues(editorialCommand.error).length > 0 && (
                    <ul>
                      {editorialIssues(editorialCommand.error).map((issue) => {
                        const rootField = String(issue.path[0] ?? "body"),
                          targetIdentifier = featuredAlternativeTextField(rootField);
                        return (
                          <li key={`${issue.path.join(".")}-${issue.reason}`}>
                            <a href={`#${targetIdentifier}`}>
                              {issue.path.join(" → ")}: {issue.reason}
                            </a>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              )}
              {contentTypeId === "post" && (
                <button
                  className="primary-button full-button"
                  disabled={editorialCommand.isPending}
                  type="button"
                  onClick={() => {
                    setEditorialConfirmation(editorialStatus(values["status"]));
                  }}
                >
                  {editorialButtonLabel(values["status"])}
                </button>
              )}
              {contentTypeId === "comment" && (
                <div className="editor-actions">
                  <button
                    className="primary-button"
                    disabled={editorialCommand.isPending}
                    type="button"
                    onClick={() => {
                      setEditorialConfirmation("approved");
                    }}
                  >
                    Approve
                  </button>
                  <button
                    className="secondary-button"
                    disabled={editorialCommand.isPending}
                    type="button"
                    onClick={() => {
                      setEditorialConfirmation("rejected");
                    }}
                  >
                    Reject
                  </button>
                </div>
              )}
            </section>
            <HistoryPanel
              contentTypeId={contentTypeId}
              entryId={entryId}
              writeToken={state.data?.writeToken}
            />
            <section className="panel danger-panel">
              <p className="eyebrow">Danger zone</p>
              <h2>Delete this Entry</h2>
              <p>{deletionConsequence(contentTypeId)}</p>
              <button
                className="danger-button"
                type="button"
                disabled={deleteEntry.isPending || state.data === undefined}
                onClick={() => {
                  setConfirmDeletion(true);
                }}
              >
                Delete Entry…
              </button>
              {deleteEntry.error && (
                <p className="error-state" role="alert">
                  {deleteEntry.error.message}
                </p>
              )}
            </section>
          </aside>
        </div>
      )}
      {editorialConfirmation !== undefined && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="editorial-command-title"
          >
            <p className="eyebrow">Confirm editorial change</p>
            <h2 id="editorial-command-title">
              {editorialConfirmationLabel(editorialConfirmation)}
            </h2>
            <p>{editorialConfirmationDescription(editorialConfirmation)}</p>
            <div className="editor-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setEditorialConfirmation(undefined);
                }}
              >
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={editorialCommand.isPending}
                onClick={() => {
                  setEditorialStatus(editorialConfirmation);
                  setEditorialConfirmation(undefined);
                }}
              >
                Confirm change
              </button>
            </div>
          </div>
        </div>
      )}
      {(confirmDeletion || deletionRecord !== undefined) && (
        <div className="rich-dialog-backdrop">
          <div
            className="rich-dialog destructive-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="entry-deletion-title"
          >
            {deletionRecord === undefined && (
              <>
                <p className="eyebrow">Confirm deletion</p>
                <h2 id="entry-deletion-title">Delete “{entryDeletionTitle(title)}”?</h2>
                <p>{deletionConsequence(contentTypeId)}</p>
                <p>The retained revisions can be restored until you permanently purge them.</p>
                <div className="editor-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setConfirmDeletion(false);
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={deleteEntry.isPending}
                    onClick={() => {
                      deleteEntry.mutate();
                    }}
                  >
                    {deletionStatus(deleteEntry.isPending)}
                  </button>
                </div>
              </>
            )}
            {deletionRecord !== undefined && confirmPurge && (
              <>
                <p className="eyebrow">Irreversible action</p>
                <h2 id="entry-deletion-title">Permanently purge retained history?</h2>
                <p>
                  This cannot be undone. Every retained revision and the restoration path vanish.
                </p>
                {permanentlyPurge.error && (
                  <p className="error-state" role="alert">
                    {permanentlyPurge.error.message}
                  </p>
                )}
                <div className="editor-actions">
                  <button
                    className="secondary-button"
                    type="button"
                    onClick={() => {
                      setConfirmPurge(false);
                    }}
                  >
                    Keep retained history
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    disabled={permanentlyPurge.isPending}
                    onClick={() => {
                      permanentlyPurge.mutate();
                    }}
                  >
                    {purgeStatus(permanentlyPurge.isPending)}
                  </button>
                </div>
              </>
            )}
            {deletionRecord !== undefined && !confirmPurge && (
              <>
                <p className="eyebrow">Entry deleted</p>
                <h2 id="entry-deletion-title">The live Entry is gone</h2>
                <p>Its retained history remains available for restoration through the API.</p>
                <div className="editor-actions">
                  <button
                    className="primary-button"
                    type="button"
                    onClick={() => {
                      void navigate({ params: { contentTypeId }, to: "/content/$contentTypeId" });
                    }}
                  >
                    Return to list
                  </button>
                  <button
                    className="danger-button"
                    type="button"
                    onClick={() => {
                      setConfirmPurge(true);
                    }}
                  >
                    Permanently purge…
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
const RichTextField = ({
  value,
  onChange,
}: {
  readonly value: RichText.Document;
  readonly onChange: (document: RichText.Document) => void;
}) => {
  const host = useRef<HTMLDivElement>(null),
    toolbar = useRef<HTMLDivElement>(null),
    adapter = useRef<BrowserAdapter | null>(null),
    onChangeReference = useRef(onChange),
    initialValue = useMemo(() => value, []),
    [dialog, setDialog] = useState<
      | { readonly type: "link"; readonly label: string; readonly url: string }
      | { readonly type: "entry"; readonly entryId: string; readonly label: string }
      | {
          readonly type: "asset";
          readonly assetId: string;
          readonly alternativeText: string;
          readonly caption: string;
        }
    >(),
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
    <div className="rich-text-shell" id="field-body">
      <div ref={toolbar} className="rich-toolbar" role="toolbar" aria-label="Rich Text formatting">
        <label className="rich-block-picker">
          <span className="visually-hidden">Block type</span>
          <select
            aria-label="Block type"
            defaultValue="paragraph"
            onChange={(event) => {
              const blockType = event.target.value;
              if (
                blockType === "heading-2" ||
                blockType === "heading-3" ||
                blockType === "heading-4"
              ) {
                adapter.current?.dispatch({
                  blockType: "heading",
                  headingLevel: headingLevel(blockType),
                  type: "setBlockKind",
                });
              } else if (
                blockType === "paragraph" ||
                blockType === "quote" ||
                blockType === "code-block"
              ) {
                adapter.current?.dispatch({ blockType, type: "setBlockKind" });
              }
            }}
          >
            <option value="paragraph">Paragraph</option>
            <option value="heading-2">Heading 2</option>
            <option value="heading-3">Heading 3</option>
            <option value="heading-4">Heading 4</option>
            <option value="quote">Quote</option>
            <option value="code-block">Code block</option>
          </select>
        </label>
        <button
          type="button"
          aria-label="Bold"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "bold", type: "toggleMark" })}
        >
          <strong>B</strong>
        </button>
        <button
          type="button"
          aria-label="Italic"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "italic", type: "toggleMark" })}
        >
          <em>I</em>
        </button>
        <button
          type="button"
          aria-label="Strikethrough"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "strikethrough", type: "toggleMark" })}
        >
          <s>S</s>
        </button>
        <button
          type="button"
          aria-label="Inline code"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ mark: "code", type: "toggleMark" })}
        >
          Code
        </button>
        <button
          type="button"
          aria-label="Unordered list"
          onMouseDown={preserveSelection}
          onClick={() =>
            adapter.current?.dispatch({ listType: "unordered-list", type: "toggleList" })
          }
        >
          • List
        </button>
        <button
          type="button"
          aria-label="Ordered list"
          onMouseDown={preserveSelection}
          onClick={() =>
            adapter.current?.dispatch({ listType: "ordered-list", type: "toggleList" })
          }
        >
          1. List
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => {
            setDialog({ label: "", type: "link", url: "" });
          }}
        >
          Link
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => {
            setDialog({ entryId: "", label: "", type: "entry" });
          }}
        >
          Entry reference
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => {
            setDialog({
              alternativeText: "",
              assetId: "",
              caption: "",
              type: "asset",
            });
          }}
        >
          Asset
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ type: "undo" })}
        >
          Undo
        </button>
        <button
          type="button"
          onMouseDown={preserveSelection}
          onClick={() => adapter.current?.dispatch({ type: "redo" })}
        >
          Redo
        </button>
      </div>
      <div ref={host} className="rich-surface" aria-label="Rich Text content" />
      {dialog !== undefined && (
        <div
          className="rich-dialog-backdrop"
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              closeDialog();
            }
          }}
        >
          <div
            className="rich-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Insert ${dialog.type} reference`}
          >
            <h3>Insert {dialogHeading(dialog.type)}</h3>
            {dialog.type === "link" && (
              <>
                <label>
                  <span>URL</span>
                  <input
                    autoFocus
                    type="url"
                    value={dialog.url}
                    onChange={(event) => {
                      setDialog({ ...dialog, url: event.target.value });
                    }}
                  />
                </label>
                <label>
                  <span>Label for a collapsed selection</span>
                  <input
                    value={dialog.label}
                    onChange={(event) => {
                      setDialog({ ...dialog, label: event.target.value });
                    }}
                  />
                </label>
              </>
            )}
            {dialog.type === "entry" && (
              <>
                <label>
                  <span>Entry ID</span>
                  <select
                    autoFocus
                    value={dialog.entryId}
                    onChange={(event) => {
                      setDialog({ ...dialog, entryId: event.target.value });
                    }}
                  >
                    <option value="">Select an Entry</option>
                    {entryOptions.map((entry) => (
                      <option key={entry.identifier} value={entry.identifier}>
                        {entry.type} · {entry.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Label for a collapsed selection</span>
                  <input
                    value={dialog.label}
                    onChange={(event) => {
                      setDialog({ ...dialog, label: event.target.value });
                    }}
                  />
                </label>
              </>
            )}
            {dialog.type === "asset" && (
              <>
                <label>
                  <span>Asset</span>
                  <select
                    autoFocus
                    value={dialog.assetId}
                    onChange={(event) => {
                      setDialog({ ...dialog, assetId: event.target.value });
                    }}
                  >
                    <option value="">Select an Asset</option>
                    {assets.data?.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.metadata.filename}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Alternative text</span>
                  <input
                    value={dialog.alternativeText}
                    onChange={(event) => {
                      setDialog({ ...dialog, alternativeText: event.target.value });
                    }}
                  />
                </label>
                <label>
                  <span>Caption (optional)</span>
                  <input
                    value={dialog.caption}
                    onChange={(event) => {
                      setDialog({ ...dialog, caption: event.target.value });
                    }}
                  />
                </label>
              </>
            )}
            <div className="editor-actions">
              <button className="secondary-button" type="button" onClick={closeDialog}>
                Cancel
              </button>
              <button
                className="primary-button"
                type="button"
                disabled={
                  (dialog.type === "link" && dialog.url.length === 0) ||
                  (dialog.type === "entry" && dialog.entryId.length === 0) ||
                  (dialog.type === "asset" && dialog.assetId.length === 0)
                }
                onClick={() => {
                  if (dialog.type === "link") {
                    adapter.current?.dispatch({
                      label: dialog.label,
                      type: "wrapLink",
                      url: dialog.url,
                    });
                  } else if (dialog.type === "entry") {
                    adapter.current?.dispatch({
                      entryId: dialog.entryId,
                      label: dialog.label,
                      type: "insertEntryReference",
                    });
                  } else {
                    adapter.current?.dispatch({
                      alternativeText: dialog.alternativeText,
                      assetId: dialog.assetId,
                      ...assetCaption(dialog.caption),
                      type: "insertAssetReference",
                    });
                  }
                  closeDialog();
                }}
              >
                Insert
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
},

 HistoryPanel = ({
  contentTypeId,
  entryId,
  writeToken,
}: {
  readonly contentTypeId: string;
  readonly entryId: string;
  readonly writeToken?: string;
}) => {
  const [selectedRevisionNumber, setSelectedRevisionNumber] = useState<number>(),
    revisions = useQuery({
      queryFn: () => Effect.runPromise(managementClient.listRevisions(contentTypeId, entryId)),
      queryKey: ["revisions", contentTypeId, entryId],
    }),
    inspectedRevision = useQuery({
      enabled: selectedRevisionNumber !== undefined,
      queryFn: () =>
        Effect.runPromise(
          managementClient.inspectRevision(contentTypeId, entryId, selectedRevisionNumber ?? 0),
        ),
      queryKey: ["revision", contentTypeId, entryId, selectedRevisionNumber],
    }),
    restore = useMutation({
      mutationFn: (revisionNumber: number) => {
        if (writeToken === undefined) {
          throw new Error("Current Write Token is unavailable");
        }
        return Effect.runPromise(
          managementClient.restoreRevision({
            contentTypeId,
            entryId,
            revisionNumber,
            writeToken,
          }),
        );
      },
      // oxlint-disable-next-line effecttsgo/async-function -- React query callback awaits cache invalidation.
      onSuccess: async () => {
        setSelectedRevisionNumber(undefined);
        await queryClient.invalidateQueries({ queryKey: ["entry-state", contentTypeId, entryId] });
        await queryClient.invalidateQueries({ queryKey: ["revisions", contentTypeId, entryId] });
      },
    });
  return (
    <section className="panel history-panel">
      <p className="eyebrow">History</p>
      <h2>Entry revisions</h2>
      {restore.error && (
        <p className="error-state" role="alert">
          {restore.error.message}
        </p>
      )}
      {revisions.data?.items.map((revision, index) => (
        <button
          className="revision-row"
          onClick={() => {
            setSelectedRevisionNumber(revision.revisionNumber);
          }}
          key={revision.revisionNumber}
        >
          <span className={revisionClass(index)} />
          <span>
            <strong>Revision {revision.revisionNumber}</strong>
            <small>
              {revisionLabel(index)}
              {DateTime.toDate(DateTime.makeUnsafe(revision.recordedAt)).toLocaleString()}
            </small>
          </span>
        </button>
      ))}
      {selectedRevisionNumber !== undefined && (
        <div className="revision-inspection" role="dialog" aria-modal="true">
          <div className="revision-inspection-card">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Complete captured values</p>
                <h2>Revision {selectedRevisionNumber}</h2>
              </div>
              <button
                className="secondary-button"
                type="button"
                onClick={() => {
                  setSelectedRevisionNumber(undefined);
                }}
              >
                Close
              </button>
            </div>
            {inspectedRevision.isLoading && <p>Loading revision…</p>}
            {!inspectedRevision.isLoading && (
              <pre>{JSON.stringify(inspectedRevision.data?.values, null, 2)}</pre>
            )}
            <button
              className="primary-button"
              type="button"
              disabled={restore.isPending || writeToken === undefined}
              onClick={() => {
                restore.mutate(selectedRevisionNumber);
              }}
            >
              Restore as a new revision
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
