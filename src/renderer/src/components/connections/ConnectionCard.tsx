import { AlertCircle, CheckCircle2, Copy, Loader2, Pencil, Trash2, XCircle, Zap } from 'lucide-react'
import * as React from 'react'

import type { Connection, ConnectionTestResult } from '@shared/types'
import { Badge } from '@renderer/components/ui/badge'
import { Button } from '@renderer/components/ui/button'

type TestState =
  | { status: 'idle' }
  | { status: 'testing' }
  | { status: 'ok'; serverVersion: string }
  | { status: 'error'; message: string }

type Props = {
  connection: Connection
  onEdit: (conn: Connection) => void
  onDuplicate: (conn: Connection) => void
  onDelete: (id: string) => void
  onTest: (id: string) => Promise<ConnectionTestResult>
}

export function ConnectionCard({ connection, onEdit, onDuplicate, onDelete, onTest }: Props): React.JSX.Element {
  const [testState, setTestState] = React.useState<TestState>({ status: 'idle' })
  const [errorExpanded, setErrorExpanded] = React.useState(false)

  async function handleTest(): Promise<void> {
    setTestState({ status: 'testing' })
    setErrorExpanded(false)
    const result = await onTest(connection.id)
    if (result.ok) {
      setTestState({ status: 'ok', serverVersion: result.serverVersion ?? 'unknown' })
    } else {
      setTestState({ status: 'error', message: result.error ?? 'Connection failed' })
      setErrorExpanded(true)
    }
  }

  const dialectLabel = connection.dialect === 'mariadb' ? 'MariaDB' : 'MySQL'

  return (
    <div className="rounded-lg border border-[var(--color-border)] bg-[var(--color-card)] transition-colors">
      {/* Main row */}
      <div className="flex items-center justify-between px-4 py-3">
        {/* Left: info */}
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex items-center gap-2">
            <span className="font-medium">{connection.label}</span>
            <Badge variant="secondary">{dialectLabel}</Badge>
            {connection.ssl && <Badge variant="outline">SSL</Badge>}
          </div>
          <p className="font-mono text-xs text-[var(--color-muted-foreground)]">
            {connection.username}@{connection.host}:{connection.port}/{connection.database}
          </p>

          {/* Inline test result */}
          {testState.status === 'ok' && (
            <p className="flex items-center gap-1.5 text-xs text-[var(--color-diff-added)]">
              <CheckCircle2 className="size-3.5 shrink-0" />
              Connected successfully &middot; {testState.serverVersion}
            </p>
          )}
          {testState.status === 'error' && (
            <button
              onClick={() => setErrorExpanded((v) => !v)}
              className="flex items-center gap-1.5 text-left text-xs text-[var(--color-destructive)] hover:opacity-80"
            >
              <XCircle className="size-3.5 shrink-0" />
              <span>Connection failed</span>
              <span className="text-[var(--color-muted-foreground)]">
                {errorExpanded ? '▲ hide' : '▼ show error'}
              </span>
            </button>
          )}
        </div>

        {/* Right: actions */}
        <div className="ml-4 flex shrink-0 items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleTest}
            disabled={testState.status === 'testing'}
            title="Test connection"
          >
            {testState.status === 'testing' ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Zap className="size-4" />
            )}
            <span className="sr-only">Test</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onDuplicate(connection)} title="Duplicate">
            <Copy className="size-4" />
            <span className="sr-only">Duplicate</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onEdit(connection)} title="Edit">
            <Pencil className="size-4" />
            <span className="sr-only">Edit</span>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="text-[var(--color-destructive)] hover:text-[var(--color-destructive)]"
            onClick={() => onDelete(connection.id)}
            title="Delete"
          >
            <Trash2 className="size-4" />
            <span className="sr-only">Delete</span>
          </Button>
        </div>
      </div>

      {/* Expandable error panel */}
      {testState.status === 'error' && errorExpanded && (
        <div className="border-t border-[var(--color-destructive)]/20 bg-[var(--color-destructive)]/8 px-4 py-3">
          <div className="flex gap-2">
            <AlertCircle className="mt-0.5 size-4 shrink-0 text-[var(--color-destructive)]" />
            <div className="flex flex-col gap-1">
              <p className="text-xs font-medium text-[var(--color-destructive)]">
                Could not connect to {connection.host}:{connection.port}
              </p>
              <pre className="whitespace-pre-wrap break-all font-mono text-xs text-[var(--color-destructive)]/80">
                {testState.message}
              </pre>
              <p className="mt-1 text-xs text-[var(--color-muted-foreground)]">
                Check that the host is reachable, the port is correct, the credentials are valid,
                and the database exists.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
