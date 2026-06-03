# AGENTS.md — ripfetch

## Project

ripfetch is a game download aggregator. Bun monorepo with two workspaces:

- **`packages/server`** — Elysia backend (port 3111 dev, 3000 prod)
- **`packages/client`** — React + Vite + Tailwind frontend (port 5173 dev)

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
npx biome check .         # Check only (CI)
npx biome check --write . # Auto-fix lint + format
```

## Formatting & Linting

All enforced via **Biome** (`biome.json`):

- **Indent:** 4 spaces for `.ts`, 2 spaces for `.tsx`
- **Quotes:** Double quotes
- **Line width:** 80 characters
- **Linter:** Recommended rules + `noExplicitAny: off`, `noNonNullAssertion: off`
- **Organize imports:** Off (manual import ordering)

Run `npx biome check --write .` before committing.

## Naming Conventions

| What | Convention | Example |
|------|-----------|---------|
| React components & pages | PascalCase filename | `SearchPage.tsx`, `ThemeProvider.tsx` |
| Hooks | camelCase, `use` prefix | `useDebounce.ts`, `useClickOutside.ts` |
| Utilities / lib / config | camelCase | `utils.ts`, `config.ts` |
| Server source files | camelCase | `routes.ts`, `cache.ts` |
| Scraper classes | PascalCase filename, default export | `steamrip.ts` → `class SteamRip` |
| Types | `type` alias only (no `interface`) | `type Props = { ... }` |

## TypeScript

- Strict mode enabled in both workspaces
- `noUnusedLocals` and `noUnusedParameters` enabled
- Prefer `type` aliases over `interface`
- Use `as` assertions; avoid `!` where feasible (non-null assertion is allowed but discouraged)

## React / Frontend Conventions

- **Default export** for components, **named export** for utilities
- shadcn/ui pattern: components in `src/components/ui/` use Radix primitives + `class-variance-authority` + `cn()` for class merging
- **Path alias:** `@/` maps to `src/`
- **Theming:** CSS custom properties (`--primary`, `--background`, etc.) set by `ThemeProvider`; Tailwind `dark:` variant also works
- **Routing:** React Router v6, pages in `src/pages/`
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
