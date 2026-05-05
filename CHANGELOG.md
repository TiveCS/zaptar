# Changelog

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
