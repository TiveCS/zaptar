import { AlertTriangle, ChevronDown, ChevronRight, Copy, Loader2, Maximize2, Play, Save, X } from 'lucide-react'
import * as React from 'react'

import type { DataRow, DataTableDiff } from '@shared/types'
import type { Table } from '@shared/types/schema'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { SqlCode } from '@renderer/lib/sql-highlight'
import { cn } from '@renderer/lib/utils'

// ── SQL generation (data sync — separate from schema migration script) ────────

function escVal(v: DataRow[string]): string {
  if (v === null) return 'NULL'
  if (typeof v === 'boolean') return v ? '1' : '0'
  if (typeof v === 'number') return String(v)
  return `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`
}

function q(name: string): string {
  return `\`${name}\``
}

const ALL_SHOWN: RowFilter = { showAdded: true, showModified: true, showRemoved: true }

export function generateDataSyncSql(
  diff: DataTableDiff,
  skipKeyInInsert = false,
  filter: RowFilter = ALL_SHOWN
): string {
  const { tableName, keyColumns, columns, added, removed, modified } = diff
  const parts: string[] = []

  // INSERT for rows present in source but not in target.
  // skipKeyInInsert=true omits key columns so the DB auto-generates the ID —
  // useful when the PK value conflicts with existing rows in the target.
  if (filter.showAdded) {
    for (const row of added) {
      const insertCols = skipKeyInInsert
        ? columns.filter((c) => !keyColumns.includes(c))
        : columns
      if (insertCols.length === 0) continue
      const colList = insertCols.map(q).join(', ')
      const valList = insertCols.map((c) => escVal(row[c] ?? null)).join(', ')
      parts.push(
        `INSERT INTO ${q(tableName)}\n` +
        `  (${colList})\n` +
        `VALUES\n` +
        `  (${valList});`
      )
    }
  }

  // DELETE for rows present in target but not in source
  if (filter.showRemoved) {
    for (const row of removed) {
      const where = keyColumns
        .map((k) => `${q(k)} = ${escVal(row[k] ?? null)}`)
        .join(' AND ')
      parts.push(`DELETE FROM ${q(tableName)}\nWHERE ${where};`)
    }
  }

  // UPDATE for rows where key matches but values differ
  if (filter.showModified) {
    for (const { key, after } of modified) {
      const nonKeyColumns = columns.filter((c) => !keyColumns.includes(c))
      if (nonKeyColumns.length === 0) continue
      const setClauses = nonKeyColumns
        .map((c) => `  ${q(c)} = ${escVal(after[c] ?? null)}`)
        .join(',\n')
      const where = keyColumns
        .map((k) => `${q(k)} = ${escVal(key[k] ?? null)}`)
        .join(' AND ')
      parts.push(`UPDATE ${q(tableName)}\nSET\n${setClauses}\nWHERE ${where};`)
    }
  }

  return parts.join('\n\n')
}

// ── Row diff table ────────────────────────────────────────────────────────────

function CellValue({ value }: { value: DataRow[string] }): React.JSX.Element {
  if (value === null) return <span className="italic text-[var(--color-muted-foreground)]/50">NULL</span>
  return <>{String(value)}</>
}

type RowFilter = { showAdded: boolean; showModified: boolean; showRemoved: boolean }

function RowDiffTable({ diff, filter }: { diff: DataTableDiff; filter: RowFilter }): React.JSX.Element {
  const { columns, keyColumns, added, removed, modified } = diff
  const { showAdded, showModified, showRemoved } = filter

  const visibleAdded    = showAdded    ? added    : []
  const visibleRemoved  = showRemoved  ? removed  : []
  const visibleModified = showModified ? modified : []
  const total = visibleAdded.length + visibleRemoved.length + visibleModified.length

  if (added.length === 0 && removed.length === 0 && modified.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        No row differences found.
      </p>
    )
  }

  if (total === 0) {
    return (
      <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
        All row types hidden — enable filters above to see results.
      </p>
    )
  }

  // Key columns first for readability
  const orderedCols = [
    ...keyColumns,
    ...columns.filter((c) => !keyColumns.includes(c))
  ]

  return (
    // overflow-x-auto here — parent uses overflow-y-auto so each axis is independent
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
      <table className="w-max min-w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
            <th className="w-6 py-1.5 pl-3 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              ±
            </th>
            {orderedCols.map((col) => (
              <th
                key={col}
                className={cn(
                  'whitespace-nowrap py-1.5 pr-3 text-left text-xs font-semibold uppercase tracking-wide',
                  keyColumns.includes(col)
                    ? 'text-[var(--color-diff-modified)]'
                    : 'text-[var(--color-muted-foreground)]'
                )}
              >
                {col}
                {keyColumns.includes(col) && (
                  <span className="ml-1 text-[10px] normal-case opacity-60">key</span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {/* Added rows */}
          {visibleAdded.map((row, i) => (
            <tr key={`add-${i}`} className="border-b border-[var(--color-border)]/50 bg-[var(--color-diff-added-bg)]">
              <td className="py-1.5 pl-3 pr-2 font-mono text-xs font-bold text-[var(--color-diff-added)]">+</td>
              {orderedCols.map((col) => (
                <td key={col} className="whitespace-nowrap py-1.5 pr-3 font-mono text-xs text-[var(--color-diff-added)]">
                  <CellValue value={row[col] ?? null} />
                </td>
              ))}
            </tr>
          ))}

          {/* Removed rows */}
          {visibleRemoved.map((row, i) => (
            <tr key={`del-${i}`} className="border-b border-[var(--color-border)]/50 bg-[var(--color-destructive)]/8">
              <td className="py-1.5 pl-3 pr-2 font-mono text-xs font-bold text-[var(--color-diff-removed)]">−</td>
              {orderedCols.map((col) => (
                <td key={col} className="whitespace-nowrap py-1.5 pr-3 font-mono text-xs text-[var(--color-diff-removed)]">
                  <CellValue value={row[col] ?? null} />
                </td>
              ))}
            </tr>
          ))}

          {/* Modified rows — before (strikethrough) + after */}
          {visibleModified.map(({ before, after }, i) => (
            <React.Fragment key={`mod-${i}`}>
              <tr className="border-b border-[var(--color-border)]/30 bg-[var(--color-diff-modified-bg)]/60">
                <td className="py-1 pl-3 pr-2 font-mono text-xs font-bold text-[var(--color-diff-modified)]" rowSpan={2}>~</td>
                {orderedCols.map((col) => {
                  const changed = String(before[col] ?? '') !== String(after[col] ?? '')
                  return (
                    <td key={col} className="whitespace-nowrap py-1 pr-3 font-mono text-xs">
                      <span className={cn(
                        changed ? 'line-through opacity-60 text-[var(--color-diff-removed)]' : 'text-[var(--color-muted-foreground)]'
                      )}>
                        <CellValue value={before[col] ?? null} />
                      </span>
                    </td>
                  )
                })}
              </tr>
              <tr className="border-b border-[var(--color-border)]/50 bg-[var(--color-diff-modified-bg)]">
                {orderedCols.map((col) => {
                  const changed = String(before[col] ?? '') !== String(after[col] ?? '')
                  return (
                    <td key={col} className="whitespace-nowrap py-1 pr-3 font-mono text-xs">
                      <span className={cn(changed && 'font-semibold text-[var(--color-diff-modified)]')}>
                        <CellValue value={after[col] ?? null} />
                      </span>
                    </td>
                  )
                })}
              </tr>
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; diff: DataTableDiff }
  | { status: 'error'; message: string }

type Props = {
  tableName: string
  sourceId: string
  targetId: string
  /** Table schema — used to suggest key columns. Null while fetching for unchanged tables. */
  table: Table | null
  tableLoading: boolean
}

const DEFAULT_LIMIT = 10_000

export function DataTablePanel({
  tableName,
  sourceId,
  targetId,
  table,
  tableLoading
}: Props): React.JSX.Element {
  const [keyColumns, setKeyColumns] = React.useState<string[]>([])
  const [limit, setLimit] = React.useState(DEFAULT_LIMIT)
  const [skipKeyInInsert, setSkipKeyInInsert] = React.useState(false)
  const [loadState, setLoadState] = React.useState<LoadState>({ status: 'idle' })
  const [filter, setFilter] = React.useState<RowFilter>({ showAdded: true, showModified: true, showRemoved: true })
  const [sqlOpen, setSqlOpen] = React.useState(false)
  const [sqlModalOpen, setSqlModalOpen] = React.useState(false)
  const [notice, setNotice] = React.useState<{ text: string; kind: 'success' | 'error' } | null>(null)

  // Auto-select primary key when table schema arrives
  React.useEffect(() => {
    if (!table) return
    const pk = table.indexes.find((idx) => idx.kind === 'primary')
    if (pk) setKeyColumns(pk.columns.map((c) => c.columnName))
  }, [table])

  // Reset when table changes
  React.useEffect(() => {
    setLoadState({ status: 'idle' })
    setKeyColumns([])
    setLimit(DEFAULT_LIMIT)
    setSkipKeyInInsert(false)
    setFilter({ showAdded: true, showModified: true, showRemoved: true })
    setSqlOpen(false)
    setSqlModalOpen(false)
  }, [tableName])

  function showNotice(text: string, kind: 'success' | 'error', ms = 3000): void {
    setNotice({ text, kind })
    setTimeout(() => setNotice(null), ms)
  }

  function toggleKey(col: string): void {
    setKeyColumns((prev) =>
      prev.includes(col) ? prev.filter((k) => k !== col) : [...prev, col]
    )
  }

  async function handleLoad(): Promise<void> {
    if (keyColumns.length === 0) return
    setLoadState({ status: 'loading' })
    try {
      const result = await api.data.compare(sourceId, targetId, tableName, keyColumns, limit)
      setLoadState({ status: 'loaded', diff: result })
      setSqlOpen(false)
    } catch (err) {
      setLoadState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  async function handleCopy(): Promise<void> {
    if (loadState.status !== 'loaded') return
    const sql = generateDataSyncSql(loadState.diff, skipKeyInInsert, filter)
    try {
      await navigator.clipboard.writeText(sql)
      showNotice('Copied!', 'success', 2000)
    } catch {
      showNotice('Copy failed', 'error')
    }
  }

  async function handleSave(): Promise<void> {
    if (loadState.status !== 'loaded') return
    const sql = generateDataSyncSql(loadState.diff, skipKeyInInsert, filter)
    try {
      // Reuse script:save IPC — it only uses statements[].sql, so other fields are stubs
      const result = await api.script.save({
        generatedAt: new Date().toISOString(),
        source: { databaseName: tableName },
        target: { databaseName: tableName },
        statements: [{
          id: 'data-sync',
          kind: 'preamble',
          sql,
          tableName,
          destructive: false,
          note: 'data sync'
        }],
        warnings: []
      })
      if (result.path) showNotice(`Saved to ${result.path}`, 'success', 4000)
    } catch (err) {
      showNotice(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  const columns = table?.columns.map((c) => c.name) ?? []

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Config bar — always visible at top */}
      <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-card)] px-6 py-4">
        <div className="flex flex-wrap items-end gap-6">

          {/* Key column picker */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Match key columns
            </span>
            {tableLoading ? (
              <div className="flex items-center gap-2 text-xs text-[var(--color-muted-foreground)]">
                <Loader2 className="size-3.5 animate-spin" />
                Loading columns…
              </div>
            ) : columns.length === 0 ? (
              <span className="text-xs text-[var(--color-muted-foreground)]">No schema info</span>
            ) : (
              // Bounded scrollable container — handles tables with many columns gracefully
              <div className="max-h-28 overflow-y-auto rounded-md border border-[var(--color-border)]/60 bg-[var(--color-muted)]/20 p-2">
                <div className="flex flex-wrap gap-2">
                  {columns.map((col) => (
                    <label
                      key={col}
                      title={keyColumns.includes(col) ? 'Click to deselect as key' : 'Click to use as match key'}
                      className={cn(
                        'flex cursor-pointer items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition-colors',
                        keyColumns.includes(col)
                          ? 'border-[var(--color-diff-modified)] bg-[var(--color-diff-modified-bg)] text-[var(--color-diff-modified)]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-diff-modified)]/50'
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={keyColumns.includes(col)}
                        onChange={() => toggleKey(col)}
                        className="sr-only"
                      />
                      <span className="font-mono">{col}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Row limit */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Row limit
            </span>
            <input
              type="number"
              min={1}
              max={1_000_000}
              value={limit}
              onChange={(e) => setLimit(Math.max(1, Number(e.target.value) || DEFAULT_LIMIT))}
              className="w-28 rounded-md border border-[var(--color-border)] bg-transparent px-2 py-1 text-xs outline-none focus:border-[var(--color-diff-modified)]"
            />
          </div>

          {/* Skip PK in INSERT toggle */}
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              INSERT options
            </span>
            <label className="flex cursor-pointer items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={skipKeyInInsert}
                onChange={(e) => setSkipKeyInInsert(e.target.checked)}
                className="rounded"
              />
              <span>Skip key columns in INSERT</span>
            </label>
            {skipKeyInInsert && (
              <p className="max-w-48 text-[11px] text-[var(--color-muted-foreground)]">
                Key columns omitted from INSERT — DB auto-generates ID. Safe when PK conflicts exist in target.
              </p>
            )}
          </div>

          {/* Load button */}
          <Button
            onClick={handleLoad}
            disabled={keyColumns.length === 0 || tableLoading || loadState.status === 'loading'}
            size="sm"
          >
            {loadState.status === 'loading' ? (
              <>
                <Loader2 className="size-3.5 animate-spin" />
                Loading…
              </>
            ) : (
              <>
                <Play className="size-3.5" />
                Load data diff
              </>
            )}
          </Button>
        </div>

        {keyColumns.length === 0 && !tableLoading && columns.length > 0 && (
          <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">
            Select at least one key column to match rows between databases.
          </p>
        )}
      </div>

      {/* Results */}
      {loadState.status === 'idle' && (
        <div className="flex flex-1 items-center justify-center text-sm text-[var(--color-muted-foreground)]">
          Configure key columns above and click "Load data diff".
        </div>
      )}

      {loadState.status === 'error' && (
        <div className="m-6 flex gap-2 rounded-lg border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/8 px-4 py-3">
          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-destructive)]" />
          <div>
            <p className="text-xs font-medium text-[var(--color-destructive)]">Data fetch failed</p>
            <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-destructive)]/80">
              {loadState.message}
            </pre>
          </div>
        </div>
      )}

      {loadState.status === 'loaded' && (
        <div className="flex flex-1 flex-col overflow-hidden">
          {/* Toolbar */}
          <div className="flex shrink-0 flex-wrap items-center gap-3 border-b border-[var(--color-border)] px-6 py-3">
            <div className="flex flex-1 items-center gap-2">
              {/* "Show:" label + filter chips — click each chip to toggle that row type */}
              {(loadState.diff.added.length > 0 ||
                loadState.diff.removed.length > 0 ||
                loadState.diff.modified.length > 0) && (
                <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">Show:</span>
              )}
              {loadState.diff.added.length > 0 && (
                <label
                  title="Click to toggle added rows"
                  className={cn(
                    'flex cursor-pointer select-none items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-opacity',
                    'bg-[var(--color-diff-added-bg)] text-[var(--color-diff-added)]',
                    !filter.showAdded && 'opacity-40'
                  )}>
                  <input type="checkbox" className="sr-only" checked={filter.showAdded}
                    onChange={(e) => setFilter((f) => ({ ...f, showAdded: e.target.checked }))} />
                  +{loadState.diff.added.length} added
                </label>
              )}
              {loadState.diff.removed.length > 0 && (
                <label
                  title="Click to toggle removed rows"
                  className={cn(
                    'flex cursor-pointer select-none items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-opacity',
                    'bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]',
                    !filter.showRemoved && 'opacity-40'
                  )}>
                  <input type="checkbox" className="sr-only" checked={filter.showRemoved}
                    onChange={(e) => setFilter((f) => ({ ...f, showRemoved: e.target.checked }))} />
                  −{loadState.diff.removed.length} removed
                </label>
              )}
              {loadState.diff.modified.length > 0 && (
                <label
                  title="Click to toggle modified rows"
                  className={cn(
                    'flex cursor-pointer select-none items-center gap-1 rounded-full px-1.5 py-0.5 text-xs font-medium transition-opacity',
                    'bg-[var(--color-diff-modified-bg)] text-[var(--color-diff-modified)]',
                    !filter.showModified && 'opacity-40'
                  )}>
                  <input type="checkbox" className="sr-only" checked={filter.showModified}
                    onChange={(e) => setFilter((f) => ({ ...f, showModified: e.target.checked }))} />
                  ~{loadState.diff.modified.length} modified
                </label>
              )}
              {loadState.diff.added.length === 0 &&
                loadState.diff.removed.length === 0 &&
                loadState.diff.modified.length === 0 && (
                  <span className="text-xs text-[var(--color-muted-foreground)]">Data identical</span>
                )}
              {loadState.diff.capped && (
                <span className="ml-2 flex items-center gap-1 text-xs text-[var(--color-diff-modified)]">
                  <AlertTriangle className="size-3" />
                  Capped at {loadState.diff.limit.toLocaleString()} rows — diff may be incomplete
                </span>
              )}
            </div>

            {notice && (
              <span className={cn(
                'text-xs',
                notice.kind === 'success' ? 'text-[var(--color-diff-added)]' : 'text-[var(--color-destructive)]'
              )}>
                {notice.text}
              </span>
            )}

            {/* Data sync SQL actions — deliberately separate from schema script */}
            <Button variant="outline" size="sm" onClick={handleSave}>
              <Save className="size-3.5" />
              Save data sync .sql
            </Button>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="size-3.5" />
              Copy
            </Button>
          </div>

          {/* Cap warning */}
          {loadState.diff.capped && (
            <div className="shrink-0 border-b border-[var(--color-border)] bg-[var(--color-diff-modified-bg)]/40 px-6 py-2">
              <p className="text-xs text-[var(--color-diff-modified)]">
                ⚠ One or both tables exceeded {loadState.diff.limit.toLocaleString()} rows.
                Results show only the first {loadState.diff.limit.toLocaleString()} rows from each side.
                Increase the row limit and reload for a complete diff.
              </p>
            </div>
          )}

          {/* Row diff table — overflow-y-auto here, table's overflow-x-auto handles horizontal */}
          <div className="flex-1 overflow-y-auto p-6">
            <RowDiffTable diff={loadState.diff} filter={filter} />
          </div>

          {/* Generated data sync SQL — collapsible inline or expandable to full modal */}
          {(loadState.diff.added.length > 0 ||
            loadState.diff.removed.length > 0 ||
            loadState.diff.modified.length > 0) && (
            <div className="shrink-0 border-t border-[var(--color-border)]">
              <div className="flex items-center">
                <button
                  onClick={() => setSqlOpen((v) => !v)}
                  className="flex flex-1 items-center gap-2 px-6 py-2.5 text-left text-xs font-semibold transition-colors hover:bg-[var(--color-accent)]/40"
                >
                  {sqlOpen ? (
                    <ChevronDown className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                  ) : (
                    <ChevronRight className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                  )}
                  Data sync SQL
                  <span className="ml-1 font-normal text-[var(--color-muted-foreground)]">
                    (INSERT / UPDATE / DELETE — separate from schema migration)
                  </span>
                </button>
                <button
                  onClick={() => setSqlModalOpen(true)}
                  title="Expand SQL in full-screen view"
                  className="mr-4 shrink-0 rounded-md p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)]/60 hover:text-[var(--color-foreground)]"
                >
                  <Maximize2 className="size-3.5" />
                </button>
              </div>
              {sqlOpen && (
                <div className="max-h-72 overflow-auto border-t border-[var(--color-border)] bg-[var(--color-card)]">
                  <SqlCode code={generateDataSyncSql(loadState.diff, skipKeyInInsert, filter)} />
                </div>
              )}
            </div>
          )}

          {/* SQL full-screen modal */}
          {sqlModalOpen && loadState.status === 'loaded' && (
            <div className="fixed inset-0 z-50 flex flex-col bg-[var(--color-background)]">
              {/* Modal header */}
              <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-6 py-3">
                <div className="flex flex-1 items-center gap-2">
                  <span className="text-sm font-semibold">Data sync SQL</span>
                  <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                    {tableName}
                  </span>
                  <span className="rounded-full bg-[var(--color-muted)] px-1.5 py-0.5 text-[11px] text-[var(--color-muted-foreground)]">
                    INSERT / UPDATE / DELETE — separate from schema migration
                  </span>
                </div>
                {notice && (
                  <span className={cn(
                    'text-xs',
                    notice.kind === 'success' ? 'text-[var(--color-diff-added)]' : 'text-[var(--color-destructive)]'
                  )}>
                    {notice.text}
                  </span>
                )}
                <Button variant="outline" size="sm" onClick={handleSave}>
                  <Save className="size-3.5" />
                  Save .sql
                </Button>
                <Button variant="outline" size="sm" onClick={handleCopy}>
                  <Copy className="size-3.5" />
                  Copy
                </Button>
                <button
                  onClick={() => setSqlModalOpen(false)}
                  title="Close"
                  className="ml-1 rounded-md p-1.5 text-[var(--color-muted-foreground)] transition-colors hover:bg-[var(--color-accent)]/60 hover:text-[var(--color-foreground)]"
                >
                  <X className="size-4" />
                </button>
              </div>

              {/* Modal body — flex-1 bounds height; overflow-auto owns both scroll axes so
                  the horizontal scrollbar stays pinned to the visible bottom edge */}
              <div className="flex-1 overflow-auto">
                <SqlCode code={generateDataSyncSql(loadState.diff, skipKeyInInsert, filter)} />
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
