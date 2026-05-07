# zaptar — Schema Diff Desktop App

**Status:** Living spec — reflects current shipped state of `main`
**Latest released version:** v1.2.0 (in publish pipeline at time of last edit)
**In-progress version:** v1.2.1 (themed scrollbars, ERD export — already on `main`)
**Last updated:** 2026-05-07

This document is the canonical project specification. It evolves with the
codebase: every section describes the **shipped** behavior, not aspirations.
Future-work items live in their own clearly labelled section at the bottom.

---

## 1. Executive summary

`zaptar` is a cross-platform desktop application for working with **MySQL / MariaDB** databases. It is built around three independent tools, each available from the main nav:

1. **Schema comparison** — pick a source (newer) and target (older) database; see a per-table side-by-side diff with field-level highlights; export a single ordered SQL migration script that brings the target up to source.
2. **Data comparison** — for any selected table on the Result page, fetch rows from both sides and produce a row-level diff (added / modified / removed) plus a separate INSERT / UPDATE / DELETE data-sync SQL script. Built for config/settings tables that live in the database alongside schema.
3. **ERD viewer** — visualize a single database as an interactive entity-relationship diagram. Tables render as nodes with full column lists; foreign keys render as edges with crow's-foot cardinality markers. Lazy table selection, jump-to-table, and PNG / SVG export are first-class.

The primary user is a backend developer or DBA who:

- Maintains parallel database environments (dev / staging / prod)
- Wants to keep prod schema and config tables reflective of dev after development cycles
- Needs to explain the schema shape to a non-DB audience without dragging out a heavyweight GUI

The architecture uses a `SchemaProvider` interface so PostgreSQL, SQLite, etc. can be added later without touching the diff engine or UI. Today `mysql` is the only implementation.

---

## 2. Goals and non-goals

### 2.1 Shipped (achieved)

1. **Schema comparison** with per-table side-by-side diff, git-diff conventions (red=removed, green=added, yellow=modified). Detects tables, columns, indexes, foreign keys, check constraints, and table options (engine, charset, collation, comment, `AUTO_INCREMENT`, `ROW_FORMAT`).
2. **Per-table sub-tabs** — Columns / Indexes / Foreign Keys / Check Constraints / Table Options — keyboard-shortcut switchable.
3. **Migration script** — one consolidated, safe-by-construction SQL script. Statement ordering respects dependencies (FKs dropped before referenced tables, new tables created before their FKs are added). Destructive statements flagged in both UI and script. Saved / copied via OS dialogs.
4. **Custom SQL highlighter** (VS Code Dark+ palette, no external dependency) with the SQL-standard `''` escape supported.
5. **Data comparison (v1.1.0)** — on-demand row-level diff per table from the Result page Data tab. User picks match key columns (primary key auto-suggested) and a row limit. Generates separate INSERT / UPDATE / DELETE data-sync SQL with `Skip key columns in INSERT` for PK-conflict scenarios. Filter chips toggle row types (added / removed / modified) and the same filter drives the generated SQL.
6. **ERD viewer (v1.2.0)** — full database visualization for any saved connection. Crow's-foot cardinality markers, smoothstep edge routing, per-relation colors, hover highlight, lazy table selection, jump-to-table from sidebar, dynamic per-node width, NULL / DEFAULT badges per column, PNG / SVG export.
7. **Connection management** — multiple saved connections, OS-keychain-encrypted passwords, test from form, duplicate, edit-without-rewrite-password.
8. **Compare workflow extras** — source ↔ target swap, table-list filter, change-count badges, virtualized 500+ table sidebar.
9. **Auto-update** via `electron-updater` (notifies on launch, downloads in background, restart-to-update banner).
10. **Cross-platform** — Windows NSIS, macOS DMG, Linux AppImage / deb (snap available locally).

### 2.2 Non-goals (still out of scope)

- Executing the migration or data-sync script from inside the app
- Comparing **stored procedures, functions, triggers, views, events, partitions**
- Schema history / snapshots / time-travel diff
- PostgreSQL, SQLite, SQL Server, Oracle providers (the `SchemaProvider` interface is ready; no implementation yet)
- Multi-tab / multi-workspace UI
- Schema versioning integration with migration tools (Flyway, Liquibase, Alembic, etc.)
- Realtime collaborative editing of the migration script

These are kept out deliberately. The architecture leaves room for them.

---

## 3. Tech stack (locked-in)

| Concern                                        | Choice                                                     | Why                                                                                                                       |
| ---------------------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Desktop shell                                  | **Electron** (latest stable, ≥ v34)                        | Need Node.js to run `mysql2` TCP connections; browsers can't reach DB sockets. Mature packaging and OS integration.       |
| Build / dev                                    | **electron-vite**                                          | Vite preset for Electron with three configured roll-up targets (main / preload / renderer), HMR for renderer, type-aware. |
| UI framework                                   | **React 19 + TypeScript (strict)**                         | Confirmed by user. Best fit for shadcn/ui.                                                                                |
| Styling                                        | **Tailwind CSS v4**                                        | Latest, CSS-first config (`@theme` block), no JS config file required. Ships with Vite plugin.                            |
| UI components                                  | **shadcn/ui** (Radix-based, copied into the repo)          | Theme-friendly, no runtime dependency on a component library.                                                             |
| Icons                                          | **lucide-react**                                           | Confirmed by user.                                                                                                        |
| State                                          | **Zustand**                                                | Single store, slices per concern (connections, comparison, ui). No middleware/boilerplate.                                |
| Routing                                        | **react-router-dom v7** (memory router)                    | Three top-level routes; memory router because there's no URL bar.                                                         |
| DB driver                                      | **mysql2/promise**                                         | Battle-tested, supports MariaDB, prepared statements, streaming.                                                          |
| Secret storage                                 | **keytar**                                                 | Wraps OS keychain (Windows Credential Manager / macOS Keychain / libsecret).                                              |
| Local DB (for app state, e.g. connection list) | **lowdb** (JSON file in `app.getPath('userData')`)         | Lightweight; no migration headaches for a tiny app config.                                                                |
| SQL editor                                     | **CodeMirror 6** (`@codemirror/lang-sql`)                  | Lighter than Monaco, fits the lightweight goal, plenty good for read-only display + copy.                                 |
| Schema diff engine                             | Custom pure-TS module                                      | No existing library matches the UX and provider abstraction we need.                                                      |
| Packaging                                      | **electron-builder**                                       | NSIS for Windows, dmg/zip for macOS, AppImage/deb for Linux.                                                              |
| Unit testing                                   | **Vitest**                                                 | Fast, Vite-native, identical config story.                                                                                |
| E2E testing                                    | **Playwright** with `electron` driver                      | Smoke-test only in MVP.                                                                                                   |
| Linting / formatting                           | **ESLint** (typescript-eslint, react-hooks) + **Prettier** | Standard.                                                                                                                 |
| Package manager                                | **pnpm**                                                   | Faster, smaller `node_modules`.                                                                                           |

### 3.1 Decisions confirmed by user

- React (over Vue / Solid)
- App name: `zaptar`
- v0.1 = copy/save only, no in-app execution
- Rename detection skipped for v0.1 (always emit `DROP` + `ADD`)

---

## 4. Architecture

### 4.1 Process model

Electron splits the app into three contexts:

```
┌──────────────────┐    contextBridge    ┌──────────────────┐    IPC    ┌──────────────────┐
│  Renderer        │ ──── window.zaptar ─▶│  Preload         │ ──invoke──▶│  Main            │
│  (React, browser)│ ◀──── responses ─────│  (sandboxed)     │ ◀─return──│  (Node.js)       │
│                  │                      │                  │            │                  │
│  - UI            │                      │  Thin typed API  │            │  - mysql2        │
│  - state         │                      │  surface only    │            │  - keytar        │
│  - format/render │                      │                  │            │  - introspect    │
│                  │                      │                  │            │  - diff engine   │
│                  │                      │                  │            │  - sql emitter   │
│                  │                      │                  │            │  - file I/O      │
└──────────────────┘                      └──────────────────┘            └──────────────────┘
```

- **Renderer** is **sandboxed** with `contextIsolation: true` and `nodeIntegration: false`. It cannot `require()` Node modules or touch the filesystem directly.
- **Preload** uses `contextBridge.exposeInMainWorld('zaptar', api)` to expose a **typed**, narrow API surface (only the methods we actually need).
- **Main** owns: DB connections, secrets, file I/O, the diff engine, the SQL emitter.

This split is non-negotiable for security. Even though zaptar isn't loading remote content, treating renderer as untrusted is the right default.

### 4.2 Data flow for a comparison

```
   User clicks "Compare"
            │
            ▼
   Renderer dispatches      window.zaptar.compare({src, tgt, tables})
            │
            ▼  IPC: 'compare:run'
   Main: load creds from keytar
            │
            ▼
   Main: open two mysql2 connections (parallel)
            │
            ▼
   MySQLProvider.introspect(srcConn) ┐  parallel
   MySQLProvider.introspect(tgtConn) ┘
            │
            ▼
   Both return: Schema (normalized in-memory model)
            │
            ▼
   shared/diff/engine.ts  →  diff(source, target): SchemaDiff
            │
            ▼
   MySQLProvider.emitSql(diff): MigrationScript
            │
            ▼
   Return { diff, script } over IPC
            │
            ▼
   Renderer stores in zustand → UI re-renders
```

The introspection and diff happen in **main**, not renderer, because (a) the DB driver lives there and (b) the renderer should stay UI-focused.

### 4.3 Layering rules

- `shared/` is **pure TypeScript** with **no Node-specific imports** (no `fs`, `path`, `mysql2`). It can be imported by both main and renderer.
- `electron/main/` may use anything Node, but should not import from `src/`.
- `src/` (renderer) may not import from `electron/`. The only bridge is `window.zaptar`.

A small ESLint rule (`import/no-restricted-paths` or `no-restricted-imports`) will enforce this.

---

## 5. Project structure (current layout on `main`)

```
zaptar/
├── package.json
├── pnpm-lock.yaml
├── electron.vite.config.ts          # 3 build targets: main, preload, renderer
├── tsconfig.json / .node.json / .web.json
├── electron-builder.yml             # packaging config
├── components.json                  # shadcn config
├── README.md
├── CHANGELOG.md
├── PROPOSAL.md                      # this file
├── .github/workflows/release.yml    # CI: builds installers on `v*` tags
│
├── src/main/                        # Electron main process
│   ├── index.ts                     # app lifecycle, BrowserWindow, auto-update wiring
│   ├── ipc.ts                       # all IPC channel handlers
│   ├── secrets.ts                   # password encrypt/decrypt via OS keychain
│   ├── store.ts                     # lowdb wrapper for connection list
│   └── providers/mysql/
│       ├── connection.ts            # mysql2 connect + ping for test
│       ├── introspect.ts            # information_schema queries → Schema
│       ├── emit-sql.ts              # SchemaDiff → MigrationScript
│       └── data.ts                  # row-level fetch + diffTableData (data comparison)
│
├── src/preload/
│   └── index.ts                     # contextBridge.exposeInMainWorld('zaptar', api)
│
├── src/shared/                      # Pure TS, importable from main + renderer
│   ├── types/
│   │   ├── connection.ts
│   │   ├── schema.ts                # Schema, Table, Column, Index, ForeignKey, ...
│   │   ├── diff.ts                  # SchemaDiff, TableDiff, Change, FieldDiff
│   │   ├── script.ts                # MigrationScript, Statement
│   │   ├── data.ts                  # DataRow, DataTableDiff
│   │   ├── ipc.ts                   # IpcChannelMap (single source of truth)
│   │   └── index.ts
│   └── diff/
│       └── engine.ts                # diff(source, target): SchemaDiff (pure)
│
├── src/renderer/src/                # React frontend
│   ├── main.tsx                     # mount
│   ├── App.tsx                      # routes
│   ├── store/                       # Zustand global state
│   ├── hooks/
│   │   └── useShortcut.ts           # keyboard shortcut binding
│   ├── routes/
│   │   ├── ConnectionsPage.tsx
│   │   ├── ComparePage.tsx
│   │   ├── ResultPage.tsx           # Schema / Data tab switcher
│   │   └── ErdPage.tsx              # ERD viewer
│   ├── components/
│   │   ├── Layout.tsx               # header + nav + auto-update banner
│   │   ├── ui/                      # shadcn/ui primitives
│   │   ├── connections/
│   │   ├── diff/
│   │   │   ├── TableTree.tsx        # virtualized table tree (@tanstack/react-virtual)
│   │   │   ├── DiffPanel.tsx        # per-table diff with section tabs
│   │   │   └── ...
│   │   ├── script/
│   │   │   └── ScriptPreview.tsx    # migration script preview + copy/save
│   │   ├── data/
│   │   │   ├── DataDiffView.tsx     # left list + right panel (data tab)
│   │   │   └── DataTablePanel.tsx   # row diff + data sync SQL preview/modal
│   │   └── erd/
│   │       ├── ErdCanvas.tsx        # React Flow + dagre layout + export
│   │       └── TableNode.tsx        # custom node — header + columns
│   ├── lib/
│   │   ├── api.ts                   # typed window.zaptar wrapper (ZaptarApi type)
│   │   ├── sql-highlight.tsx        # SQL tokenizer + SqlCode component
│   │   └── utils.ts
│   └── assets/
│       └── main.css                 # Tailwind, dark scrollbars, React Flow theme
│
└── tests/                           # (kept lightweight — Vitest unit, manual E2E)
    └── ...
```

---

## 6. Data models (complete)

All types live in `shared/types/`. They are imported by both main and renderer.

### 6.1 Connection

```ts
// shared/types/connection.ts

export type DialectId = 'mysql' | 'mariadb' // v0.1

export type Connection = {
  id: string // UUID
  label: string // user-given, e.g. "prod-eu-west"
  dialect: DialectId
  host: string
  port: number // default 3306
  username: string
  database: string // single schema for v0.1
  ssl?: { rejectUnauthorized: boolean }
  // password is NOT stored here; lookup keytar by `connection:{id}`
  createdAt: string // ISO
  updatedAt: string
}

export type ConnectionDraft = Omit<Connection, 'id' | 'createdAt' | 'updatedAt'> & {
  password: string // only present in-flight, never persisted on disk
}
```

### 6.2 Schema model

```ts
// shared/types/schema.ts

export type Schema = {
  dialect: DialectId
  databaseName: string
  tables: Table[] // sorted by name for determinism
}

export type Table = {
  name: string
  engine: string // e.g. "InnoDB"
  charset: string
  collation: string
  comment: string
  columns: Column[] // ordered by ordinal
  indexes: Index[] // including PRIMARY
  foreignKeys: ForeignKey[]
  checkConstraints: CheckConstraint[]
  options: Record<string, string> // ROW_FORMAT, AUTO_INCREMENT, etc.
}

export type Column = {
  name: string
  ordinal: number // 1-based
  dataType: string // raw, e.g. "varchar(64)", "decimal(10,2)", "enum('a','b')"
  nullable: boolean
  default: string | null // raw expression as MySQL stores it; null = no default
  extra: string // "auto_increment", "on update CURRENT_TIMESTAMP", "VIRTUAL GENERATED", ...
  charset: string | null // null = inherit from table
  collation: string | null
  comment: string
  generationExpression: string | null // for GENERATED columns
}

export type Index = {
  name: string // "PRIMARY" for the primary key
  kind: 'primary' | 'unique' | 'index' | 'fulltext' | 'spatial'
  columns: IndexColumn[] // ordered by SEQ_IN_INDEX
  comment: string
  using: 'BTREE' | 'HASH' | null // null = engine default
}

export type IndexColumn = {
  columnName: string
  subPart: number | null // prefix length for varchar indexes
  expression: string | null // for functional indexes (MySQL 8.0+)
}

export type ForeignKey = {
  name: string // CONSTRAINT name
  columns: string[] // ordered
  referencedTable: string
  referencedColumns: string[]
  onUpdate: FkAction
  onDelete: FkAction
}

export type FkAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION'

export type CheckConstraint = {
  name: string
  expression: string
  enforced: boolean // MySQL only
}
```

### 6.3 Diff model

```ts
// shared/types/diff.ts

export type SchemaDiff = {
  source: { databaseName: string; dialect: DialectId }
  target: { databaseName: string; dialect: DialectId }
  addedTables: Table[]
  removedTables: Table[]
  modifiedTables: TableDiff[]
  unchangedTables: string[] // names only (rendered as a flat list in the UI)
}

export type TableDiff = {
  name: string
  columns: Change<Column>[]
  indexes: Change<Index>[]
  foreignKeys: Change<ForeignKey>[]
  checkConstraints: Change<CheckConstraint>[]
  optionChanges: OptionChange[]
}

export type OptionChange = { key: string; from: string | null; to: string | null }

export type Change<T> =
  | { kind: 'added'; after: T }
  | { kind: 'removed'; before: T }
  | { kind: 'modified'; before: T; after: T; fieldDiffs: FieldDiff[] }
  | { kind: 'renamed'; before: T; after: T } // engine never emits this in v0.1

export type FieldDiff = {
  field: string // e.g. "dataType", "nullable", "default"
  from: unknown
  to: unknown
}
```

### 6.4 Migration script

```ts
// shared/types/script.ts

export type MigrationScript = {
  generatedAt: string // ISO
  source: { databaseName: string }
  target: { databaseName: string }
  statements: Statement[] // ordered, ready to run top-to-bottom
  warnings: Warning[] // surfaced in UI (e.g. "narrowing VARCHAR(64) → VARCHAR(32) may truncate data")
}

export type Statement = {
  id: string // stable id for UI (e.g. "alter:products:column:sku")
  kind: StatementKind
  sql: string
  destructive: boolean
  tableName: string // primary target table for grouping in UI
  note?: string // human-readable explanation
}

export type StatementKind =
  | 'drop_foreign_key'
  | 'drop_index'
  | 'drop_table'
  | 'create_table'
  | 'alter_table_add_column'
  | 'alter_table_drop_column'
  | 'alter_table_modify_column'
  | 'alter_table_add_index'
  | 'alter_table_drop_index'
  | 'alter_table_add_foreign_key'
  | 'alter_table_options'
  | 'alter_table_check_add'
  | 'alter_table_check_drop'
  | 'preamble' // SET FOREIGN_KEY_CHECKS = 0;
  | 'postamble' // SET FOREIGN_KEY_CHECKS = 1;

export type Warning = {
  level: 'info' | 'warn' | 'danger'
  message: string
  statementId?: string
}
```

### 6.5 IPC contracts (current)

```ts
// shared/types/ipc.ts — actual shipped channel map

export type IpcChannelMap = {
  // Connections
  'connection:list':        { req: void;            res: Connection[] }
  'connection:create':      { req: ConnectionDraft; res: Connection }
  'connection:update':      { req: { id: string; patch: Partial<ConnectionDraft> };  res: Connection }
  'connection:delete':      { req: { id: string };  res: void }
  'connection:test':        { req: { id: string };  res: ConnectionTestResult }
  'connection:test-draft':  { req: ConnectionDraft; res: ConnectionTestResult }

  // Schema comparison
  'compare:list-tables':    { req: { id: string };  res: { tables: string[] } }
  'compare:run': {
    req: { sourceId: string; targetId: string; tables?: string[] }
    res: { diff: SchemaDiff; script: MigrationScript }
  }
  'compare:table': {
    // Lazy single-table introspect for the unchanged-table panel.
    req: { connectionId: string; tableName: string }
    res: Table | null
  }

  // ERD viewer (full schema for one connection)
  'schema:introspect':      { req: { connectionId: string }; res: Schema }

  // Migration script export
  'script:save':            { req: { script: MigrationScript }; res: { path: string | null } }
  'script:copy':            { req: { script: MigrationScript }; res: void }

  // Auto-update
  'update:install':         { req: void; res: void }

  // Data comparison
  'data:compare': {
    req: {
      sourceId: string
      targetId: string
      tableName: string
      keyColumns: string[]
      limit: number
    }
    res: DataTableDiff
  }
  // Dedicated handler — separated from script:save so DDL and DML pipelines
  // never share a code path.
  'data:save-sql':          { req: { sql: string; defaultName: string }; res: { path: string | null } }
}
```

The preload exposes a typed wrapper:

```ts
// electron/preload/index.ts
contextBridge.exposeInMainWorld('zaptar', {
  connection: {
    list: () => ipcRenderer.invoke('connection:list'),
    create: (draft) => ipcRenderer.invoke('connection:create', draft),
    update: (id, patch) => ipcRenderer.invoke('connection:update', { id, patch }),
    delete: (id) => ipcRenderer.invoke('connection:delete', { id }),
    test: (id) => ipcRenderer.invoke('connection:test', { id })
  },
  compare: {
    listTables: (id) => ipcRenderer.invoke('compare:list-tables', { id }),
    run: (sourceId, targetId, tables) =>
      ipcRenderer.invoke('compare:run', { sourceId, targetId, tables })
  },
  script: {
    save: (script) => ipcRenderer.invoke('script:save', { script }),
    copy: (script) => ipcRenderer.invoke('script:copy', { script })
  }
})
```

A matching `src/lib/api.ts` re-exports a strongly typed `api` object with the same shape, plus a `window.zaptar` `.d.ts` augmentation.

---

## 7. The `SchemaProvider` interface (extensibility seam)

```ts
// shared/provider.ts

export interface SchemaProvider {
  id: DialectId // 'mysql' | 'mariadb' | future: 'postgres' | ...
  displayName: string

  introspect(conn: Connection, password: string, opts: { tables?: string[] }): Promise<Schema>

  emitSql(diff: SchemaDiff, opts: EmitOptions): MigrationScript

  formatDdl(unit: FormatUnit, ctx: FormatCtx): string

  // Optional in v0.1; reserved for the future "Execute" feature.
  apply?(
    conn: Connection,
    password: string,
    script: MigrationScript,
    onProgress: (event: ApplyEvent) => void
  ): Promise<{ ok: boolean; firstFailure?: { statementId: string; error: string } }>
}

export type FormatUnit =
  | { type: 'column'; data: Column; tableName: string }
  | { type: 'index'; data: Index; tableName: string }
  | { type: 'foreignKey'; data: ForeignKey; tableName: string }
  | { type: 'checkConstraint'; data: CheckConstraint; tableName: string }
  | { type: 'table'; data: Table }

export type FormatCtx = {
  // future: dialect-specific quoting hints, charset defaults, ...
}

export type EmitOptions = {
  wrapForeignKeyChecks: boolean // default true: prepend SET FOREIGN_KEY_CHECKS=0; append =1
  generateIfExistsIfNotExists: boolean // default true for CREATE/DROP
  emitTableOptionAlters: boolean // default true
}
```

The `MySQLProvider` is the only implementation in v0.1. To add Postgres later, write a `PostgresProvider` with the same interface — **no changes** to `shared/diff/engine.ts` or any UI component should be required.

---

## 8. MySQL provider — introspection

### 8.1 Queries

All queries take `:db` (the schema name) and an optional `:tables` list.

**Tables:**

```sql
SELECT TABLE_NAME, ENGINE, TABLE_COLLATION, TABLE_COMMENT,
       CREATE_OPTIONS, ROW_FORMAT, AUTO_INCREMENT
FROM information_schema.TABLES
WHERE TABLE_SCHEMA = :db
  AND TABLE_TYPE = 'BASE TABLE'
  AND (:tables IS NULL OR TABLE_NAME IN (:tables))
ORDER BY TABLE_NAME;
```

**Columns:**

```sql
SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION,
       COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA,
       CHARACTER_SET_NAME, COLLATION_NAME, COLUMN_COMMENT,
       GENERATION_EXPRESSION
FROM information_schema.COLUMNS
WHERE TABLE_SCHEMA = :db
  AND (:tables IS NULL OR TABLE_NAME IN (:tables))
ORDER BY TABLE_NAME, ORDINAL_POSITION;
```

**Indexes:**

```sql
SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE,
       SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, EXPRESSION, COMMENT
FROM information_schema.STATISTICS
WHERE TABLE_SCHEMA = :db
  AND (:tables IS NULL OR TABLE_NAME IN (:tables))
ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX;
```

Group rows by `(TABLE_NAME, INDEX_NAME)`. Determine `kind`:

- `INDEX_NAME = 'PRIMARY'` → `'primary'`
- `NON_UNIQUE = 0` → `'unique'`
- `INDEX_TYPE = 'FULLTEXT'` → `'fulltext'`
- `INDEX_TYPE = 'SPATIAL'` → `'spatial'`
- otherwise → `'index'`

**Foreign keys:**

```sql
SELECT kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME,
       kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
       kcu.ORDINAL_POSITION,
       rc.UPDATE_RULE, rc.DELETE_RULE
FROM information_schema.KEY_COLUMN_USAGE kcu
JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
  ON rc.CONSTRAINT_SCHEMA = kcu.CONSTRAINT_SCHEMA
 AND rc.CONSTRAINT_NAME   = kcu.CONSTRAINT_NAME
WHERE kcu.TABLE_SCHEMA = :db
  AND kcu.REFERENCED_TABLE_NAME IS NOT NULL
  AND (:tables IS NULL OR kcu.TABLE_NAME IN (:tables))
ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION;
```

**Check constraints (MySQL 8.0.16+ / MariaDB 10.2+):**

```sql
SELECT tc.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE,
       tc.ENFORCED
FROM information_schema.TABLE_CONSTRAINTS tc
JOIN information_schema.CHECK_CONSTRAINTS cc
  ON cc.CONSTRAINT_SCHEMA = tc.CONSTRAINT_SCHEMA
 AND cc.CONSTRAINT_NAME   = tc.CONSTRAINT_NAME
WHERE tc.TABLE_SCHEMA = :db
  AND tc.CONSTRAINT_TYPE = 'CHECK'
  AND (:tables IS NULL OR tc.TABLE_NAME IN (:tables));
```

Detect support: `SELECT VERSION();` and feature-flag this query. If the server is old, skip and emit no check-constraint diffs.

### 8.2 Edge cases

- `COLUMN_DEFAULT` returns `NULL` both when there is no default and when the default literally is `NULL`. Disambiguate using `IS_NULLABLE` + `EXTRA` + (for MariaDB) the `COLUMN_DEFAULT` of `NULL` vs the string `'NULL'`. Document: any ambiguity is logged as a warning rather than guessed.
- `EXTRA` contains lowercase strings like `auto_increment`, `on update CURRENT_TIMESTAMP`, `VIRTUAL GENERATED`, `STORED GENERATED`. Preserve casing as-is for diff fidelity, but normalize for **comparison** (lowercase, trim).
- `CHARACTER_SET_NAME` / `COLLATION_NAME` for a column may equal the table default. Treat them as equal to the table charset/collation if they match — diff at the column level only when they actually diverge from the table's.
- `AUTO_INCREMENT` value in `TABLES` is volatile. **Always exclude it** from the diff (treat as ignored option).
- Generated columns: include `GENERATION_EXPRESSION` and `EXTRA` (which contains `VIRTUAL GENERATED` or `STORED GENERATED`).

### 8.3 Connection options for `mysql2`

```ts
{
  host, port, user, password, database,
  multipleStatements: false,   // safety: never enable
  dateStrings: true,           // we want raw values from information_schema
  ssl: conn.ssl ?? undefined,
  connectTimeout: 10_000,
}
```

---

## 9. MySQL provider — SQL emission (`emit-sql.ts`)

### 9.1 Statement ordering (the contract)

The emitter walks `SchemaDiff` and produces statements **in this exact order**:

1. `preamble` — `SET FOREIGN_KEY_CHECKS = 0;` (only if `opts.wrapForeignKeyChecks`)
2. **All FK drops** across all `modifiedTables` and `removedTables`. (We drop FKs first so subsequent column/table modifications can't fail on referential integrity.)
3. **All check-constraint drops** for `removedTables` and any modified tables that are dropping checks.
4. **All index drops** that need to happen because the index is being removed entirely or being recreated with different column membership. (Done before column drops in case the index references those columns.)
5. **All `DROP TABLE` statements** for `removedTables` (destructive).
6. **All `CREATE TABLE` statements** for `addedTables` — **without their foreign keys** in the body. We emit the table with all columns, indexes, and check constraints, but FKs are deferred to step 9.
7. **For each modified table**, in dependency order (a topological ordering by FK references is unnecessary because FKs are already dropped): emit `ALTER TABLE` statements for column changes, index re-adds, check-constraint adds, and option changes.
8. _(Reserved.)_
9. **All FK adds**: re-add modified FKs and add new FKs from new tables. By now every referenced table exists, so `ADD CONSTRAINT ... FOREIGN KEY ...` is safe.
10. `postamble` — `SET FOREIGN_KEY_CHECKS = 1;`

This ordering is asserted by unit tests.

### 9.2 ALTER TABLE strategy for modified tables

For one modified table, group by section:

- **Drop indexes** that need removing or recreating (already done in step 4).
- **Drop columns** (destructive — flagged).
- **Modify existing columns**: use `MODIFY COLUMN`, not `CHANGE COLUMN`, since v0.1 doesn't do renames. Emit one `MODIFY COLUMN` statement per changed column for clarity (even though they could be batched). The user can hand-merge if they care about performance.
- **Add new columns**: `ADD COLUMN ... [AFTER ...]` to preserve ordering. Use `AFTER` based on the source ordinal.
- **Add indexes** (already-existing names that were re-added in step 4 plus brand-new indexes).
- **Add check constraints**.
- **Table options** (engine, charset, collation, comment): emit a single `ALTER TABLE ... ENGINE=... DEFAULT CHARSET=... COLLATE=... COMMENT='...';` if any of these changed.

### 9.3 Destructive flagging

A statement is `destructive: true` if it is any of:

- `DROP TABLE`, `DROP COLUMN`, `DROP INDEX` (where the index is `unique` or `primary`)
- `MODIFY COLUMN` where the type change is **narrowing** (e.g. `VARCHAR(64) → VARCHAR(32)`, `INT → SMALLINT`, removing a value from `ENUM`)
- `MODIFY COLUMN` that goes from `NULL` to `NOT NULL` without a default (data may be rejected)
- Charset/collation change on a table/column that contains string data (will rewrite rows and may corrupt existing data with non-target-charset bytes)

Each such statement also produces a `Warning` of level `'danger'` or `'warn'`.

### 9.4 Identifier quoting

All identifiers (table names, column names, index names, FK names) emitted in SQL go through `electron/main/providers/mysql/identifiers.ts:quote()` which:

- Wraps in backticks
- Escapes any embedded backtick as ` ` ``

String literals (defaults, comments, check expressions) go through `escapeString()` which uses `mysql2`'s `format()` / `escape()`.

---

## 10. Diff engine (`shared/diff/engine.ts`)

Pure function:

```ts
export function diff(source: Schema, target: Schema): SchemaDiff
```

### 10.1 Algorithm

1. Index both schemas' tables by name → two `Map<string, Table>`.
2. `addedTables` = tables in source but not in target.
3. `removedTables` = tables in target but not in source.
4. For each table name present in both: `diffTable(source.tables[n], target.tables[n])` → `TableDiff`.
   - If the result has zero changes across all sections → push name into `unchangedTables`.
   - Otherwise push into `modifiedTables`.

### 10.2 `diffTable`

For each section (columns, indexes, foreignKeys, checkConstraints):

- Index by name on both sides.
- Items only in source → `{ kind: 'added', after }`.
- Items only in target → `{ kind: 'removed', before }`.
- Items in both → call `diff{Section}Item(before, after)`. If any field differs → `{ kind: 'modified', before, after, fieldDiffs }`. Otherwise drop it (unchanged items aren't in the diff).

For `optionChanges`: walk a fixed allowlist of option keys (`engine`, `charset`, `collation`, `comment`, `rowFormat`). Compare values; emit `OptionChange` for differing ones.

### 10.3 Field-level comparison rules

- `Column.dataType`: case-insensitive comparison of the **normalized** form. Normalize by lowercasing the type name and trimming whitespace. Length/precision must match.
- `Column.default`: literal string comparison after trimming. The strings `NULL` and `null` (the SQL null) are treated equivalently. The string `''` is **not** equivalent to `NULL`.
- `Column.extra`: lowercased, trimmed comparison.
- `Index.columns`: order-sensitive comparison of `(columnName, subPart, expression)`.
- `ForeignKey.columns` / `referencedColumns`: order-sensitive.
- `ForeignKey.onUpdate` / `onDelete`: `'NO ACTION'` and `'RESTRICT'` are **equivalent** in MySQL — treat as same.

### 10.4 Determinism

- Map iteration order is insertion order in modern JS, but the engine sorts all output arrays by name (or by ordinal where applicable) so the output is byte-identical for the same input.
- Tested by golden snapshots.

### 10.5 Why no rename detection

Renames are heuristic and false positives are expensive (you'd issue `RENAME COLUMN` instead of `DROP+ADD`, which preserves data unintentionally — sometimes good, sometimes wrong). Without a confirmation UI it's risky. The current emitter always emits `DROP` + `ADD`. The `Change<T>` union has a `'renamed'` arm so adding it later is a non-breaking change.

---

## 10A. Data comparison (`src/main/providers/mysql/data.ts`)

Data comparison is a separate feature pipeline that runs **on demand per table** from the Result page Data tab. It is not coupled to the schema diff.

### 10A.1 Flow

```
User picks key columns + row limit on Data tab
            │
            ▼  IPC: 'data:compare'
   Main: open both connections in parallel
            │
            ▼
   fetchTableRows(srcConn, ..., limit)  ┐
   fetchTableRows(tgtConn, ..., limit)  ┘  Promise.all
            │
            ▼
   diffTableData(...)  →  DataTableDiff
            │
            ▼
   Renderer: row diff table + data sync SQL (generated client-side)
```

### 10A.2 Safety guarantees

- **SQL injection guard** — `tableName` is interpolated into `SELECT * FROM \`${tableName}\``; mysql2 cannot parameterize identifiers, so an explicit `assertSafeIdentifier` call rejects any string containing backtick, quote, NUL, whitespace, or backslash.
- **Cap detection** — fetch `limit + 1` rows; if more than `limit` come back, set `capped: true` and trim. UI surfaces a banner.
- **Boolean normalization** — `rowsEqual` collapses booleans to `0 / 1` so BIT and TINYINT(1) columns compared across mysql2 driver versions don't produce false-positive modified rows.
- **Column union** — column list is the union of keys across all rows from both sides, in source-first order. Prevents columns missing from `rows[0]` being silently dropped from the diff.

### 10A.3 Output type

```ts
// shared/types/data.ts
export type DataRow = Record<string, string | number | boolean | null>

export type DataTableDiff = {
  tableName: string
  keyColumns: string[]
  columns: string[]      // ordered, union of source + target row keys
  added:    DataRow[]    // in source, missing from target
  removed:  DataRow[]    // in target, missing from source
  modified: { key: DataRow; before: DataRow; after: DataRow }[]
  rowsFetched: { source: number; target: number }
  capped: boolean
  limit: number
}
```

### 10A.4 Data sync SQL generation

`generateDataSyncSql(diff, skipKeyInInsert, filter)` is a pure renderer-side function. No IPC for SQL emission — the renderer assembles the script directly from `DataTableDiff`. It produces formatted INSERT / UPDATE / DELETE statements (column list and values on separate lines for readability). The `filter: RowFilter` argument is the same one driving the row-diff table view, so saved / copied SQL always matches what the user sees. When any filter is inactive the Save / Copy buttons append `(filtered)` to make the omission obvious.

The save flow uses the dedicated `data:save-sql` IPC — deliberately separated from `script:save` so DDL and DML pipelines never share a code path.

---

## 10B. ERD viewer (`src/renderer/src/components/erd/`)

The ERD viewer is an exploration tool, not part of the diff workflow. It reads one connection's full schema via `schema:introspect` and renders it as an interactive node-and-edge canvas.

### 10B.1 Stack

- **`@xyflow/react`** v12 — node-based canvas with built-in zoom / pan / minimap
- **`@dagrejs/dagre`** — auto-layout in left-to-right rank order
- **`html-to-image`** — captures the React Flow viewport for PNG / SVG export

### 10B.2 Layout

`ErdCanvas` runs dagre layout once per `(tables, selectedTables)` change:

- Each `Table` becomes a node with width derived from longest header / column-row content (260 – 460 px) and height = `header + rowCount * rowHeight`.
- Each `ForeignKey` becomes a directed edge from referenced (parent) → referencing (child) — so dagre puts parents on the left rank.
- Self-references and FKs to filtered-out tables are silently dropped so they don't perturb dagre's rank computation.

### 10B.3 Edge styling

- **Cardinality** detected from the FK column set: covered by primary / unique index → 1:1, otherwise N:1.
- **Crow's-foot SVG markers** at both endpoints (single-bar `||` for "exactly one", three-pronged for "many"). Markers use SVG2 `context-stroke` so they inherit the edge's color.
- **Per-relation color** from a stable 7-shade hash so overlapping lines are distinguishable.
- **Hover** brings the edge to front (z-index), animates it, fades the others to 25% opacity, expands the label to include `ON DELETE` action when not the default.
- **Memo split** — node layout and edge styling have separate `useMemo` deps so hovering an edge re-derives only the styling pass; the node layout (dagre) doesn't re-run.

### 10B.4 Custom node (`TableNode`)

- Header: full table name (no ellipsis — width is dynamic), engine badge.
- Per-column row: PK key icon or FK link icon, name, type, `NULL` badge if nullable, `= value` badge for non-null defaults. Tooltip exposes the full column metadata.
- React Flow `<Handle>` per FK column on the right edge (source) and per PK column on the left edge (target) so edges connect column row → column row.

### 10B.5 Performance and UX

- **Lazy table selection** — initial canvas is empty after schema load. Selecting all 500+ tables of a real database freezes the renderer; user picks the subset they care about.
- **"+ neighbors" button** per sidebar entry adds a table together with every FK-connected one (1 hop in either direction).
- **Jump to table** — clicking a table name in the sidebar (a) ensures the table is in the selection, (b) calls `useReactFlow().setCenter` to pan and zoom to it. A nonce in the focus prop ensures repeated clicks on the same table re-center.
- **Stale-fetch guards** on `schema:introspect` (request id ref) so a slow response from an old connection cannot overwrite a newer one.
- **Export** — top-right toolbar with PNG and SVG buttons. Uses `getNodesBounds` + `getViewportForBounds` to produce a transform that fits the full graph (not just the viewport) into the target image. Filters out Controls / MiniMap / Attribution from the captured DOM.
- **Dark canvas** — `colorMode="dark"` on `<ReactFlow>` plus CSS overrides in `main.css` align Controls / MiniMap with the app palette.

---

## 11. UI specification

### 11.1 Routes

- `/connections` — list + form (default landing if no connections exist)
- `/compare` — pick source/target/tables, "Run compare" button
- `/result` — diff tree + side-by-side diff (Schema tab) or row-level diff (Data tab) + migration script
- `/erd` — single-connection ERD viewer

Top-level layout: header bar with the app name, a route-switcher with four nav items (Connections / Compare / Result / ERD), and an auto-update banner on the right when an update is available or downloaded.

### 11.1A Keyboard shortcuts (global / per-page)

| Shortcut          | Where       | Action                                                  |
| ----------------- | ----------- | ------------------------------------------------------- |
| `Ctrl+,`          | Global      | Go to Connections page                                  |
| `Ctrl+P`          | Result      | Focus and select the table-tree search input            |
| `Ctrl+↓ / Ctrl+↑` | Result      | Navigate to next / previous table in the tree           |
| `Ctrl+\``         | Result      | Toggle Diff ↔ Migration Script view                     |
| `Ctrl+1` … `Ctrl+5` | Result    | Switch section tab (Columns / Indexes / FKs / Checks / Options) |
| `Ctrl+Shift+S`    | Result      | Save migration script to `.sql`                         |
| `Ctrl+Shift+C`    | Result      | Copy migration script to clipboard                      |
| `Ctrl+Enter`      | Compare     | Run compare (when source + target are set)              |
| `Ctrl+Shift+X`    | Compare     | Swap source ↔ target                                    |
| `Esc`             | Data tab    | Close the data-sync SQL full-screen modal               |

### 11.2 ConnectionsPage

- **List**: each row shows label, dialect badge, host:port, db name, last-tested timestamp.
- **Actions per row**: Edit, Delete (with confirm), Test (shows a spinner → green/red badge and server version on success).
- **Add button** opens `ConnectionForm` in a sheet/dialog.
- **Form fields**: label, dialect (`mysql`/`mariadb`), host, port (default 3306), username, password (masked), database, "Use SSL" checkbox.
- **Validation**: required fields, port 1-65535, label unique.
- On save: main process writes connection record to lowdb and the password to keytar.

### 11.3 ComparePage

Split layout:

- **Left**: "Source (newer)" `EnvPicker` — dropdown of connections, "this is the schema we're matching to". Helper text: "Usually your dev/staging database."
- **Right**: "Target (older)" `EnvPicker` — dropdown of connections. Helper text: "Usually your prod database. This is what will receive the migration."
- **Below**: `TableCheckTree` — once both sides are picked, the app introspects table lists from both and shows a checkbox tree.
  - Three groups: "Only in source" (will be created), "Only in target" (will be dropped), "In both" (will be diffed).
  - All checked by default. Each group has a "select all in group" checkbox.
- **Run button**: disabled until both connections selected. Shows progress: "Connecting…" → "Introspecting source…" → "Introspecting target…" → "Computing diff…" → navigates to `/result`.

### 11.4 ResultPage (the marquee screen)

```
┌─ Header ─────────────────────────────────────────────────────────────┐
│ dev (source) → prod (target)        [Diff] [Migration Script]  [↻]   │
├─ TableTree ─────────┬─ Main panel ────────────────────────────────────┤
│ 🔍 filter…         │ products                                          │
│ Show: ☑ All        │ ── Columns ── Indexes ── FKs ── Checks ── Opts ──│
│                    │                                                    │
│ ➕ Added  (2)      │   prod (current)         │  dev (target)           │
│  ├ audit_log       │ ─────────────────────────┼──────────────────────── │
│  └ tag             │ id INT NOT NULL PK       │  id INT NOT NULL PK     │
│                    │ sku VARCHAR(32) ░░░░░░░░ │░ sku VARCHAR(64) ░░░░░░ │ ← yellow
│ ✏️ Modified  (5)    │ name VARCHAR(255)        │  name VARCHAR(255)      │
│  ├ products  [3]   │ ░old_field VARCHAR(50)░ │                         │ ← red
│  ├ users     [1]   │                          │░ created_at DATETIME ░ │ ← green
│                    │ price DECIMAL(10,2)      │  price DECIMAL(10,2)    │
│ ➖ Removed (1)      │                                                    │
│  └ legacy_orders   │                                                    │
│                    │                                                    │
│ ⏸ Unchanged (47)   │                                                    │
│  (collapsed)       │                                                    │
└────────────────────┴────────────────────────────────────────────────────┘
```

**TableTree (left rail)**:

- Sticky filter input at top (matches table name).
- Group toggles to show/hide Added / Modified / Removed / Unchanged.
- Each row clickable; click loads that table's diff in the main panel.
- Modified tables show a per-table change count badge (e.g. `[3]` = 3 changed columns/indexes/etc.).
- Keyboard: ↑/↓ to navigate.

**Main panel — Diff view**:

- Sub-tabs: **Columns | Indexes | Foreign Keys | Check Constraints | Table Options**. Each tab shows a count badge if it has any changes.
- Two-column layout, headers `<source-label> (current)` and `<target-label> (target)`. _Note on terminology_: in the data model, `source` = newer = the one we're matching to, `target` = older = the one receiving the migration. The UI uses friendlier wording.
- Each row is a `DiffRow` rendering a one-line DDL fragment (column definition, etc.), color-coded.
- Modified rows show both lines side by side; an `InlineHighlight` underlines the differing token (e.g. `VARCHAR(`**`32`**`)` vs `VARCHAR(`**`64`**`)`).
- For Added / Removed rows the opposite side renders a placeholder of the same height (so vertical alignment is preserved).
- Above the diff: a small badge strip showing kind of changes ("3 modified, 1 added, 1 removed"), and a "View raw DDL" toggle that shows the full `CREATE TABLE` for both sides.

**Main panel — Migration Script tab**:

- Top: warnings panel (collapsible) listing `Warning` items, color-coded (info/warn/danger).
- Center: CodeMirror 6 in read-only mode, SQL syntax. The full script. Destructive statements highlighted with a red gutter marker.
- Right side: a "Statements" outline (collapsible) that mirrors the statement list — clicking a statement scrolls the editor to it. Each statement shows kind + table + destructive badge.
- Footer: **Copy to clipboard**, **Save as .sql…** buttons.

### 11.5 Color tokens (Tailwind v4 `@theme`)

```css
@theme {
  --color-diff-added: #16a34a; /* green-600 */
  --color-diff-added-bg: #dcfce7; /* green-100 */
  --color-diff-removed: #dc2626; /* red-600 */
  --color-diff-removed-bg: #fee2e2; /* red-100 */
  --color-diff-modified: #ca8a04; /* yellow-600 */
  --color-diff-modified-bg: #fef9c3; /* yellow-100 */
  --color-diff-modified-token: #f59e0b; /* underline color */
  --color-diff-unchanged: #6b7280; /* gray-500 */
  --color-destructive: #dc2626;
}
```

Dark mode variants follow the same names with `dark` prefix.

### 11.6 Empty states

- No connections yet: ConnectionsPage shows a centered "Add your first connection" CTA.
- No diff to show (schemas identical): ResultPage shows a celebratory "Schemas are in sync ✓" panel with a "Re-run compare" button.

### 11.7 Error states

- Connection failure on test: red badge with the raw error message in a tooltip and the full error in an expandable details panel.
- Compare failure: error overlay with the failing step and full message; "Retry" button keeps the form state.

---

## 12. State management (Zustand)

```ts
// src/store/connections.slice.ts
type ConnectionsSlice = {
  connections: Connection[]
  loading: boolean
  load: () => Promise<void>
  create: (draft: ConnectionDraft) => Promise<Connection>
  update: (id: string, patch: Partial<ConnectionDraft>) => Promise<Connection>
  remove: (id: string) => Promise<void>
  test: (id: string) => Promise<{ ok: boolean; error?: string; serverVersion?: string }>
}

// src/store/comparison.slice.ts
type ComparisonSlice = {
  sourceId: string | null
  targetId: string | null
  availableTables: { source: string[]; target: string[] } | null
  selectedTables: Set<string> // empty set = all
  status: 'idle' | 'loading' | 'success' | 'error'
  diff: SchemaDiff | null
  script: MigrationScript | null
  error: string | null
  setSource: (id: string | null) => void
  setTarget: (id: string | null) => void
  loadTables: () => Promise<void>
  toggleTable: (name: string) => void
  run: () => Promise<void>
  reset: () => void
}

// src/store/ui.slice.ts
type UiSlice = {
  selectedTable: string | null // which table is selected in the diff tree
  activeSection: 'columns' | 'indexes' | 'fks' | 'checks' | 'options'
  showUnchanged: boolean
  diffFilter: string // text filter for the tree
  scriptTabVisible: boolean
  setSelectedTable: (n: string | null) => void
  setActiveSection: (s: UiSlice['activeSection']) => void
}
```

A single Zustand store combines all three slices via the slices pattern.

---

## 13. Connection storage and secrets

- **Connection records** (everything except the password): saved to `<userData>/zaptar/connections.json` via lowdb.
- **Passwords**: saved to OS keychain via `keytar.setPassword('zaptar', `connection:${id}`, password)`.
- **On delete**: lowdb record removed _and_ `keytar.deletePassword('zaptar', `connection:${id}`)`.
- **Migration on first launch**: if `<userData>/zaptar/` doesn't exist, create it. Initial `connections.json` is `{ connections: [] }`.

The renderer **never** sees passwords. Test/compare operations send only the connection `id`; main resolves the password.

---

## 14. Build and packaging

### 14.1 `electron-vite` config (sketch)

```ts
// electron.vite.config.ts
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

export default defineConfig({
  main: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve(__dirname, 'shared') } }
  },
  preload: {
    plugins: [externalizeDepsPlugin()],
    resolve: { alias: { '@shared': resolve(__dirname, 'shared') } }
  },
  renderer: {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@shared': resolve(__dirname, 'shared')
      }
    }
  }
})
```

### 14.2 `electron-builder` config (sketch)

```yaml
# electron-builder.yml
appId: com.rehoukrel.zaptar
productName: zaptar
directories:
  output: release
files:
  - out/**/*
  - package.json
mac:
  target: [{ target: dmg, arch: [x64, arm64] }]
  category: public.app-category.developer-tools
win:
  target: [{ target: nsis, arch: [x64] }]
linux:
  target: [{ target: AppImage }, { target: deb }]
  category: Development
```

### 14.3 Native dependencies

`keytar` is native. It must be **rebuilt for Electron** after `pnpm install`. `electron-builder install-app-deps` (run as a `postinstall` script) handles this. CI must have build tooling (Visual Studio Build Tools on Windows; Xcode CLT on macOS).

---

## 15. Testing strategy

### 15.1 Unit (Vitest) — the must-have tier

**`shared/diff/engine.test.ts`** — golden tests covering:

- Empty schemas → empty diff
- Identical schemas → empty diff (with all table names in `unchangedTables`)
- Table added on source → present in `addedTables`
- Table removed on source → present in `removedTables`
- Column added / removed / modified (each field: dataType, nullable, default, extra, charset, collation, comment, generationExpression)
- Column reordering: ordinal change is captured as a `fieldDiff`
- Index added / removed / column-set changed / kind changed (e.g. unique → non-unique)
- FK added / removed / referenced-table changed / actions changed
- FK actions `'NO ACTION'` and `'RESTRICT'` treated as equal
- Check constraint added / removed / expression changed
- Table option changes (engine, charset, collation, comment)
- Output is byte-identical for the same input run twice (determinism test)

**`electron/main/providers/mysql/emit-sql.test.ts`** — ordering tests:

- For a diff with FK drops, table drops, table creates, alters, and FK adds: emitted statements come out in the documented order.
- New table that has FK referencing another new table → both tables created before either FK is added.
- Modified table that drops a column referenced by an FK → the FK is dropped before the column drop.
- Wrap with `SET FOREIGN_KEY_CHECKS = 0` / `= 1` when option enabled.
- Destructive flag set correctly for `DROP TABLE`, `DROP COLUMN`, narrowing `MODIFY COLUMN`.

**`format-ddl.test.ts`** — given a `Column`, the emitted DDL fragment matches a snapshot. (Snapshot-tested.)

### 15.2 Integration (manual + scripted) — the realism check

Local Docker setup:

```sh
docker run -d --name zaptar-prod -e MARIADB_ROOT_PASSWORD=pw -p 3307:3306 mariadb:10.11
docker run -d --name zaptar-dev  -e MARIADB_ROOT_PASSWORD=pw -p 3308:3306 mariadb:10.11
```

Seed both with `tests/fixtures/prod.sql` and `tests/fixtures/dev.sql`. The fixtures together exercise every diff case (added column with default, dropped column, narrowed type, charset change, new FK, FK action change, new table referencing existing, dropped table, new index, dropped index, generated column).

**Round-trip integration test (scripted)**:

1. Introspect prod → S_prod_before.
2. Introspect dev → S_dev.
3. `diff(S_dev, S_prod_before)` → `D`.
4. `emitSql(D)` → script.
5. Apply script to prod via `mysql` CLI.
6. Re-introspect prod → S_prod_after.
7. `diff(S_dev, S_prod_after)` should be **empty**.

This is the single most valuable end-to-end test. It catches emitter bugs and introspection-symmetry bugs.

### 15.3 E2E (Playwright) — smoke only

- Launch app, see Connections page.
- Add a connection (against the seeded MariaDB), test it (green badge appears).
- Add a second connection, go to Compare, see both table lists, run compare.
- Result page renders; click a modified table; assert side-by-side panel shows colored rows.
- Click "Migration Script"; assert the editor has non-empty SQL containing `ALTER TABLE`.

---

## 16. Release history (shipped milestones)

### v1.0.0 — Initial release

- Schema introspection for MySQL / MariaDB (tables, columns, indexes, FKs, checks, table options)
- Pure-TS diff engine (`shared/diff/engine.ts`)
- SQL emitter with safe statement ordering, destructive flagging, warnings
- Per-table side-by-side diff with section tabs (Columns / Indexes / FKs / Checks / Options)
- Migration script preview with custom SQL syntax highlighter (no CodeMirror dependency)
- Connection storage with OS-keychain-encrypted passwords
- Test-from-form, duplicate, edit-without-rewrite-password
- Result page table tree with grouped search and change-count badge
- Windows NSIS installer; macOS / Linux buildable from source

### v1.0.1 — Polish + auto-update

- VS Code-style keyboard shortcuts (Ctrl+P, Ctrl+↓/↑, Ctrl+\`, Ctrl+1…5, Ctrl+Shift+S/C, Ctrl+Enter, Ctrl+Shift+X)
- `electron-updater` integration with header banner ("Downloading update X" → "Restart to update")
- Compare page: source ↔ target swap
- Result page: full structure shown for added / removed tables, on-demand schema fetch for unchanged tables
- Fixes: silent script-save crashes surfaced inline, MariaDB `Unknown column 'EXPRESSION'` fallback
- CI builds installers for Windows + macOS + Linux in parallel

### v1.1.0 — Data comparison

- New **Data** tab on Result page; row-level diff per table on demand
- User-picked match key columns (primary key auto-suggested)
- Configurable row limit (default 10 000) with cap detection
- Filter chips (added / removed / modified) drive both the row diff view and the generated SQL
- Generated INSERT / UPDATE / DELETE data-sync SQL (deliberately separate from schema migration)
- "Skip key columns in INSERT" option for PK conflict scenarios
- Full-screen modal SQL preview, copy + save
- Table tree sidebar virtualized via `@tanstack/react-virtual`
- `SqlCode` extracted to shared util for reuse between schema and data preview

### v1.2.0 — ERD viewer + critical fixes

- New **ERD** page — full database visualization for any saved connection
- Crow's foot SVG markers; per-relation colors; smoothstep edge routing; hover highlight + animation
- Lazy table selection; "+ neighbors" sidebar button; jump-to-table; PNG / SVG export
- TableNode renders NULL / DEFAULT badges per column; dynamic per-table width
- Critical fixes for the v1.1.0 data comparison feature:
  - SQL injection guard on `tableName`
  - Column union (instead of first-row keys only)
  - Boolean normalization in `rowsEqual`
  - `showNotice` timer cleanup
  - Stale-fetch guards in `DataDiffView`
  - `(filtered)` indicator on Save / Copy when filter chips are inactive
  - Dedicated `data:save-sql` IPC (decouples DDL and DML pipelines)
  - SQL tokenizer handles standard `''` escape
  - Modal a11y (`role="dialog"` + Escape close)
  - Load-button race guard via request-id ref
- CI pin to `ubuntu-22.04` + `libfuse2` install so AppImage / deb builds succeed

### v1.2.1 — In progress

- Themed scrollbars across the app (dark variant matching the palette)
- ERD canvas PNG / SVG export buttons
- (More may land before tag.)

---

## 16A. Future roadmap (not yet shipped)

The architecture supports these without invasive changes:

- **Postgres provider** — implement `SchemaProvider` for `pg` driver; reuse the diff engine and UI unchanged.
- **In-app script execution** with progress feedback and rollback on first failure (the `apply` slot on `SchemaProvider` is reserved for this).
- **Stored procedures / functions / triggers / views** — extend the introspection queries and `Schema.tables` peer collections (`Schema.routines`, `Schema.triggers`, …); diff engine extends naturally via parallel arrays.
- **Schema history** — persist successive `Schema` snapshots locally; allow time-travel diff.
- **Rename detection** — heuristic + confirmation UI.
- **Functional ERD edges** — show outgoing FK arrows from FK column row directly to the targeted PK row, even across many-column tables.
- **Data sync execute** — apply the generated INSERT / UPDATE / DELETE script directly inside the app with row-progress feedback.

---

## 17. Setup instructions

```sh
# 1. Clone + install
git clone https://github.com/TiveCS/zaptar.git
cd zaptar
pnpm install

# 2. Start dev (Vite HMR + Electron main reload)
pnpm dev

# 3. Type-check (run as CI pre-flight too)
pnpm typecheck

# 4. Build production bundle (no installer)
pnpm build

# 5. Package installers
pnpm build:win        # Windows NSIS installer
pnpm build:mac        # macOS DMG
pnpm build:linux      # Linux AppImage / deb / snap
pnpm build:unpack     # Unpacked dir for fast local testing
```

For a release: bump `package.json` version, update `CHANGELOG.md`, push a `v*` tag. The GitHub Actions workflow at `.github/workflows/release.yml` builds installers for all three platforms in parallel and publishes them to a draft release on the matching tag (Linux pinned to `ubuntu-22.04` + `libfuse2`).

To smoke-test against MariaDB locally:

```sh
docker run -d --name zaptar-prod -e MARIADB_ROOT_PASSWORD=pw -p 3307:3306 mariadb:10.11
docker run -d --name zaptar-dev  -e MARIADB_ROOT_PASSWORD=pw -p 3308:3306 mariadb:10.11
# Add both as connections in the app, run a Compare against schemas you've seeded.
```

Required local tooling:

- Node.js ≥ 20
- pnpm ≥ 9
- Docker (for integration tests only)
- On Windows: Visual Studio Build Tools (for `keytar` native compilation)
- On macOS: Xcode Command Line Tools

---

## 18. Open considerations (known unknowns)

These are not blockers for v0.1 but should be revisited:

- **Charset/collation defaults inheritance**: when a column has the same charset as the table, MySQL/MariaDB report it both as the explicit value and as inherited. We normalize by treating "matches table default" as no-op. Edge case: if the table charset itself changes, every column "becomes different" without the column actually changing. Handle by computing column charset _relative to_ the source/target table charset and only flagging when the relative state differs.
- **Generated column expression normalization**: MySQL stores them with extra parens / spacing. We compare verbatim in v0.1; future improvement is a small SQL-expression normalizer.
- **Server-side default expressions** (e.g. `DEFAULT (UUID())`) in MySQL 8.0+ are stored differently from literal defaults. Our model treats them as strings; that's fine for diff but the emitter must wrap such defaults in parentheses in `MODIFY COLUMN`. Test fixture covers this.
- **Case sensitivity of identifiers**: MySQL has a `lower_case_table_names` server var that affects whether `Products` and `products` are the same table. v0.1 assumes case-sensitive identifiers (the default on Linux). Document this assumption; future work can detect the server setting.
- **MariaDB-specific syntax** (e.g. `INVISIBLE` columns, `WITH SYSTEM VERSIONING` tables) — out of scope; introspection captures them as comments/options only.

---

## 19. Glossary

| Term                      | Meaning in this app                                                                                  |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| **Source**                | The newer schema. The one whose state we want to replicate. (Often "dev".)                           |
| **Target**                | The older schema. The one that will receive the migration. (Often "prod".)                           |
| **Schema**                | A single MySQL database (in MySQL terminology, "schema" and "database" are synonyms).                |
| **Diff**                  | The computed difference between source and target, in our normalized model.                          |
| **Migration script**      | The ordered list of SQL statements that, when applied to the target, makes it match the source.      |
| **Data sync SQL**         | The ordered list of INSERT / UPDATE / DELETE statements that brings target row contents in line with source for a single table. Distinct file, distinct IPC channel from the migration script. |
| **Provider**              | A pluggable implementation of `SchemaProvider` for one dialect family. Today: `mysql` only.          |
| **Destructive statement** | A statement that drops a database object or that may cause data loss (e.g. narrowing a column type). |
| **Cardinality**           | In the ERD, the number of rows on each side of an FK relationship: `1:1` (FK column is unique-covered) or `N:1` (FK column is non-unique). Drawn with crow's-foot markers. |

---

_End of specification._
