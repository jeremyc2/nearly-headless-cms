import { type ContentListController, useContentListController } from "./content-list-controller.ts";
import { activeStatusClass, sortDirectionValue, sortLabel, statusOptions } from "./main-labels.ts";
import { displayName, stringValue } from "./main-entry-support.ts";
import type { EntryRepresentation } from "../generated/management-client.ts";
import { Link } from "@tanstack/react-router";

export const ContentList = () => {
    const controller = useContentListController();
    return (
      <div className="page">
        <ContentListHeader controller={controller} />
        {controller.createEntry.error && (
          <p className="error-state" role="alert">
            {controller.createEntry.error.message}
          </p>
        )}
        <section className="panel list-panel">
          <ContentListTools controller={controller} />
          {controller.entries.isLoading && <p className="empty-state">Loading Entries…</p>}
          {controller.entries.error && (
            <p className="error-state">{controller.entries.error.message}</p>
          )}
          <ContentListEntries controller={controller} />
          <ContentListPagination controller={controller} />
        </section>
      </div>
    );
  },
  ContentListEntries = <Controller extends ContentListController>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <div className="entry-list">
      {controller.entries.data?.items.map((entry: EntryRepresentation) => (
        <Link
          key={entry.id}
          className="entry-row"
          params={{ contentTypeId: controller.contentTypeId, entryId: entry.id }}
          to="/content/$contentTypeId/$entryId"
        >
          <span className="entry-monogram">{displayName(entry).slice(0, 1)}</span>
          <span className="entry-title">
            <strong>{displayName(entry)}</strong>
            <small>{stringValue(entry.values["slug"] ?? entry.values["status"], entry.id)}</small>
          </span>
          <span className={`status-pill ${activeStatusClass(entry.values["status"])}`}>
            {stringValue(entry.values["status"], "active")}
          </span>
          <span>→</span>
        </Link>
      ))}
    </div>
  ),
  ContentListHeader = <Controller extends ContentListController>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <header className="page-header">
      <div>
        <p className="eyebrow">Content</p>
        <h1>{controller.contentType?.label ?? controller.contentTypeId}</h1>
        <p>Manage complete Entries through the active Content Definition.</p>
      </div>
      <button
        className="primary-button"
        disabled={controller.createEntry.isPending}
        onClick={() => {
          controller.createEntry.mutate();
        }}
      >
        New {controller.contentType?.label.slice(0, -1)}
      </button>
    </header>
  ),
  ContentListPagination = <Controller extends ContentListController>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <nav aria-label="Entry pages" className="pagination">
      <button
        className="secondary-button"
        disabled={controller.priorCursors.length === 0}
        onClick={() => {
          const previousCursor = controller.priorCursors.at(-1);
          controller.setPriorCursors((current) => current.slice(0, -1));
          controller.setCursor(previousCursor);
        }}
        type="button"
      >
        Previous
      </button>
      <span>Page {controller.priorCursors.length + 1}</span>
      <button
        className="secondary-button"
        disabled={controller.entries.data?.nextCursor === undefined}
        onClick={() => {
          if (controller.entries.data?.nextCursor !== undefined) {
            controller.setPriorCursors((current) => [...current, controller.cursor]);
            controller.setCursor(controller.entries.data.nextCursor);
          }
        }}
        type="button"
      >
        Next
      </button>
    </nav>
  ),
  ContentListStatusFilter = <Controller extends ContentListController>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <label>
      <span className="visually-hidden">Filter by status</span>
      <select
        aria-label="Filter by status"
        onChange={(event) => {
          controller.setStatusFilter(event.target.value);
        }}
        value={controller.statusFilter}
      >
        <option value="all">Status: all</option>
        {statusOptions(controller.contentTypeId).map((status) => (
          <option key={status} value={status}>
            {status}
          </option>
        ))}
      </select>
    </label>
  ),
  ContentListTools = <Controller extends ContentListController>({
    controller,
  }: {
    readonly controller: Readonly<Controller>;
  }) => (
    <div className="list-tools">
      <label>
        <span className="visually-hidden">Filter entries</span>
        <input
          onChange={(event) => {
            controller.setFilterText(event.target.value);
          }}
          placeholder={`Filter ${controller.contentType?.label.toLowerCase() ?? "entries"}`}
          value={controller.filterText}
        />
      </label>
      {(controller.contentTypeId === "post" || controller.contentTypeId === "comment") && (
        <ContentListStatusFilter controller={controller} />
      )}
      <label>
        <span className="visually-hidden">Sort entries</span>
        <select
          aria-label="Sort entries"
          onChange={(event) => {
            controller.setSortDirection(sortDirectionValue(event.target.value));
          }}
          value={controller.sortDirection}
        >
          <option value="descending">{sortLabel(controller.contentTypeId, true)}</option>
          <option value="ascending">{sortLabel(controller.contentTypeId, false)}</option>
        </select>
      </label>
    </div>
  );

