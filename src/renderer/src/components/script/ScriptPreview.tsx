import { AlertTriangle, Copy, Save } from 'lucide-react'
import * as React from 'react'

import type { MigrationScript, Statement } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
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

type Props = {
  script: MigrationScript
}

export function ScriptPreview({ script }: Props): React.JSX.Element {
  const [copyDone, setCopyDone] = React.useState(false)
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null)

  const dangerous = script.statements.filter((s) => s.destructive)
  const mainStatements = script.statements.filter(
    (s) => s.kind !== 'preamble' && s.kind !== 'postamble'
  )

  async function handleCopy(): Promise<void> {
    await api.script.copy(script)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  async function handleSave(): Promise<void> {
    const result = await api.script.save(script)
    if (result.path) {
      setSaveMsg(`Saved to ${result.path}`)
      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-3">
        <div className="flex-1">
          <span className="text-sm font-semibold">Migration Script</span>
          <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">
            {mainStatements.length} statement{mainStatements.length !== 1 ? 's' : ''}
            {dangerous.length > 0 && (
              <span className="ml-1 text-[var(--color-destructive)]">
                · {dangerous.length} destructive
              </span>
            )}
          </span>
        </div>
        {saveMsg && <span className="text-xs text-[var(--color-diff-added)]">{saveMsg}</span>}
        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save className="size-3.5" />
          Save .sql
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="size-3.5" />
          {copyDone ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* Warnings */}
      {script.warnings.length > 0 && (
        <div className="border-b border-[var(--color-border)] bg-[var(--color-destructive)]/8 px-6 py-3">
          <div className="flex items-start gap-2">
            <AlertTriangle className="mt-0.5 size-4 shrink-0 text-[var(--color-destructive)]" />
            <div className="space-y-0.5">
              <p className="text-xs font-semibold text-[var(--color-destructive)]">
                {script.warnings.length} warning{script.warnings.length > 1 ? 's' : ''} — review
                before running
              </p>
              {script.warnings.map((w, i) => (
                <p key={i} className="text-xs text-[var(--color-destructive)]/80">
                  {w.message}
                </p>
              ))}
            </div>
          </div>
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
            {/* SQL */}
            <pre className="overflow-x-auto px-4 pb-3 pt-0 font-mono text-xs leading-relaxed text-[var(--color-foreground)]">
              {stmt.sql}
            </pre>
          </div>
        ))}
      </div>
    </div>
  )
}
