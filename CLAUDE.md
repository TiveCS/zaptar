# CLAUDE.md — Agent onboarding for the zaptar codebase

This file is for AI coding agents (Claude Code, Cursor, etc.) and humans
picking up the codebase cold. Read this **first**, then dive into
[`PROPOSAL.md`](./PROPOSAL.md) for the full spec.

---

## What is zaptar?

A cross-platform Electron desktop app for **MySQL / MariaDB**. Three tools
share one window:

1. **Schema comparison** — diff two databases, generate a single ordered SQL
   migration script.
2. **Data comparison** — row-level diff per table; generates separate
   INSERT / UPDATE / DELETE data-sync SQL.
3. **ERD viewer** — interactive entity-relationship diagram for a single
   connection.

---

## Tech stack quick reference

| Layer            | Stack                                                                  |
| ---------------- | ---------------------------------------------------------------------- |
| Shell            | Electron + electron-vite                                               |
| UI               | React 19 + TypeScript (strict)                                         |
| Styling          | Tailwind v4 (CSS-first via `@theme` block) + shadcn/ui                 |
| State            | Zustand (single store, `src/renderer/src/store/index.ts`)              |
| Forms            | React Hook Form + Zod                                                  |
| DB driver        | `mysql2/promise`                                                       |
| Local persistence| `lowdb` (JSON at `app.getPath('userData')/connections.json`)           |
| Password storage | Electron `safeStorage` (DPAPI / Keychain / libsecret)                  |
| Table tree       | `@tanstack/react-virtual`                                              |
| ERD canvas       | `@xyflow/react` v12 + `@dagrejs/dagre`                                 |
| Image export     | `html-to-image`                                                        |
| Packaging        | electron-builder (NSIS / DMG / AppImage / deb)                         |
| Package manager  | pnpm (use `pnpm` not `npm` for installs)                               |

**No CodeMirror, no Monaco** — SQL highlighter is a hand-rolled tokenizer
in `src/renderer/src/lib/sql-highlight.tsx`. If you need to highlight SQL,
use `<SqlCode code={...} />`.

---

## Process model

```
Renderer (React, sandboxed)  ──contextBridge──▶  Preload  ──ipcInvoke──▶  Main (Node)
```

- **Renderer** has `nodeIntegration: false`, `contextIsolation: true`. It
  **cannot** `require()` Node modules. Its only bridge to the host is
  `window.zaptar`, typed as `ZaptarApi` in `src/renderer/src/lib/api.ts`.
- **Preload** (`src/preload/index.ts`) calls `contextBridge.exposeInMainWorld`
  with thin wrappers that just `ipcRenderer.invoke(...)`.
- **Main** owns: DB connections, secrets, file I/O, the diff engine, SQL
  emission, schema introspection, data fetching.

---

## Layering rules (enforced by directory boundaries)

- `src/shared/` is **pure TypeScript**. No Node imports (`fs`, `path`, `mysql2`,
  `electron`). It can be imported by both main and renderer.
- `src/main/` may use anything Node. It **must not** import from
  `src/renderer/`.
- `src/renderer/` **must not** import from `src/main/` or `src/preload/`.
  The only main-process surface is `window.zaptar` (typed via `api.ts`).

If you're tempted to break this: don't. Find another way.

---

## Adding a new feature — common workflows

### Add a new IPC channel

1. Add the request / response types in `src/shared/types/ipc.ts` under
   `IpcChannelMap`.
2. Implement the handler in `src/main/ipc.ts` using `handle('channel:name', ...)`.
3. Expose it in the preload bridge in `src/preload/index.ts`.
4. Add the matching method to the `ZaptarApi` type in
   `src/renderer/src/lib/api.ts`.
5. Call it from React via `api.section.method(...)`.

### Add a new route / page

1. Create the route component in `src/renderer/src/routes/MyPage.tsx`.
2. Register it in `src/renderer/src/App.tsx` `<Routes>`.
3. Add a nav entry in `src/renderer/src/components/Layout.tsx` `navItems`.

### Add a new shadcn primitive

`src/renderer/src/components/ui/` contains the copied shadcn components.
Add new ones using the standard shadcn copy-into-repo pattern.

---

## Conventions you should follow

### TypeScript

- **Strict mode is on.** No `any` (use `unknown` and narrow). Avoid `as`
  casts unless you've verified the runtime shape.
- React function components return `React.JSX.Element`, not `JSX.Element`
  (we use the new namespace).
- Prefer `type` aliases over `interface` (consistency in the existing code).

### React

- Function components only. No class components.
- Use Zustand for cross-page state, local `useState` for everything else.
  Don't reach for a new state library.
- For async work that may race (in-flight IPC, click-then-click), use a
  `requestIdRef` pattern — see `DataTablePanel.handleLoad` for a reference
  implementation.
- Use `useShortcut` hook from `src/renderer/src/hooks/useShortcut.ts` for
  keyboard bindings. Don't add raw `window.addEventListener('keydown', ...)`.

### Styling

- All colors come from CSS variables defined in
  `src/renderer/src/assets/main.css` via `@theme`. Use `var(--color-*)` in
  Tailwind classes via the `bg-[var(--color-card)]` pattern (Tailwind v4
  arbitrary value syntax).
- **No hard-coded hex colors** in components. The only exception is the
  ERD edge color palette (`EDGE_COLORS` in `ErdCanvas.tsx`) — those are
  intentional for cross-edge distinguishability.
- Dark theme is the only theme. Don't add light-mode variants unless the
  user asks.

### SQL

- Identifiers (table / column names) are interpolated with backticks:
  `` `${name}` ``. **Always** validate via `assertSafeIdentifier` (in
  `src/main/providers/mysql/data.ts`) before interpolating — mysql2
  cannot parameterize identifiers.
- Values use `?` placeholders with `client.execute(sql, [...params])`.

### Commits

- Conventional commit prefixes: `feat:`, `fix:`, `refactor:`, `docs:`,
  `style:`, `chore:`, `ci:`.
- Multi-paragraph body explaining **why** the change was made, not just
  what. Reference the related code path or the user-facing symptom.
- Co-author trailer: `Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>`

---

## Things to NOT do

- ❌ Don't add CodeMirror or Monaco. Use the existing `SqlCode` component.
- ❌ Don't add a routing library other than `react-router-dom`.
- ❌ Don't introduce native modules (anything that needs `node-gyp` /
  `electron-builder install-app-deps` to compile). The current build has
  zero native deps; keep it that way unless absolutely necessary.
- ❌ Don't write light-mode styles unless asked.
- ❌ Don't auto-bump `package.json` version or move git tags. Version
  bumps and tag pushes happen only when the user explicitly says
  "release".
- ❌ Don't add light-mode variants to React Flow / shadcn components.
- ❌ Don't write to disk from the renderer. Always go through an IPC
  channel that calls `dialog.showSaveDialog` + `fs.writeFileSync` in main.
- ❌ Don't store passwords in lowdb plain-text. Always
  `safeStorage.encryptString(...)` first.

---

## How to run / verify your changes

```bash
pnpm install        # one-time
pnpm dev            # Vite + Electron with HMR
pnpm typecheck      # full typecheck (main + renderer + shared)
pnpm lint           # ESLint
pnpm build          # production bundle, no installer
pnpm build:unpack   # unpacked Electron build for fast smoke tests
```

**Always** run `pnpm typecheck` before committing if you've touched any
TypeScript file. The CI release workflow runs typecheck as the first step
of `pnpm build`, so a typecheck failure means a broken release.

---

## Where things live (quick lookup)

| Looking for…                                | Path                                                                |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Routes                                      | `src/renderer/src/routes/`                                          |
| IPC handler registry                        | `src/main/ipc.ts`                                                   |
| IPC channel type map (single source)        | `src/shared/types/ipc.ts`                                           |
| Preload bridge                              | `src/preload/index.ts`                                              |
| Renderer IPC type                           | `src/renderer/src/lib/api.ts`                                       |
| Schema diff engine (pure)                   | `src/shared/diff/engine.ts`                                         |
| MySQL introspection                         | `src/main/providers/mysql/introspect.ts`                            |
| Migration script emitter                    | `src/main/providers/mysql/emit-sql.ts`                              |
| Data comparison (row fetch + diff)          | `src/main/providers/mysql/data.ts`                                  |
| Connection encryption                       | `src/main/secrets.ts`                                               |
| lowdb wrapper                               | `src/main/store.ts`                                                 |
| Auto-update wiring                          | `src/main/updater.ts`                                               |
| Global state                                | `src/renderer/src/store/index.ts`                                   |
| Keyboard shortcut hook                      | `src/renderer/src/hooks/useShortcut.ts`                             |
| SQL highlighter (`SqlCode`)                 | `src/renderer/src/lib/sql-highlight.tsx`                            |
| ERD canvas + dagre layout + export          | `src/renderer/src/components/erd/ErdCanvas.tsx`                     |
| ERD custom node                             | `src/renderer/src/components/erd/TableNode.tsx`                     |
| Data comparison panel + SQL modal           | `src/renderer/src/components/data/DataTablePanel.tsx`               |
| Schema diff panel                           | `src/renderer/src/components/diff/DiffPanel.tsx`                    |
| Virtualized table tree (Result page)        | `src/renderer/src/components/diff/TableTree.tsx`                    |
| Migration script preview                    | `src/renderer/src/components/script/ScriptPreview.tsx`              |
| Global CSS (theme + scrollbars + RF dark)   | `src/renderer/src/assets/main.css`                                  |
| Release workflow                            | `.github/workflows/release.yml`                                     |
| electron-builder config                     | `electron-builder.yml`                                              |

---

## Related docs

- [`PROPOSAL.md`](./PROPOSAL.md) — full project specification (architecture,
  data models, IPC contracts, per-feature deep dives, release history).
- [`README.md`](./README.md) — user-facing feature list and contributor
  setup.
- [`CHANGELOG.md`](./CHANGELOG.md) — release-by-release change log.
