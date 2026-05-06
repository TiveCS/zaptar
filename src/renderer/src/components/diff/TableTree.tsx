import { useVirtualizer } from '@tanstack/react-virtual'
import { ChevronDown, ChevronRight, FileCode2, Minus, Plus, RefreshCw, Search } from 'lucide-react'
import * as React from 'react'

import type { SchemaDiff } from '@shared/types'
import { useShortcut } from '@renderer/hooks/useShortcut'
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

// ── Virtual row types ────────────────────────────────────────────────────────

type VirtualRow =
  | { kind: 'header'; group: Group; total: number }
  | { kind: 'item'; group: Group; name: string }

const ROW_HEIGHT = 28 // px — header and item rows are the same fixed height

export function TableTree({
  diff,
  selectedTable,
  onSelect,
  view,
  onViewChange
}: Props): React.JSX.Element {
  const [search, setSearch] = React.useState('')
  const searchRef = React.useRef<HTMLInputElement>(null)
  const scrollRef = React.useRef<HTMLDivElement>(null)

  // Collapse state per group — unchanged collapsed by default
  const [collapsed, setCollapsed] = React.useState<Record<Group, boolean>>({
    added: false,
    modified: false,
    removed: false,
    unchanged: true
  })

  const toggleCollapse = (group: Group): void =>
    setCollapsed((prev) => ({ ...prev, [group]: !prev[group] }))

  // Ctrl+P — focus & select the search input
  useShortcut([
    {
      key: 'p',
      ctrl: true,
      handler: () => {
        searchRef.current?.focus()
        searchRef.current?.select()
      }
    }
  ])

  const totalChanges =
    diff.addedTables.length + diff.modifiedTables.length + diff.removedTables.length

  const q = search.trim().toLowerCase()
  const filter = (names: string[]): string[] =>
    q ? names.filter((n) => n.toLowerCase().includes(q)) : names

  // Build flat list of virtual rows: header → items (if not collapsed)
  const rows = React.useMemo<VirtualRow[]>(() => {
    const groups: { group: Group; names: string[] }[] = [
      { group: 'added', names: filter(diff.addedTables.map((t) => t.name)) },
      { group: 'modified', names: filter(diff.modifiedTables.map((t) => t.name)) },
      { group: 'removed', names: filter(diff.removedTables.map((t) => t.name)) },
      { group: 'unchanged', names: filter(diff.unchangedTables) }
    ]

    const out: VirtualRow[] = []
    for (const { group, names } of groups) {
      if (names.length === 0) continue
      out.push({ kind: 'header', group, total: names.length })
      if (!collapsed[group]) {
        for (const name of names) {
          out.push({ kind: 'item', group, name })
        }
      }
    }
    return out
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diff, q, collapsed])

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 8
  })

  const handleSelect = (name: string): void => {
    onViewChange('diff')
    onSelect(name)
  }

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

      {/* Search */}
      <div className="border-b border-[var(--color-border)] px-3 py-2">
        <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-2 py-1">
          <Search className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
          <input
            ref={searchRef}
            type="text"
            placeholder="Search tables…  (Ctrl+P)"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--color-muted-foreground)]/60"
          />
        </div>
      </div>

      {/* Virtual tree */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div
          style={{ height: virtualizer.getTotalSize(), position: 'relative' }}
        >
          {virtualizer.getVirtualItems().map((vItem) => {
            const row = rows[vItem.index]

            if (row.kind === 'header') {
              const { label, color, icon: Icon } = GROUP_META[row.group]
              const isOpen = !collapsed[row.group]
              return (
                <div
                  key={vItem.key}
                  style={{
                    position: 'absolute',
                    top: vItem.start,
                    left: 0,
                    right: 0,
                    height: vItem.size
                  }}
                >
                  <button
                    onClick={() => toggleCollapse(row.group)}
                    className="flex w-full items-center gap-1.5 px-3 py-1.5 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                  >
                    {isOpen ? (
                      <ChevronDown className="size-3.5 shrink-0" />
                    ) : (
                      <ChevronRight className="size-3.5 shrink-0" />
                    )}
                    <span className={cn(color)}>{label}</span>
                    <span className="ml-auto tabular-nums">{row.total}</span>
                  </button>
                </div>
              )
            }

            // kind === 'item'
            const { color, icon: Icon } = GROUP_META[row.group]
            const isSelected = selectedTable === row.name
            return (
              <div
                key={vItem.key}
                style={{
                  position: 'absolute',
                  top: vItem.start,
                  left: 0,
                  right: 0,
                  height: vItem.size
                }}
              >
                <button
                  onClick={() => handleSelect(row.name)}
                  className={cn(
                    'flex w-full items-center gap-2 px-5 py-1 text-left text-sm transition-colors',
                    isSelected
                      ? 'bg-[var(--color-accent)] font-medium'
                      : 'hover:bg-[var(--color-accent)]/60'
                  )}
                >
                  <Icon
                    className={cn(
                      'size-3.5 shrink-0',
                      color,
                      isSelected ? 'opacity-100' : 'opacity-70'
                    )}
                  />
                  <span className="truncate font-mono text-xs">{row.name}</span>
                </button>
              </div>
            )
          })}
        </div>
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
