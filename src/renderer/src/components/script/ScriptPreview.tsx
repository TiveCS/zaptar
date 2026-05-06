import { AlertTriangle, ChevronDown, ChevronRight, Copy, Save } from 'lucide-react'
import * as React from 'react'

import type { MigrationScript, Statement } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { useShortcut } from '@renderer/hooks/useShortcut'
import { api } from '@renderer/lib/api'
import { SqlCode } from '@renderer/lib/sql-highlight'
import { cn } from '@renderer/lib/utils'

const KIND_LABEL: Record<Statement['kind'], string> = {
  preamble: 'Preamble',
  postamble: 'Postamble',
  drop_foreign_key: 'Drop FK',
  drop_table: 'Drop Table',
  drop_index: 'Drop Index',
  create_table: 'Create Table',
  alter_table_add_column: 'Add Column',
  alter_table_drop_column: 'Drop Column',
  alter_table_modify_column: 'Modify Column',
  alter_table_add_index: 'Add Index',
  alter_table_drop_index: 'Drop Index',
  alter_table_add_foreign_key: 'Add FK',
  alter_table_options: 'Table Options',
  alter_table_check_add: 'Add Check',
  alter_table_check_drop: 'Drop Check'
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  script: MigrationScript
}

export function ScriptPreview({ script }: Props): React.JSX.Element {
  const [notice, setNotice] = React.useState<{ text: string; kind: 'success' | 'error' } | null>(null)

  function showNotice(text: string, kind: 'success' | 'error', ms = 3000): void {
    setNotice({ text, kind })
    setTimeout(() => setNotice(null), ms)
  }
  const [warningsOpen, setWarningsOpen] = React.useState(false)

  const dangerous = script.statements.filter((s) => s.destructive)
  const mainStatements = script.statements.filter(
    (s) => s.kind !== 'preamble' && s.kind !== 'postamble'
  )

  async function handleCopy(): Promise<void> {
    try {
      await api.script.copy(script)
      showNotice('Copied!', 'success', 2000)
    } catch (err) {
      showNotice(`Copy failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  async function handleSave(): Promise<void> {
    try {
      const result = await api.script.save(script)
      if (result.path) showNotice(`Saved to ${result.path}`, 'success', 4000)
    } catch (err) {
      showNotice(`Save failed: ${err instanceof Error ? err.message : String(err)}`, 'error')
    }
  }

  // Ctrl+Shift+S — save,  Ctrl+Shift+C — copy
  useShortcut([
    { key: 's', ctrl: true, shift: true, handler: handleSave },
    { key: 'c', ctrl: true, shift: true, handler: handleCopy }
  ])

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-3">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-semibold">Migration Script</span>
          <span className="rounded-full bg-[var(--color-diff-modified-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-diff-modified)]">
            {mainStatements.length} statement{mainStatements.length !== 1 ? 's' : ''}
          </span>
          {dangerous.length > 0 && (
            <span className="rounded-full bg-[var(--color-destructive)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--color-destructive)]">
              {dangerous.length} destructive
            </span>
          )}
        </div>
        {notice && (
          <span
            className={cn(
              'text-xs',
              notice.kind === 'success'
                ? 'text-[var(--color-diff-added)]'
                : 'text-[var(--color-destructive)]'
            )}
          >
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
      </div>

      {/* Warnings — collapsible */}
      {script.warnings.length > 0 && (
        <div className="shrink-0 border-b border-[var(--color-border)]">
          <button
            onClick={() => setWarningsOpen((v) => !v)}
            className="flex w-full items-center gap-2 bg-[var(--color-destructive)]/8 px-6 py-2.5 text-left transition-colors hover:bg-[var(--color-destructive)]/12"
          >
            <AlertTriangle className="size-3.5 shrink-0 text-[var(--color-destructive)]" />
            <span className="flex-1 text-xs font-semibold text-[var(--color-destructive)]">
              {script.warnings.length} warning{script.warnings.length > 1 ? 's' : ''} — review
              before running
            </span>
            {warningsOpen ? (
              <ChevronDown className="size-3.5 shrink-0 text-[var(--color-destructive)]" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-[var(--color-destructive)]" />
            )}
          </button>
          {warningsOpen && (
            <div className="max-h-48 overflow-y-auto bg-[var(--color-destructive)]/5 px-6 py-2">
              {script.warnings.map((w, i) => (
                <p key={i} className="py-0.5 text-xs text-[var(--color-destructive)]/80">
                  {w.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statement list */}
      <div className="flex-1 overflow-auto">
        {script.statements.map((stmt) => (
          <div
            key={stmt.id}
            className={cn(
              'border-b border-[var(--color-border)]/50',
              stmt.destructive && 'bg-[var(--color-destructive)]/5',
              (stmt.kind === 'preamble' || stmt.kind === 'postamble') &&
                'bg-[var(--color-muted)]/40'
            )}
          >
            {/* Statement header */}
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  stmt.destructive
                    ? 'bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]'
                    : stmt.kind === 'preamble' || stmt.kind === 'postamble'
                      ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                      : 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
                )}
              >
                {KIND_LABEL[stmt.kind]}
              </span>
              {stmt.tableName && (
                <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                  {stmt.tableName}
                </span>
              )}
              {stmt.destructive && (
                <span className="ml-auto text-xs font-semibold text-[var(--color-destructive)]">
                  ⚠ destructive
                </span>
              )}
              {stmt.note && !stmt.destructive && (
                <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
                  {stmt.note}
                </span>
              )}
            </div>
            {/* SQL with syntax highlighting */}
            <SqlCode code={stmt.sql} />
          </div>
        ))}
      </div>
    </div>
  )
}
