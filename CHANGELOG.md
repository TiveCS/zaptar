# Changelog

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
