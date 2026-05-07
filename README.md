# Zaptar

**MySQL / MariaDB schema diff, data comparison, and ERD viewer — in one desktop app.**

Compare two database schemas, sync row-level data between environments, and visualize a database as an interactive ERD — all without leaving the same window. No server, no CLI to memorize.

---

## Features

### Schema Comparison
- Pick a **source** (newer schema) and a **target** (older schema)
- Swap source ↔ target with one click
- Filter down to specific tables before running
- Detects **added**, **modified**, **removed**, and **unchanged** tables
- Per-table tabs: **Columns · Indexes · Foreign Keys · Check Constraints · Table Options**
- Modified rows show source value vs target value side-by-side with field-level highlights
- Unchanged columns / indexes / FKs shown in muted style — full context, no noise
- Added / removed tables show their full structure (not just column names)
- Unchanged tables load schema on demand — no bloated payload on large databases
- Virtualized table tree sidebar handles 500+ tables without jank

### Migration Script
- Auto-generated, ordered SQL — FK drops before referenced tables, new tables before their FKs, etc.
- Custom SQL syntax highlighting (VS Code Dark+ palette, no external dependency, handles SQL-standard `''` escapes)
- Collapsible warnings panel for destructive statements
- Copy to clipboard or save as `.sql` file

### Data Comparison *(v1.1.0+)*
- New **Data** tab on the Result page — compare actual row data between two databases for any selected table
- On-demand per table (lazy load) so large databases don't get bulk-fetched
- Pick the match key columns yourself; primary key auto-suggested
- Configurable row limit (default 10 000) with cap-detection banner
- Row diff: **added** / **removed** / **modified** with per-cell before → after on changed values
- Toggle row types via filter chips — the same filter drives the generated SQL
- Generated **INSERT / UPDATE / DELETE** data-sync SQL, deliberately separate from the schema migration
- "Skip key columns in INSERT" option — handy when target's PK already conflicts with source IDs
- Full-screen modal preview with copy + save (Esc to close)

### ERD Viewer *(v1.2.0+)*
- New **ERD** page — visualize a database as an interactive entity-relationship diagram
- Tables render as nodes with full column lists; primary keys + foreign keys flagged
- Foreign keys render as edges with **crow's-foot cardinality markers** (`1:1` or `N:1`)
- Auto-layout via dagre — referenced tables on the left, referencing on the right
- Zoom, pan, minimap, on-canvas controls
- **Lazy table selection** — start empty; pick the subset you care about (avoids freeze on 500-table schemas)
- **"+ neighbors"** button adds a table together with every FK-connected one
- **Jump to table** — click a name in the sidebar to pan + zoom directly to it
- Hover an edge to highlight + reveal the `ON DELETE` action; everything else fades
- Each FK gets a stable color so overlapping lines are easier to follow
- **Export** the current ERD as **PNG** or **SVG** with one click

### Connection Management
- Save multiple MySQL / MariaDB connections
- Passwords encrypted by the OS keychain (never stored in plain text)
- Test a connection live directly from the add / edit / duplicate form
- Duplicate a connection — useful when source and target share most settings
- Edit without re-entering the password — leave it blank to keep the existing one

### Other Niceties
- **Auto-update** via `electron-updater` — checks on launch, downloads in background, "Restart to update" banner
- **VS Code-style keyboard shortcuts** — `Ctrl+P` to filter tables, `Ctrl+↓/↑` between tables, `Ctrl+\`` to toggle Diff ↔ Script, `Ctrl+Shift+S` save script, `Ctrl+Enter` to run compare, `Ctrl+Shift+X` swap source ↔ target
- **Themed dark scrollbars** that don't break the visual flow
- **MySQL 5.7+, MySQL 8.x, MariaDB** — functional expression indexes handled with automatic server-version fallback

---

## Download

Pre-built installers for Windows, macOS, and Linux are on the [Releases](https://github.com/TiveCS/zaptar/releases) page.

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

### Releasing

1. Bump `package.json` version
2. Update `CHANGELOG.md`
3. Commit, tag (`git tag v1.2.3`), push (`git push origin main --tags`)
4. The GitHub Actions workflow builds installers on Windows + macOS + Linux in parallel and uploads them to a draft GitHub release
5. Promote draft → published in the GitHub UI

---

## Project Structure

```
src/
├── main/                       # Electron main process
│   ├── ipc.ts                  # All IPC channel handlers
│   ├── secrets.ts              # Password encrypt / decrypt (OS keychain)
│   ├── store.ts                # lowdb JSON persistence
│   └── providers/mysql/
│       ├── introspect.ts       # information_schema → Schema
│       ├── emit-sql.ts         # SchemaDiff → MigrationScript
│       └── data.ts             # Row fetch + DataTableDiff
├── preload/                    # Context bridge (main ↔ renderer)
├── renderer/src/               # React frontend
│   ├── routes/                 # Page-level components (Connections, Compare, Result, ERD)
│   ├── components/
│   │   ├── connections/        # Connection card, form, management UI
│   │   ├── diff/               # Diff panel, table tree sidebar (virtualized)
│   │   ├── script/             # Migration script preview
│   │   ├── data/               # Data comparison view + panel + SQL modal
│   │   ├── erd/                # ERD canvas + custom TableNode
│   │   └── ui/                 # shadcn/ui primitives
│   ├── lib/                    # API bridge, SQL highlighter, utils
│   └── store/                  # Zustand global state
└── shared/
    ├── types/                  # Shared TypeScript types + IPC channel map
    └── diff/                   # Schema diff engine (pure — no Electron deps)
```

For a deep dive into architecture, IPC contracts, data models, and design decisions, see [PROPOSAL.md](./PROPOSAL.md).

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
| Table tree virtualization | [@tanstack/react-virtual](https://tanstack.com/virtual) |
| ERD canvas | [@xyflow/react](https://reactflow.dev/) + [@dagrejs/dagre](https://github.com/dagrejs/dagre) |
| Image export | [html-to-image](https://github.com/bubkoo/html-to-image) |

---

## License

[MIT](LICENSE)
