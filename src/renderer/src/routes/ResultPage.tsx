import { ArrowRight, GitCompare } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@renderer/components/ui/button'
import { DiffPanel } from '@renderer/components/diff/DiffPanel'
import { TableTree } from '@renderer/components/diff/TableTree'
import { ScriptPreview } from '@renderer/components/script/ScriptPreview'
import { useShortcut } from '@renderer/hooks/useShortcut'
import { useStore } from '@renderer/store'
import { cn } from '@renderer/lib/utils'

function SummaryChip({
  label,
  count,
  color
}: {
  label: string
  count: number
  color: string
}): React.JSX.Element | null {
  if (count === 0) return null
  return (
    <span className={cn('rounded-full px-2 py-0.5 text-xs font-medium', color)}>
      {count} {label}
    </span>
  )
}

export function ResultPage(): React.JSX.Element {
  const navigate = useNavigate()
  const { diff, script, selectedTable, setSelectedTable, sourceId } = useStore()
  const [view, setView] = React.useState<'diff' | 'script'>('diff')

  function handleSelect(name: string): void {
    setSelectedTable(name)
    setView('diff')
  }

  // Flat ordered list matching tree order for keyboard navigation
  const allTables = diff
    ? [
        ...diff.addedTables.map((t) => t.name),
        ...diff.modifiedTables.map((t) => t.name),
        ...diff.removedTables.map((t) => t.name),
        ...diff.unchangedTables
      ]
    : []

  useShortcut([
    // Ctrl+ArrowDown — next table
    {
      key: 'ArrowDown',
      ctrl: true,
      handler: () => {
        if (allTables.length === 0) return
        const idx = selectedTable ? allTables.indexOf(selectedTable) : -1
        const next = allTables[Math.min(idx + 1, allTables.length - 1)]
        if (next) handleSelect(next)
      }
    },
    // Ctrl+ArrowUp — previous table
    {
      key: 'ArrowUp',
      ctrl: true,
      handler: () => {
        if (allTables.length === 0) return
        const idx = selectedTable ? allTables.indexOf(selectedTable) : allTables.length
        const prev = allTables[Math.max(idx - 1, 0)]
        if (prev) handleSelect(prev)
      }
    },
    // Ctrl+` — toggle diff / script view
    {
      key: '`',
      ctrl: true,
      handler: () => setView((v) => (v === 'script' ? 'diff' : 'script'))
    }
  ])

  // ── Empty state ────────────────────────────────────────────────────────────
  if (!diff || !script) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
        <div className="rounded-full bg-[var(--color-muted)] p-4">
          <GitCompare className="size-8 text-[var(--color-muted-foreground)]" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">No comparison yet</h2>
          <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
            Run a comparison on the Compare page to see results here.
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate('/compare')}>
          Go to Compare
        </Button>
      </div>
    )
  }

  const totalChanges =
    diff.addedTables.length + diff.modifiedTables.length + diff.removedTables.length

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* ── Summary header bar ──────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2">
        {/* Source → Target */}
        <span className="font-mono text-sm font-semibold">{diff.source.databaseName}</span>
        <ArrowRight className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
        <span className="font-mono text-sm font-semibold">{diff.target.databaseName}</span>

        <div className="mx-2 h-4 w-px bg-[var(--color-border)]" />

        {/* Change counts */}
        {totalChanges === 0 ? (
          <span className="text-xs text-[var(--color-muted-foreground)]">Schemas identical</span>
        ) : (
          <div className="flex items-center gap-1.5">
            <SummaryChip
              label={`added`}
              count={diff.addedTables.length}
              color="bg-[var(--color-diff-added-bg)] text-[var(--color-diff-added)]"
            />
            <SummaryChip
              label={`modified`}
              count={diff.modifiedTables.length}
              color="bg-[var(--color-diff-modified-bg)] text-[var(--color-diff-modified)]"
            />
            <SummaryChip
              label={`removed`}
              count={diff.removedTables.length}
              color="bg-[var(--color-destructive)]/10 text-[var(--color-destructive)]"
            />
            <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
              · {diff.unchangedTables.length} unchanged
            </span>
          </div>
        )}

        <div className="ml-auto">
          <Button variant="outline" size="sm" onClick={() => navigate('/compare')}>
            New compare
          </Button>
        </div>
      </div>

      {/* ── Two-pane body ────────────────────────────────────────────────── */}
      <div
        className="grid min-h-0 flex-1 overflow-hidden"
        style={{ gridTemplateColumns: '260px 1fr' }}
      >
        {/* Left: table tree */}
        <TableTree
          diff={diff}
          selectedTable={selectedTable}
          onSelect={handleSelect}
          view={view}
          onViewChange={setView}
        />

        {/* Right: content */}
        <div className="overflow-hidden">
          {view === 'script' ? (
            <ScriptPreview script={script} />
          ) : selectedTable ? (
            <DiffPanel diff={diff} tableName={selectedTable} sourceId={sourceId ?? ''} />
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
              <div className="rounded-full bg-[var(--color-muted)] p-3">
                <GitCompare className="size-6 text-[var(--color-muted-foreground)]" />
              </div>
              {totalChanges === 0 ? (
                <div>
                  <p className="font-medium">Schemas are identical</p>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    No differences found between the two databases.
                  </p>
                </div>
              ) : (
                <div>
                  <p className="font-medium">
                    {totalChanges} change{totalChanges !== 1 ? 's' : ''} found
                  </p>
                  <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
                    Select a table on the left, or view the{' '}
                    <button
                      className="underline hover:no-underline"
                      onClick={() => setView('script')}
                    >
                      Migration Script
                    </button>
                    .
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
