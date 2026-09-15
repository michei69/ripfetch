# AGENTS.md — ripfetch

## Project

ripfetch is a game download aggregator. Bun monorepo with two workspaces:

- **`packages/server`** — Elysia backend (port 3111 dev, 3000 prod)
- **`packages/client`** — Solid 2.0 + Vite + Tailwind frontend (port 5173 dev)

## Commands

```bash
bun run dev          # Run both client + server concurrently
bun run dev:client   # Frontend only (Vite)
bun run dev:server   # Backend only (Elysia)
bun run build        # Production Vite build
bun run serve        # Production server (port 3000)
bun run start        # Full production: build + serve
```

**Lint / Format:**

```bash
bun run check       # Check only (CI): oxlint + oxfmt
bun run check:fix   # Auto-fix lint + format
```

## Formatting & Linting

All enforced via **oxc** (`.oxlintrc.json`, `.oxfmtrc.json`):

- **Indent:** 4 spaces for `.ts`, 2 spaces for `.tsx`, `.json`, `.html`, `.css`
- **Quotes:** Double quotes
- **Line width:** 80 characters
- **Linter:** `correctness` category as errors, plus the typescript, unicorn, oxc, jsx-a11y, import and promise plugins; `no-console`, `no-explicit-any` and `no-non-null-assertion` are off. React plugin rules are intentionally absent — `class` is not `className` in Solid.
- **Import sorting:** Off (manual import ordering)

Run `bun run check:fix` before committing.

## Naming Conventions

| What                     | Convention                          | Example                             |
| ------------------------ | ----------------------------------- | ----------------------------------- |
| Components & pages       | PascalCase filename                 | `SearchPage.tsx`, `ThemeSwitch.tsx` |
| Hooks                    | camelCase, `use` prefix             | `useRecents.ts`, `useDismiss.ts`    |
| Utilities / lib / config | camelCase                           | `utils.ts`, `config.ts`             |
| Server source files      | camelCase                           | `routes.ts`, `cache.ts`             |
| Scraper classes          | PascalCase filename, default export | `steamrip.ts` → `class SteamRip`    |
| Types                    | `type` alias only (no `interface`)  | `type Props = { ... }`              |

## TypeScript

- Strict mode enabled in both workspaces
- `noUnusedLocals` and `noUnusedParameters` enabled
- Prefer `type` aliases over `interface`
- Use `as` assertions; avoid `!` where feasible (non-null assertion is allowed but discouraged)

## Solid / Frontend Conventions

- **Default export** for pages, **named export** for components and utilities
- `src/components/ui/` holds the shared primitives, styled with `cn()` for class merging
- **Path alias:** `@/` maps to `src/`
- **Theming:** CSS custom properties (`--primary`, `--background`, etc.) applied as `data-theme` on `<html>` by `lib/theme.tsx` (seeded pre-paint by `public/theme-init.js`); Tailwind `dark:` variant also works
- **Routing:** `@solidjs/router` v2 — routes are config objects in `src/router.tsx`, pages in `src/pages/`, links are plain `<a href>` (the router intercepts same-origin clicks)
- **Reactivity:** props are read through `props.x` (never destructured), state is signals/stores, side effects live in `createEffect(compute, apply)` or `onSettled`
- **Accessibility:** Target WCAG 2.1 AA — ensure keyboard navigation, focus management, aria labels, and semantic HTML

## Backend / Server Conventions

- Elysia routes defined in `routes.ts`, exported as `searchRoute` and `app`
- All routes prefixed with `/api` via `new Elysia({ prefix: "/api" })`
- **Cache:** libSQL-backed key-value store via `cache.ts`; TTLs: 12h for search/links, 7 days for game info
- **Scrapers:** Each game source is a class implementing the implicit `IGameSource` contract:
    - `displayName: string`
    - `search(title)` → `Promise<SearchResult[]>`
    - `getClosestTo(query)` → `Promise<SearchResult | null>`
    - `getDownloads(url)` → `Promise<DownloadsResult>`
    - Use static + instance method mix (statics for direct call, instance delegates to static)
- **SSRF protection:** `NetworkRequest` validates URLs against an allowlist and checks DNS/IP before fetching
- **Error handling:** Log errors with `console.error` then return null/empty; do not throw
- `console.log` is allowed in committed code
