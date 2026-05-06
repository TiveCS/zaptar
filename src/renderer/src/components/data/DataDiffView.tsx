import { FileCode2, Minus, Plus, RefreshCw, Search } from 'lucide-react'
import * as React from 'react'

import type { SchemaDiff } from '@shared/types'
import type { Table } from '@shared/types/schema'
import { DataTablePanel } from './DataTablePanel'
import { api } from '@renderer/lib/api'
import { cn } from '@renderer/lib/utils'

type Props = {
  diff: SchemaDiff
  sourceId: string
  targetId: string
}

type TableEntry = {
  name: string
  kind: 'added' | 'modified' | 'removed' | 'unchanged'
}

const KIND_META = {
  added:     { label: 'Added',     color: 'text-[var(--color-diff-added)]',      icon: Plus },
  modified:  { label: 'Modified',  color: 'text-[var(--color-diff-modified)]',   icon: RefreshCw },
  removed:   { label: 'Removed',   color: 'text-[var(--color-diff-removed)]',    icon: Minus },
  unchanged: { label: 'Unchanged', color: 'text-[var(--color-muted-foreground)]', icon: FileCode2 }
} as const

export function DataDiffView({ diff, sourceId, targetId }: Props): React.JSX.Element {
  const [selectedTable, setSelectedTable] = React.useState<string | null>(null)
  const [search, setSearch] = React.useState('')

  // Schema for the selected table (for key column picker)
  const [tableSchema, setTableSchema] = React.useState<Table | null>(null)
  const [tableSchemaLoading, setTableSchemaLoading] = React.useState(false)

  // Build flat ordered list of all compared tables
  const allTables: TableEntry[] = [
    ...diff.addedTables.map((t) => ({ name: t.name, kind: 'added' as const })),
    ...diff.modifiedTables.map((t) => ({ name: t.name, kind: 'modified' as const })),
    ...diff.removedTables.map((t) => ({ name: t.name, kind: 'removed' as const })),
    ...diff.unchangedTables.map((name) => ({ name, kind: 'unchanged' as const }))
  ]

  const q = search.trim().toLowerCase()
  const tables = q ? allTables.filter((t) => t.name.toLowerCase().includes(q)) : allTables

  // When user selects a table, resolve its schema for the key picker
  React.useEffect(() => {
    if (!selectedTable) return

    setTableSchema(null)

    const addedTable = diff.addedTables.find((t) => t.name === selectedTable)
    const removedTable = diff.removedTables.find((t) => t.name === selectedTable)
    const modifiedTable = diff.modifiedTables.find((t) => t.name === selectedTable)

    if (addedTable) {
      // addedTable IS a Table object
      setTableSchema(addedTable)
      setTableSchemaLoading(false)
      return
    }
    if (removedTable) {
      setTableSchema(removedTable)
      setTableSchemaLoading(false)
      return
    }
    if (modifiedTable) {
      setTableSchema(modifiedTable.sourceTable)
      setTableSchemaLoading(false)
      return
    }

    // Unchanged table — fetch on demand (same pattern as DiffPanel)
    setTableSchemaLoading(true)
    api.compare
      .table(sourceId, selectedTable)
      .then((t) => setTableSchema(t))
      .catch(() => setTableSchema(null))
      .finally(() => setTableSchemaLoading(false))
  }, [selectedTable, diff, sourceId])

  return (
    <div className="grid min-h-0 flex-1 overflow-hidden" style={{ gridTemplateColumns: '220px 1fr' }}>
      {/* Left: table list */}
      <aside className="flex flex-col overflow-hidden border-r border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] px-3 py-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Select table
          </span>
        </div>

        {/* Search */}
        <div className="border-b border-[var(--color-border)] px-3 py-2">
          <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-2 py-1">
            <Search className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
            <input
              type="text"
              placeholder="Search tables…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--color-muted-foreground)]/60"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-1">
          {tables.length === 0 && (
            <p className="px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)]">
              No tables match
            </p>
          )}
          {tables.map(({ name, kind }) => {
            const { color, icon: Icon } = KIND_META[kind]
            return (
              <button
                key={name}
                onClick={() => setSelectedTable(name)}
                className={cn(
                  'flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors',
                  selectedTable === name
                    ? 'bg-[var(--color-accent)] font-medium'
                    : 'hover:bg-[var(--color-accent)]/60'
                )}
              >
                <Icon className={cn('size-3.5 shrink-0 opacity-70', color)} />
                <span className="truncate font-mono text-xs">{name}</span>
              </button>
            )
          })}
        </div>
      </aside>

      {/* Right: data diff panel */}
      <div className="overflow-hidden">
        {selectedTable ? (
          <DataTablePanel
            key={selectedTable}
            tableName={selectedTable}
            sourceId={sourceId}
            targetId={targetId}
            table={tableSchema}
            tableLoading={tableSchemaLoading}
          />
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
            Select a table on the left to compare its data.
          </div>
        )}
      </div>
    </div>
  )
}
