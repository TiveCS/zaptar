# Zaptar

**MySQL / MariaDB schema diff and migration script generator.**

Compare two database schemas, inspect exactly what changed, and get a ready-to-run SQL migration script — all in a desktop app with no server required.

---

## Features

### Connection Management
- Save multiple MySQL / MariaDB connections
- Passwords encrypted by the OS keychain (never stored in plain text)
- Test a connection live directly from the add / edit / duplicate form
- Duplicate a connection — useful when source and target share most settings
- Edit without re-entering the password — leave it blank to keep the existing one

### Schema Comparison
- Pick a **source** (newer schema) and a **target** (older schema)
- Swap source ↔ target with one click
- Filter down to specific tables before running
- Detects **added**, **modified**, **removed**, and **unchanged** tables

### Diff Viewer
- Per-table tabs: **Columns · Indexes · Foreign Keys · Check Constraints · Table Options**
- Modified rows show source value vs target value side-by-side with field-level change highlights
- Unchanged columns / indexes / FKs shown in muted style below changed items — full context, no noise
- Added / removed tables show their full structure (not just column names)
- Unchanged tables load schema on demand — no bloated payload on large databases
- Table tree sidebar with grouped search and change count badge

### Migration Script
- Auto-generated SQL from the diff result
- SQL syntax highlighting (VS Code Dark+ palette, no external dependency)
- Collapsible warnings panel for destructive statements
- Copy to clipboard or save as `.sql` file

### Compatibility
- **MySQL 5.7+**, **MySQL 8.x**, **MariaDB** — functional expression indexes handled with automatic server-version fallback

---

## Download

Pre-built Windows installer is on the [Releases](https://github.com/TiveCS/zaptar/releases) page.

> macOS and Linux builds are not distributed yet but can be built from source (see below).

---

## Contributing

### Prerequisites

| Tool | Minimum version |
|------|----------------|
| Node.js | 20 |
| pnpm | 9 |

### Setup

```bash
git clone https://github.com/TiveCS/zaptar.git
cd zaptar
pnpm install
```

### Run in development

```bash
pnpm dev
```

Starts the Electron app with hot reload for both the renderer (React / Vite) and the main process.

### Other useful commands

```bash
pnpm typecheck       # TypeScript check across main + renderer
pnpm lint            # ESLint
pnpm format          # Prettier
pnpm test            # Vitest unit tests
pnpm test:watch      # Vitest in watch mode
```

### Build installers

```bash
pnpm build:win       # Windows — NSIS installer (.exe)
pnpm build:mac       # macOS — DMG
pnpm build:linux     # Linux — AppImage / deb / snap
pnpm build:unpack    # Unpacked directory — no installer, faster for local testing
```

Output is written to `dist/`.

---

## Project Structure

```
src/
├── main/                   # Electron main process
│   ├── ipc.ts              # All IPC channel handlers
│   ├── secrets.ts          # Password encrypt / decrypt (OS keychain)
│   ├── store.ts            # lowdb JSON persistence
│   └── providers/
│       └── mysql/          # MySQL introspection + SQL emitter
├── preload/                # Context bridge (main ↔ renderer)
├── renderer/               # React frontend
│   ├── components/
│   │   ├── connections/    # Connection card, form, management UI
│   │   ├── diff/           # Diff panel, table tree sidebar
│   │   ├── script/         # Migration script preview
│   │   └── ui/             # shadcn/ui primitives
│   ├── routes/             # Page-level components
│   ├── store/              # Zustand global state
│   └── lib/                # API bridge, utilities
└── shared/
    ├── types/              # Shared TypeScript types + IPC channel map
    └── diff/               # Schema diff engine (pure — no Electron deps)
```

---

## Tech Stack

| Layer | Library |
|-------|---------|
| App shell | [Electron](https://www.electronjs.org/) + [electron-vite](https://electron-vite.org/) |
| UI | [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/) |
| Styling | [Tailwind CSS v4](https://tailwindcss.com/) + [shadcn/ui](https://ui.shadcn.com/) |
| State | [Zustand](https://zustand-demo.pmnd.rs/) |
| Forms | [React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/) |
| Database driver | [mysql2](https://github.com/sidorares/node-mysql2) |
| Storage | [lowdb](https://github.com/typicode/lowdb) (local JSON) |

---

## License

[MIT](LICENSE)
