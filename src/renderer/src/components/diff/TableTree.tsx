import { ChevronDown, ChevronRight, FileCode2, Minus, Plus, RefreshCw } from 'lucide-react'
import * as React from 'react'

import type { SchemaDiff } from '@shared/types'
import { cn } from '@renderer/lib/utils'

type Group = 'added' | 'modified' | 'removed' | 'unchanged'

type Props = {
  diff: SchemaDiff
  selectedTable: string | null
  onSelect: (name: string) => void
  view: 'diff' | 'script'
  onViewChange: (v: 'diff' | 'script') => void
}

const GROUP_META: Record<Group, { label: string; color: string; icon: React.ElementType }> = {
  added: {
    label: 'Added',
    color: 'text-[var(--color-diff-added)]',
    icon: Plus
  },
  modified: {
    label: 'Modified',
    color: 'text-[var(--color-diff-modified)]',
    icon: RefreshCw
  },
  removed: {
    label: 'Removed',
    color: 'text-[var(--color-diff-removed)]',
    icon: Minus
  },
  unchanged: {
    label: 'Unchanged',
    color: 'text-[var(--color-muted-foreground)]',
    icon: FileCode2
  }
}

function TableGroup({
  group,
  names,
  selected,
  onSelect
}: {
  group: Group
  names: string[]
  selected: string | null
  onSelect: (n: string) => void
}): React.JSX.Element | null {
  const [open, setOpen] = React.useState(group !== 'unchanged')
  const { label, color, icon: Icon } = GROUP_META[group]
  if (names.length === 0) return null

  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
      >
        {open ? (
          <ChevronDown className="size-3.5 shrink-0" />
        ) : (
          <ChevronRight className="size-3.5 shrink-0" />
        )}
        <span className={cn(color)}>{label}</span>
        <span className="ml-auto tabular-nums">{names.length}</span>
      </button>

      {open && (
        <div>
          {names.map((name) => (
            <button
              key={name}
              onClick={() => onSelect(name)}
              className={cn(
                'flex w-full items-center gap-2 px-5 py-1 text-left text-sm transition-colors',
                selected === name
                  ? 'bg-[var(--color-accent)] font-medium'
                  : 'hover:bg-[var(--color-accent)]/60'
              )}
            >
              <Icon
                className={cn(
                  'size-3.5 shrink-0',
                  color,
                  selected === name ? 'opacity-100' : 'opacity-70'
                )}
              />
              <span className="truncate font-mono text-xs">{name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TableTree({
  diff,
  selectedTable,
  onSelect,
  view,
  onViewChange
}: Props): React.JSX.Element {
  const totalChanges =
    diff.addedTables.length + diff.modifiedTables.length + diff.removedTables.length

  return (
    <aside className="flex h-full flex-col overflow-hidden border-r border-[var(--color-border)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
        <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Tables
        </span>
        {totalChanges > 0 && (
          <span className="rounded-full bg-[var(--color-diff-modified-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-diff-modified)]">
            {totalChanges}
          </span>
        )}
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto py-1">
        <TableGroup
          group="added"
          names={diff.addedTables.map((t) => t.name)}
          selected={selectedTable}
          onSelect={(n) => {
            onViewChange('diff')
            onSelect(n)
          }}
        />
        <TableGroup
          group="modified"
          names={diff.modifiedTables.map((t) => t.name)}
          selected={selectedTable}
          onSelect={(n) => {
            onViewChange('diff')
            onSelect(n)
          }}
        />
        <TableGroup
          group="removed"
          names={diff.removedTables.map((t) => t.name)}
          selected={selectedTable}
          onSelect={(n) => {
            onViewChange('diff')
            onSelect(n)
          }}
        />
        <TableGroup
          group="unchanged"
          names={diff.unchangedTables}
          selected={selectedTable}
          onSelect={(n) => {
            onViewChange('diff')
            onSelect(n)
          }}
        />
      </div>

      {/* Bottom: Script toggle */}
      <div className="border-t border-[var(--color-border)] p-2">
        <button
          onClick={() => onViewChange(view === 'script' ? 'diff' : 'script')}
          className={cn(
            'flex w-full items-center gap-2 rounded-md px-3 py-2 text-left text-sm transition-colors',
            view === 'script'
              ? 'bg-[var(--color-accent)] font-medium'
              : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)] hover:bg-[var(--color-accent)]/60'
          )}
        >
          <FileCode2 className="size-4 shrink-0" />
          Migration Script
        </button>
      </div>
    </aside>
  )
}
