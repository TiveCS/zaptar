import { AlertCircle, ArrowRight, ChevronDown, ChevronUp, Loader2, Play } from 'lucide-react'
import * as React from 'react'
import { useNavigate } from 'react-router-dom'

import { Button } from '@renderer/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { api } from '@renderer/lib/api'
import { useStore } from '@renderer/store'

type TableLoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; tables: string[] }
  | { status: 'error'; message: string }

function ConnectionPicker({
  label,
  sublabel,
  value,
  onChange,
  excludeId
}: {
  label: string
  sublabel: string
  value: string | null
  onChange: (id: string) => void
  excludeId?: string | null
}): React.JSX.Element {
  const connections = useStore((s) => s.connections)
  const available = connections.filter((c) => c.id !== excludeId)

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] p-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
          {label}
        </p>
        <p className="mt-0.5 text-xs text-[var(--color-muted-foreground)]">{sublabel}</p>
      </div>
      <Select value={value ?? ''} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue placeholder="Select a connection…" />
        </SelectTrigger>
        <SelectContent>
          {available.length === 0 ? (
            <div className="px-2 py-3 text-center text-xs text-[var(--color-muted-foreground)]">
              No connections saved
            </div>
          ) : (
            available.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span className="font-medium">{c.label}</span>
                <span className="ml-1.5 text-[var(--color-muted-foreground)]">
                  {c.username}@{c.host}/{c.database}
                </span>
              </SelectItem>
            ))
          )}
        </SelectContent>
      </Select>
      {value && (
        <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
          {connections.find((c) => c.id === value)?.host}:
          {connections.find((c) => c.id === value)?.port}
        </p>
      )}
    </div>
  )
}

function TableCheckboxList({
  state,
  selected,
  onToggle,
  onSelectAll,
  onClearAll
}: {
  state: TableLoadState
  selected: Set<string>
  onToggle: (name: string) => void
  onSelectAll: (names: string[]) => void
  onClearAll: () => void
}): React.JSX.Element {
  const [collapsed, setCollapsed] = React.useState(false)

  if (state.status === 'idle') return <></>

  if (state.status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[var(--color-border)] px-4 py-6 text-sm text-[var(--color-muted-foreground)]">
        <Loader2 className="size-4 animate-spin" />
        Loading tables…
      </div>
    )
  }

  if (state.status === 'error') {
    return (
      <div className="flex gap-2 rounded-lg border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/8 px-4 py-3">
        <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-destructive)]" />
        <div>
          <p className="text-xs font-medium text-[var(--color-destructive)]">
            Could not load tables
          </p>
          <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-destructive)]/80">
            {state.message}
          </pre>
        </div>
      </div>
    )
  }

  const tables = state.tables
  const allSelected = tables.every((t) => selected.has(t))

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)]">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--color-border)] px-4 py-2">
        <button
          onClick={() => setCollapsed((v) => !v)}
          className="flex items-center gap-1.5 text-sm font-medium"
        >
          {collapsed ? (
            <ChevronDown className="size-4 text-[var(--color-muted-foreground)]" />
          ) : (
            <ChevronUp className="size-4 text-[var(--color-muted-foreground)]" />
          )}
          Tables
          <span className="ml-1 text-xs text-[var(--color-muted-foreground)]">
            ({selected.size}/{tables.length} selected)
          </span>
        </button>
        <div className="flex gap-2 text-xs">
          <button
            onClick={() => onSelectAll(tables)}
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            All
          </button>
          <span className="text-[var(--color-border)]">|</span>
          <button
            onClick={onClearAll}
            className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
          >
            None
          </button>
        </div>
      </div>

      {/* Table list */}
      {!collapsed && (
        <div className="max-h-64 overflow-y-auto p-2">
          {tables.length === 0 ? (
            <p className="py-4 text-center text-xs text-[var(--color-muted-foreground)]">
              No tables found in this database
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-0.5 sm:grid-cols-3">
              {tables.map((name) => (
                <label
                  key={name}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-[var(--color-accent)]"
                >
                  <input
                    type="checkbox"
                    checked={selected.has(name)}
                    onChange={() => onToggle(name)}
                    className="rounded"
                  />
                  <span className="truncate font-mono text-xs">{name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Select-all checkbox in header (hidden, controlled via buttons above) */}
      <input
        type="checkbox"
        className="sr-only"
        checked={allSelected}
        onChange={() => (allSelected ? onClearAll() : onSelectAll(tables))}
        aria-hidden
      />
    </div>
  )
}

export function ComparePage(): React.JSX.Element {
  const navigate = useNavigate()
  const {
    connectionsLoaded,
    loadConnections,
    sourceId,
    targetId,
    selectedTables,
    compareStatus,
    compareError,
    setSourceId,
    setTargetId,
    toggleTable,
    resetTables,
    runCompare
  } = useStore()

  const [tableState, setTableState] = React.useState<TableLoadState>({ status: 'idle' })

  // Load connections on mount if not already loaded
  React.useEffect(() => {
    if (!connectionsLoaded) loadConnections()
  }, [connectionsLoaded, loadConnections])

  // When source changes, load its tables
  React.useEffect(() => {
    if (!sourceId) return

    let cancelled = false
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTableState({ status: 'loading' })
    resetTables()

    api.compare
      .listTables(sourceId)
      .then(({ tables }) => {
        if (cancelled) return
        setTableState({ status: 'ok', tables })
        useStore.setState({ selectedTables: new Set(tables) })
      })
      .catch((err) => {
        if (cancelled) return
        setTableState({
          status: 'error',
          message: err instanceof Error ? err.message : String(err)
        })
      })

    return () => {
      cancelled = true
      setTableState({ status: 'idle' })
    }
  }, [sourceId, resetTables])

  async function handleRunCompare(): Promise<void> {
    await runCompare()
    // Navigate to result only on success
    if (useStore.getState().compareStatus === 'success') {
      navigate('/result')
    }
  }

  const canRun = !!sourceId && !!targetId && sourceId !== targetId && compareStatus !== 'loading'

  return (
    <div className="mx-auto max-w-3xl px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Compare schemas</h1>
        <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
          Pick the newer database (source) and the older database (target). The migration script
          will bring target up to source.
        </p>
      </div>

      {/* Connection pickers */}
      <div className="grid grid-cols-[1fr_auto_1fr] items-start gap-4">
        <ConnectionPicker
          label="Source"
          sublabel="The newer schema"
          value={sourceId}
          onChange={(id) => {
            setSourceId(id)
          }}
          excludeId={targetId}
        />

        <div className="mt-8 flex items-center justify-center">
          <ArrowRight className="size-5 text-[var(--color-muted-foreground)]" />
        </div>

        <ConnectionPicker
          label="Target"
          sublabel="Will receive the migration"
          value={targetId}
          onChange={setTargetId}
          excludeId={sourceId}
        />
      </div>

      {/* Same-connection warning */}
      {sourceId && targetId && sourceId === targetId && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--color-destructive)]">
          <AlertCircle className="size-3.5" />
          Source and target must be different connections.
        </p>
      )}

      {/* Table selection */}
      {sourceId && sourceId !== targetId && (
        <div className="mt-6">
          <TableCheckboxList
            state={tableState}
            selected={selectedTables}
            onToggle={toggleTable}
            onSelectAll={(names) => useStore.setState({ selectedTables: new Set(names) })}
            onClearAll={resetTables}
          />
        </div>
      )}

      {/* Compare error */}
      {compareStatus === 'error' && compareError && (
        <div className="mt-4 flex gap-2 rounded-lg border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/8 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-destructive)]" />
          <div>
            <p className="text-xs font-medium text-[var(--color-destructive)]">Compare failed</p>
            <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-destructive)]/80">
              {compareError}
            </pre>
          </div>
        </div>
      )}

      {/* Run button */}
      <div className="mt-6 flex justify-end">
        <Button onClick={handleRunCompare} disabled={!canRun}>
          {compareStatus === 'loading' ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Comparing…
            </>
          ) : (
            <>
              <Play className="size-4" />
              Run compare
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
