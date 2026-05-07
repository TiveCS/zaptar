# Changelog

## v1.2.0

### Features

#### ERD Viewer (new tooling)
- New **ERD** page on the main nav — visualize a database as an interactive entity-relationship diagram for any saved connection
- Tables render as nodes with full column list; foreign keys render as edges between the referencing column and the referenced column
- Primary-key columns highlighted with a key icon; foreign-key columns marked with a link icon
- Auto-layout via dagre — referenced (parent) tables appear on the left, referencing tables on the right
- Built-in zoom, pan, minimap, and zoom controls (mousewheel + drag, or use the on-canvas controls)
- Left sidebar table filter with search — toggle individual tables, "All / None" buttons, edges to filtered-out tables are hidden
- ERD is independent of the schema diff workflow; loading an ERD does not affect any active comparison

### Fixes
- **Data comparison: SQL injection guard** — table names are validated for illegal characters (backticks, quotes, whitespace, NUL) before being interpolated into the `SELECT` statement
- **Data comparison: column union** — column list now derived from a union of keys across all rows, not just `rows[0]`. Sparse / nullable columns no longer dropped from the diff
- **Data comparison: boolean compare** — BIT / TINYINT(1) values are normalized to `0 / 1` before equality check, eliminating false-positive modified rows when the mysql2 driver returns the same value as different JS types
- **Data panel: timer leak** — `showNotice` no longer stacks `setTimeout` calls. Pending timers are cleared on unmount
- **Data panel: race condition** — clicking Load multiple times in quick succession now ignores stale responses; only the latest request commits its result
- **Data panel: silent filter** — Save / Copy buttons append `(filtered)` and a tooltip when any row-type chip is hidden, surfacing that the saved SQL excludes some statements
- **Data diff view: stale schema fetch** — switching between unchanged tables faster than the schema fetch resolves no longer overwrites the column picker with a stale schema
- **SQL highlight: `''` escape** — string-literal tokenizer now handles the SQL-standard doubled-quote escape (e.g. `'it''s a value'`); previously broke the highlighter on any apostrophe-containing string

### Refactoring
- **Dedicated `data:save-sql` IPC** — saving the data sync SQL no longer reuses the schema migration `script:save` handler with a stub `MigrationScript`. The two pipelines are fully decoupled.

### A11y
- **Data sync SQL modal** — added `role="dialog"`, `aria-modal`, `autoFocus`, and Escape-to-close keyboard handler

---

## v1.1.0

### Features

#### Data Comparison (new tab on Result page)
- New **Data** tab alongside the existing Schema tab on the Result page
- Compare actual row data between two databases for any selected table — designed for config/settings tables that live in the DB
- On-demand per table (lazy load, same pattern as unchanged schema fetch) — no bulk fetching

#### Row-level Diff
- Detects **added** rows (in source, missing from target), **removed** rows (in target, missing from source), and **modified** rows (key matches, values differ)
- Modified rows show before → after inline with strikethrough on changed cells
- Key columns highlighted in column header with `key` badge
- `NULL` values rendered in muted italic style for clarity

#### Key Column Picker
- Choose which columns to use as the row match key
- Primary key auto-selected on load (resolved from table schema indexes)
- Bounded scrollable container — handles tables with many columns without layout overflow
- Tooltips on each chip explain select/deselect action

#### Row Filter Chips
- Clickable chips in the results toolbar to show/hide **added**, **removed**, and **modified** rows independently
- Filter affects both the row diff table and the generated SQL — uncheck "removed" → no DELETE statements
- `Show:` label makes the filter intent immediately clear; `title` tooltip on each chip for discoverability

#### Data Sync SQL Generation
- Generates **INSERT / UPDATE / DELETE** statements separate from the schema migration DDL — no mixing of data and schema changes
- Multi-line formatted output: column list and values on separate lines for INSERT; one SET clause per line for UPDATE
- SQL syntax highlighting (same VS Code Dark+ palette as the schema migration script)
- Copy to clipboard or save as `.sql` file directly from the results toolbar

#### "Skip key columns in INSERT" option
- Toggle to omit key columns from INSERT statements so the target DB auto-generates the ID
- Useful when the source PK value conflicts with an existing row in the target (e.g. config table ID already occupied)
- DELETE and UPDATE still use the key in WHERE — only INSERT column list is affected

#### Full-screen SQL Modal
- Expand button (⤢) on the Data sync SQL section header opens a full-screen overlay
- Full-height syntax-highlighted SQL with Save and Copy actions in the modal header
- Closes with the × button; filter state synced between inline and modal views

#### Row Limit
- Configurable row limit per table (default 10 000)
- Fetches `limit + 1` rows to detect cap; cap warning banner shown when either side hits the limit

### Performance
- Table tree sidebar virtualized with `@tanstack/react-virtual` — renders only visible rows regardless of total table count; eliminates jank on large schemas

### Fixes
- Horizontal scrollbar in SQL preview now sticks to the bottom of the visible container instead of appearing only at the end of content
- Horizontal scroll in row diff table properly separated from vertical scroll (independent overflow axes)

### Refactoring
- SQL syntax tokenizer and `SqlCode` component extracted to `src/renderer/src/lib/sql-highlight.tsx` — shared between schema migration script and data sync preview

---

## v1.0.1

### Features

#### Keyboard Shortcuts (VS Code-like)
- `Ctrl+,` — Go to Connections page (global)
- `Ctrl+P` — Focus and select the table search input
- `Ctrl+↓ / Ctrl+↑` — Navigate to the next / previous table
- `Ctrl+\`` — Toggle between Diff and Migration Script view
- `Ctrl+1`…`Ctrl+5` — Switch section tab (Columns / Indexes / Foreign Keys / Check Constraints / Table Options)
- `Ctrl+Shift+S` — Save migration script to `.sql` file
- `Ctrl+Shift+C` — Copy migration script to clipboard
- `Ctrl+Enter` — Run compare (when source and target are set)
- `Ctrl+Shift+X` — Swap source ↔ target

#### Auto-Update
- App checks for new releases on startup and downloads in the background
- Header shows download progress ("Downloading update x.x.x…")
- Restart to update button appears when download completes

#### Connection Management
- Duplicate connection button — opens form pre-filled with all fields, password blank for security
- Test connection directly from the add / edit / duplicate form before saving
- Password show / hide toggle on all connection forms
- Editing a connection with blank password now keeps the existing stored password

#### Compare Page
- Swap source ↔ target with a single button click

#### Result Page
- Added and removed tables show full structure in tabbed view: Columns, Indexes, Foreign Keys, Check Constraints
- Unchanged tables load schema on demand (spinner while fetching) — no bloated initial payload

### Fixes
- Script save no longer crashes silently — errors shown inline in the toolbar
- Copy to clipboard errors shown inline
- `Unknown column 'EXPRESSION'` on MariaDB / MySQL < 8.0.13 handled automatically

### Build
- GitHub Actions now builds for all three platforms in parallel: Windows (NSIS), macOS (DMG), Linux (AppImage + deb)

---

## v1.0.0 — Initial Release

### Features

#### Schema Comparison
- Compare two MySQL / MariaDB databases side-by-side
- Detects added, modified, removed, and unchanged tables
- Deep diff per table: columns, indexes, foreign keys, check constraints, and table options
- Source column values shown alongside target for every modified field
- Unchanged columns, indexes, and FKs shown in muted style at the bottom of each section — no context lost
- Added and removed tables show full structure (columns, indexes, FKs, checks) in tabbed view, not just a column list
- Unchanged tables load schema on-demand with a spinner — no bloated initial payload

#### Migration Script
- Auto-generates SQL migration script from diff result
- Custom SQL syntax highlighting (VS Code Dark+ palette, no external dependency)
- Collapsible warnings panel with destructive-statement count badge
- Copy to clipboard or save as `.sql` file

#### Connection Management
- Save multiple MySQL / MariaDB connections
- Passwords encrypted via OS keychain (never stored in plain text)
- Test connection from the connection list card
- Test connection directly from the add / edit / duplicate form (tests live credentials before saving)
- Duplicate connection — opens form pre-filled with all fields, blank password
- Edit connection — leaving password blank keeps the existing encrypted password
- Password show / hide toggle on all connection forms

#### Compare Page
- Filter and select specific tables before running comparison
- Swap source ↔ target with a single button click
- Table list search filter with visible/total count

#### Result Page
- Table tree sidebar with Added / Modified / Removed / Unchanged groups
- Search filter across all table groups
- Change count badge on sidebar header (unchanged tables not counted)
- Summary header bar: source → target database names, per-kind change chips
- Migration Script view toggled from the sidebar

### Fixes
- `Unknown column 'EXPRESSION'` error on MariaDB and MySQL < 8.0.13 — falls back to `NULL AS EXPRESSION` automatically
- Editing a connection without entering a new password no longer clears the stored password
- Target connection card no longer overflows viewport on the Compare page

### Build
- Windows NSIS installer via `pnpm build:win`
- GitHub Actions workflow triggers on `v*` tags, builds Windows installer, publishes draft release to GitHub Releases
