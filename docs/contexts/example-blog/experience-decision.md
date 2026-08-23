# Example CMS and Public Blog Experience

## Decision

The complete reference experience uses a conventional, responsive Example CMS workbench as its baseline information architecture. A persistent content navigation exposes Posts, Authors, Categories, Tags, Assets, and Comments; overview counters and focused queues make drafts and pending Comments visible without turning builder-defined status Fields into library workflow. Post authoring uses a broad story canvas with contextual metadata and history beside it on wide screens and stacked below it on narrower screens. The content-first canvas and explicit publication review exercised by the prototype remain useful patterns inside this workbench, while the prototype's full operational board does not become the primary navigation.

The Example CMS opens to an overview showing Content Type counts, draft Posts, pending Comments, the current Public Blog build, recently edited content, and tasks needing attention. Content lists support the already settled pagination, sorting, title or name filtering, and relevant status or type filters. Selecting an Entry opens a dedicated editor route rather than a transient board drawer, so browser history, links, focus restoration, and unsaved-draft handling have stable page boundaries.

## Post authoring

A Post editor presents title, slug, excerpt, semantic Rich Text body, featured Asset, Author, Categories, Tags, Post Status, and publication time without introducing presentation metadata into the Content Definition. The field layout follows the application-owned Field Kind heuristics: story text spans the available width, constrained values remain compact, and relationships and Assets use contextual pickers. The Author control describes content rather than identity. The featured image displays its immutable Asset metadata and an authored alternative-text value.

The Rich Text surface makes the portable semantic boundary visible through its supported blocks, marks, links, Entry references, and Asset references. It does not promise a rendered Public Blog preview. Drafts may contain incomplete editorial values, but the publication command reports Field-path issues for every builder-defined public rule, including non-empty alternative text for published images and live public references. Failure retains the complete local draft and focuses an issue summary linked to the invalid controls.

Saving is distinct from publishing. Save performs a complete history-aware Entry replacement with the current Write Token and creates the next Entry Revision. Publish and return-to-draft are explicit builder-defined Management Operations that atomically update the ordinary Post Status and publication-time Fields and create a new revision. Their destructive or public consequences receive clear human confirmation where appropriate, but the transport does not carry ceremonial confirmation booleans.

The editor retains unsaved input after validation, transport, and conflict failures. A stale Write Token never triggers an automatic overwrite: the interface identifies the conflict, preserves the local draft, loads the latest Current Entry State for comparison, and lets the author deliberately reapply or discard their changes. Mutation retry remains disabled except for an operation whose contract explicitly makes it idempotent.

## History and restoration

The Post editor exposes a history panel with newest-first Revision metadata and a separate inspection view for a complete revision. The interface never presents a Revision Number as the concurrency token. Restoring a revision requires the current Write Token, revalidates the captured values and live references against the active Definition Snapshot, and creates a new current Entry Revision that names its source; it does not move a history pointer backward or erase later revisions.

Returning a published Post to draft removes it from the CMS's public-eligible state immediately but not from an already generated Public Blog. Deletion remains a separate confirmed command whose configured cascade removes associated Comments atomically. Permanent Purge is available only for an already deleted history-enabled Entry and uses stronger irreversible-action treatment than ordinary deletion.

## Public Blog boundary

Publication and static generation are deliberately separate moments. A successful publish changes the Example CMS and makes the Post eligible for the next Public Content Export. It does not claim that the Public Blog changed. The reference-development shell and acceptance tooling may show that the CMS and current static build differ and offer an explicitly demonstration-owned rebuild control, but the ordinary CMS authoring contract contains no deploy or refresh operation.

The Public Blog shows its generated-build identity in development and prototype surfaces, not as required public-site chrome. One Astro build obtains exactly one coherent `exportPublicBlog` artifact and uses it for the latest-Posts home page, Post pages, Author pages, Category pages, Tag pages, paginated listings, approved Comments, and RSS. Referenced Asset bytes arrive separately through the authorized Asset Delivery Operation. The Content Client derives all routes and presentation from public values and renders semantic Rich Text itself; no CMS-authored HTML or Public Blog URL crosses the Headless API.

The Public Blog has no draft-preview route, content-refresh control, or browser-time content query. Public-affecting CMS changes appear together at the next successful static refresh. An unavailable, invalid, unsupported, or over-bound export fails the build without replacing the last successful output.

## Comment path

The progressively enhanced Post Comment form is the Public Blog's only browser-time content mutation. It collects bounded display name, optional website URL, and plain-text body, retains input after accessible validation or transport failure, and submits them with a stable idempotency key to the builder-defined Headless Delivery Command. Success displays only the opaque submission identifier and public `pending` status. The interface neither echoes the submitted body from the receipt nor exposes a moderation link.

Pending Comments appear in a focused Example CMS moderation queue, oldest first. Approval and rejection are explicit builder-defined Management Operations that update the ordinary Comment Status Field and create the next Comment revision when history is enabled. Rejected Comments remain stored and never enter the public export. Approved Comments become visible only after the next static refresh; the moderation interface states this consequence instead of implying immediate publication.

## Responsive and accessible behavior

The Example CMS uses its persistent navigation and side-by-side editor at desktop widths, reduces navigation to a compact rail at intermediate widths, and stacks navigation, story fields, metadata, and history at narrow widths. The supported v0.1 authoring target remains macOS desktop keyboard and mouse; narrow layouts prove responsive reading and basic management rather than mobile Rich Text editing.

The Public Blog is fully responsive from narrow phone widths through desktop. It uses semantic landmarks and headings, keyboard-operable navigation and forms, visible focus, meaningful image alternative text, accessible Field-level errors connected to a summary, and a status announcement for the pending Comment receipt. Route pages remain independently addressable and usable without client JavaScript; Comment enhancement is progressive.

## Prototype verdict

The prototype answered the ticket affirmatively. The domain, CMS interactions, Comment path, revision controls, responsive Public Blog, and headless boundary form one coherent implementation target when the interface repeatedly distinguishes four states: locally edited, saved in the CMS, public-eligible in the CMS, and present in a particular static Public Blog build.

Three structures were exercised:

- The guided workbench scaled best across generic content management, focused queues, authoring, moderation, Assets, and history, so it supplies the baseline application shell.
- The editorial journey made publication review and the static boundary easiest to understand, so the Post editor retains its content-first canvas, explicit readiness summary, and public-consequence language.
- The operations board made drafts, moderation, and generated output legible at a glance, so those signals become overview tasks and queue counters rather than the primary Entry-editing model.

The prototype is retained as a primary source on the `codex/example-cms-blog-experience-prototype` branch at `prototypes/example-cms-blog-experience.prototype.html`. It is throwaway, in-memory code and is not an implementation starting point.

## Consequences

- The implementation needs explicit application state and copy for the distinction between unsaved, CMS-saved, CMS-public-eligible, and statically generated content.
- The Example CMS needs stable routes for overview, Content Type lists, Entry editors, Comment moderation, Assets, history inspection, and API documentation; a board or wizard is insufficient as the sole shell.
- Complete-experience acceptance must span both applications and prove publish, return-to-draft, rebuild, Comment submission, moderation, revision restoration, conflict retention, responsive layouts, and the absence of draft or unapproved content from the Headless API.
- A static-site rebuild is part of the reference-development and acceptance rig, not a reusable-library operation or generic CMS editorial command.
- The library remains presentation-neutral: all workflow language, layout, readiness rules, route construction, responsive behavior, and rendering stay owned by the Example applications and their builder-defined operations.
