# Nearly Headless CMS

<img width="496" height="279" alt="Nearly Headless CMS" src="https://github.com/user-attachments/assets/93b12b6f-40fc-44d5-80ef-5dd81f9b03c6" />

Nearly Headless CMS is an Effect library for CMS Builders who want reusable, presentation-neutral content behavior while bringing their own UI, persistence, identity, authorization, transport, Assets, and runtime Layers.

This Bun monorepo contains exactly three workspaces:

- [`packages/nearly-headless-cms`](packages/nearly-headless-cms) — the sole npm-publishable ESM package;
- [`apps/example-cms`](apps/example-cms) — a polished open-access React/Effect/Bun reference CMS; and
- [`apps/public-blog`](apps/public-blog) — an Astro static Content Client that imports neither the CMS nor the library and consumes only the Headless API.

## Library

The publishable npm package is [`nearly-headless-cms`](packages/nearly-headless-cms). See its [README](packages/nearly-headless-cms/README.md) for installation, every public import path, runtime compatibility, and the v0.1 stability policy.

## Development

```sh
bun install --frozen-lockfile
bun run verify
```

Run the Example CMS at `http://localhost:3000`:

```sh
bun run --cwd apps/example-cms dev
```

With the CMS running, build and serve the Public Blog:

```sh
bun run --cwd apps/public-blog build
bun run --cwd apps/public-blog start
```

`bun run acceptance` coordinates the contract, integration, filesystem, architecture, generated-artifact, application, and package evidence. Manual VoiceOver, IME, clipboard, cross-browser, and accessibility protocols remain recorded release-candidate gates. See [the acceptance strategy](docs/v0.1-acceptance-verification-strategy.md) and [release runbook](docs/releasing.md).
