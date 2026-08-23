# Example Blog

The Example Blog is the content domain exercised by the polished reference implementation and its end-to-end acceptance tests.

## Language

**Example CMS**:
The polished blog CMS maintained in this monorepo to demonstrate a complete composition of the library and anchor its end-to-end acceptance tests. Its content lists provide pagination, sorting, title/name filtering, and relevant status/type filters, but not broad full-text search. It is source code for reference, not a package published to npm.
_Avoid_: Demo, toy app, sample code

**Public Blog**:
The separately runnable static Content Client that generates its assets from the Example CMS's Headless API and owns all visual presentation of the Example Blog. Bun serves its generated assets; Public Visitors submit Comments directly to the Headless API. It exposes a latest-Posts home page, Post, Author, Category, and Tag pages, paginated listing pages, and an RSS feed. Listings show published Posts newest-first with stable pagination. Public-affecting changes appear at the next static refresh. Its presentation is responsive and accessible through semantic HTML, keyboard navigation, visible focus states, meaningful image alt text, and accessible Comment-form errors. It has no draft-preview route.
_Avoid_: CMS UI, preview

**Post**:
The primary publishable content in the Example CMS. A Post has a title, slug, excerpt, Rich Text body, optional featured Asset, one Author, zero or more Categories and Tags, a Post Status, and an optional publication time. Deleting a Post requires explicit confirmation and automatically deletes its associated Comments.
_Avoid_: Article

**Author**:
Content describing a person credited with a Post. An Author has a name, slug, short biography, optional Rich Text profile, optional portrait Asset, and optional external links. An Author is unrelated to authentication or any logged-in identity. Deleting an Author requires explicit confirmation and automatically deletes that Author's Posts and their associated Comments.
_Avoid_: User, account

**Post Status**:
An ordinary CMS Builder-defined field on a Post whose values include draft and published. New Posts start as drafts. Only published Posts appear on the Public Blog and RSS feed; returning a Post to draft removes it from public output at the next static refresh. It carries no library-defined lifecycle behavior.
_Avoid_: Publication lifecycle

**Comment**:
Content submitted through the Public Blog and related to a Post. A Comment has a bounded-length display name and plain-text body, optional website URL, creation time, and Comment Status. Comment moderation is expressed through ordinary CMS Builder-defined Fields, not library-defined workflow semantics. Comments do not have replies, visitor editing/deletion, likes, or email notifications. Its public endpoint returns generic validation errors; deployment-owned policy handles anonymous rate limiting.
_Avoid_: Feedback, message

**Comment Status**:
An ordinary CMS Builder-defined field on a Comment whose values include pending, approved, and rejected. New Comments are pending. The Example CMS queues pending Comments for approval or rejection; rejected Comments remain stored but never appear publicly. Only approved Comments are displayed by the Public Blog.
_Avoid_: Moderation workflow

**Category**:
Content used to group Posts into independently addressable editorial sections. A Category has a unique name, unique slug, and optional description. Categories are flat, and a Post can be related to multiple Categories. Deleting a Category requires explicit confirmation and automatically detaches it from related Posts.
_Avoid_: Folder, collection

**Tag**:
Content used to label Posts with independently addressable, cross-cutting topics. A Tag has a unique name, unique slug, and optional description. Tags are flat, and a Post can be related to multiple Tags. Deleting a Tag requires explicit confirmation and automatically detaches it from related Posts.
_Avoid_: Keyword string

**Public Visitor**:
A person using the Public Blog without an authenticated identity. A Public Visitor can submit a Comment but has no authoring or moderation authority.
_Avoid_: User, account
