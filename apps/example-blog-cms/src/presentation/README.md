# Reference admin UI

This folder is the **reference admin UI** for the Example CMS. It is a React dashboard that talks to the management API.

**Skip this folder on first read.** Start with `../core/` to understand the CMS Builder composition, then return here if you want to see how a management UI can consume the API.

## What lives here

| Path | Purpose |
| --- | --- |
| `index.html` | Browser entrypoint (loaded by `server.ts` at dev time) |
| `main.tsx` | React bootstrap and router setup |
| `*.tsx`, `*.ts` | Dashboard pages, entry editor, assets, and rich-text editor |
| `styles.css` | Tailwind-based styling |

The UI uses typed clients from `../generated/management-client.ts`. Those clients are auto-generated from the management OpenAPI spec — do not edit them by hand.

## Replacing the UI

You can delete or ignore this entire folder and bring your own admin UI. The CMS Builder core in `../core/` does not depend on React or any file here.
