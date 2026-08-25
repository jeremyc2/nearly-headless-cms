## Goal

Nearly Headless CMS is an allusion to Nearly Headless Nick from Harry Potter.

This package facilitates the creation of Headless CMSs where the builder of the Headless CMS itself
can bring their own UI and provide their own storage backend, authentication/authorization and user management, API/Transport layer, asset management, and runtime environment via Effect layers.

- Don't use abreviations for variable or function names. Use descriptive names instead.
- Run `bun lint` after every change. Fix all linting errors and warnings.

## Linting

DO NOT use `eslint` or `prettier`. Exclusively use our `package.json` scripts for linting and formatting, or the oxlint CLI.
We have setup very strict linting rules. Never use file-wide `// oxlint-disable` or `/* oxlint-disable */`; use `// oxlint-disable-next-line` only as an escape hatch on the specific line (avoid when possible) and document the reason for doing so inline with the code every time. Don't loosen type-checking or linting rules in our config files without explicit permission.

Every escape hatch must include a stable code and justification, for example `// oxlint-disable-next-line <rule> -- [EH-042] <justification>`. Track all escape hatches in [`ESCAPE_HATCHES.md`](./ESCAPE_HATCHES.md) and regenerate that file with `bun run scripts/escape-hatches.ts sync` when adding or changing one.

## This is a Bun TS project

Default to using Bun instead of Node.js.

For more information, read the Bun API docs in `node_modules/bun-types/docs/**.mdx`.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun install` instead of `npm install` or `yarn install` or `pnpm install`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun run <script>` instead of `npm run <script>` or `yarn run <script>` or `pnpm run <script>`
- Use `bunx <package> <command>` instead of `npx <package> <command>`
- Bun automatically loads .env, so don't use dotenv.

### APIs

- Prefer `Bun.file` over `node:fs`'s readFile/writeFile
- Bun.$`ls` instead of execa.

### Testing

Use `bun test` to run tests.

```ts#index.test.ts
import { test, expect } from "bun:test";

test("hello world", () => {
  expect(1).toBe(1);
});
```

## Effect V4 RC

Never access `_tag` directly. Effect v4 has utilities in many of it's modules for working with `_tag`. If needed, we can also add static properties to Effect error classes for carrying additional metadata.

We are using the Effect v4 Release Candidate (RC). This is a major version bump from Effect v3.

Prefer the bundled documentation over your current knowledge: `node_modules/effect/ai-docs/**.(ts|md)`.

Effect is written in Effect, so we should also refer to the Effect source code for the most up-to-date examples and best practices, which they have graciously included in their node_modules: `node_modules/effect/src/**`.

## Agent skills

### Issue tracker

Issues and specs are tracked in this repository’s GitHub Issues using the `gh` CLI. See `docs/agents/issue-tracker.md`.

### Triage labels

Triage uses the default five-label vocabulary. See `docs/agents/triage-labels.md`.

### Domain docs

Domain documentation uses the single-context layout. See `docs/agents/domain.md`.
