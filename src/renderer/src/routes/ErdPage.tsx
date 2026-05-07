import { AlertCircle, Loader2, Play, Search, Workflow } from 'lucide-react'
import * as React from 'react'

import type { Schema } from '@shared/types/schema'
import { Button } from '@renderer/components/ui/button'
import { ErdCanvas } from '@renderer/components/erd/ErdCanvas'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@renderer/components/ui/select'
import { api } from '@renderer/lib/api'
import { useStore } from '@renderer/store'
import { cn } from '@renderer/lib/utils'

type LoadState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'loaded'; schema: Schema }
  | { status: 'error'; message: string }

/**
 * ERD viewer page.
 *
 * Layout:
 *  - Header bar: connection picker + Load button + table count badge
 *  - Body: left sidebar (table filter) + right canvas (React Flow)
 *
 * The Schema fetched here is independent of any compare run — this is a
 * read-only exploration tool, not a migration workflow. We do not store the
 * schema in the global compare store; it lives in local component state so a
 * subsequent comparison run doesn't perturb the canvas.
 */
export function ErdPage(): React.JSX.Element {
  const { connections, connectionsLoaded, loadConnections } = useStore()
  const [connectionId, setConnectionId] = React.useState<string | null>(null)
  const [loadState, setLoadState] = React.useState<LoadState>({ status: 'idle' })
  const [selectedTables, setSelectedTables] = React.useState<Set<string>>(new Set())
  const [search, setSearch] = React.useState('')

  // Track latest in-flight introspect so a stale response cannot overwrite a
  // newer one if the user changes connection mid-fetch.
  const requestIdRef = React.useRef(0)

  React.useEffect(() => {
    if (!connectionsLoaded) loadConnections()
  }, [connectionsLoaded, loadConnections])

  async function handleLoad(): Promise<void> {
    if (!connectionId) return
    const myId = ++requestIdRef.current
    setLoadState({ status: 'loading' })
    try {
      const schema = await api.schema.introspect(connectionId)
      if (myId !== requestIdRef.current) return
      setLoadState({ status: 'loaded', schema })
      setSelectedTables(new Set(schema.tables.map((t) => t.name)))
    } catch (err) {
      if (myId !== requestIdRef.current) return
      setLoadState({
        status: 'error',
        message: err instanceof Error ? err.message : String(err)
      })
    }
  }

  function toggleTable(name: string): void {
    setSelectedTables((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const tables = loadState.status === 'loaded' ? loadState.schema.tables : []
  const q = search.trim().toLowerCase()
  const visibleTables = q ? tables.filter((t) => t.name.toLowerCase().includes(q)) : tables
  const allVisibleSelected = visibleTables.every((t) => selectedTables.has(t.name))

  return (
    <div className="flex h-full flex-col">
      {/* ── Header bar ────────────────────────────────────────────────── */}
      <div className="flex shrink-0 items-center gap-3 border-b border-[var(--color-border)] bg-[var(--color-card)] px-4 py-2">
        <Workflow className="size-4 text-[var(--color-muted-foreground)]" />
        <span className="text-sm font-semibold">ERD viewer</span>

        <div className="mx-2 h-4 w-px bg-[var(--color-border)]" />

        <div className="min-w-64">
          <Select value={connectionId ?? ''} onValueChange={(v) => setConnectionId(v)}>
            <SelectTrigger>
              <SelectValue placeholder="Pick a connection…" />
            </SelectTrigger>
            <SelectContent>
              {connections.length === 0 ? (
                <div className="px-2 py-3 text-center text-xs text-[var(--color-muted-foreground)]">
                  No connections saved
                </div>
              ) : (
                connections.map((c) => (
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
        </div>

        <Button
          size="sm"
          onClick={handleLoad}
          disabled={!connectionId || loadState.status === 'loading'}
        >
          {loadState.status === 'loading' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Loading…
            </>
          ) : (
            <>
              <Play className="size-3.5" />
              Load schema
            </>
          )}
        </Button>

        {loadState.status === 'loaded' && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {loadState.schema.databaseName} · {loadState.schema.tables.length} table
            {loadState.schema.tables.length !== 1 ? 's' : ''} · {selectedTables.size} shown
          </span>
        )}
      </div>

      {/* ── Body ──────────────────────────────────────────────────────── */}
      {loadState.status === 'idle' && (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
          <div className="rounded-full bg-[var(--color-muted)] p-3">
            <Workflow className="size-6 text-[var(--color-muted-foreground)]" />
          </div>
          <div>
            <p className="font-medium">Visualize your database</p>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Pick a connection above and click Load schema to render the ERD.
            </p>
          </div>
        </div>
      )}

      {loadState.status === 'error' && (
        <div className="m-6 flex gap-2 rounded-lg border border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/8 px-4 py-3">
          <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-destructive)]" />
          <div>
            <p className="text-xs font-medium text-[var(--color-destructive)]">Failed to load schema</p>
            <pre className="mt-1 whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-destructive)]/80">
              {loadState.message}
            </pre>
          </div>
        </div>
      )}

      {loadState.status === 'loaded' && (
        <div
          className="grid min-h-0 flex-1 overflow-hidden"
          style={{ gridTemplateColumns: '240px 1fr' }}
        >
          {/* Left sidebar — table filter */}
          <aside className="flex flex-col overflow-hidden border-r border-[var(--color-border)]">
            <div className="flex shrink-0 items-center justify-between border-b border-[var(--color-border)] px-3 py-2">
              <span className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
                Tables
              </span>
              <div className="flex gap-2 text-xs">
                <button
                  onClick={() =>
                    setSelectedTables(
                      (prev) => new Set([...prev, ...visibleTables.map((t) => t.name)])
                    )
                  }
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  All
                </button>
                <span className="text-[var(--color-border)]">|</span>
                <button
                  onClick={() => {
                    setSelectedTables((prev) => {
                      const next = new Set(prev)
                      for (const t of visibleTables) next.delete(t.name)
                      return next
                    })
                  }}
                  className="text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]"
                >
                  None
                </button>
              </div>
            </div>

            {/* Search */}
            <div className="shrink-0 border-b border-[var(--color-border)] px-3 py-2">
              <div className="flex items-center gap-2 rounded-md border border-[var(--color-border)] bg-[var(--color-muted)]/40 px-2 py-1">
                <Search className="size-3.5 shrink-0 text-[var(--color-muted-foreground)]" />
                <input
                  type="text"
                  placeholder="Filter tables…"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full bg-transparent text-xs outline-none placeholder:text-[var(--color-muted-foreground)]/60"
                />
                {search && (
                  <span className="shrink-0 text-xs text-[var(--color-muted-foreground)]">
                    {visibleTables.length}/{tables.length}
                  </span>
                )}
              </div>
            </div>

            {/* Table list */}
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {visibleTables.length === 0 ? (
                <p className="px-3 py-4 text-center text-xs text-[var(--color-muted-foreground)]">
                  {q ? 'No tables match' : 'No tables'}
                </p>
              ) : (
                visibleTables.map((t) => (
                  <label
                    key={t.name}
                    className={cn(
                      'flex cursor-pointer items-center gap-2 px-3 py-1 text-sm transition-colors hover:bg-[var(--color-accent)]/60',
                      selectedTables.has(t.name) ? 'opacity-100' : 'opacity-60'
                    )}
                  >
                    <input
                      type="checkbox"
                      checked={selectedTables.has(t.name)}
                      onChange={() => toggleTable(t.name)}
                      className="rounded"
                    />
                    <span className="truncate font-mono text-xs">{t.name}</span>
                  </label>
                ))
              )}
            </div>
          </aside>

          {/* Right — canvas */}
          <div className="overflow-hidden">
            <ErdCanvas tables={tables} selectedTables={selectedTables} />
          </div>

          {/* Hidden a11y checkbox */}
          <input
            type="checkbox"
            className="sr-only"
            checked={allVisibleSelected}
            onChange={() => undefined}
            aria-hidden
          />
        </div>
      )}
    </div>
  )
}
