import { Plus } from 'lucide-react'
import * as React from 'react'

import type { Connection, ConnectionDraft } from '@shared/types'
import { ConnectionCard } from '@renderer/components/connections/ConnectionCard'
import { ConnectionForm } from '@renderer/components/connections/ConnectionForm'
import { Button } from '@renderer/components/ui/button'
import { useStore } from '@renderer/store'

export function ConnectionsPage(): React.JSX.Element {
  const {
    connections,
    connectionsLoaded,
    loadConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection
  } = useStore()

  const [formOpen, setFormOpen] = React.useState(false)
  const [editing, setEditing] = React.useState<Connection | undefined>()
  const [deleteConfirm, setDeleteConfirm] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (!connectionsLoaded) loadConnections()
  }, [connectionsLoaded, loadConnections])

  function handleAdd(): void {
    setEditing(undefined)
    setFormOpen(true)
  }

  function handleEdit(conn: Connection): void {
    setEditing(conn)
    setFormOpen(true)
  }

  async function handleSave(draft: ConnectionDraft): Promise<void> {
    if (editing) {
      await updateConnection(editing.id, draft)
    } else {
      await createConnection(draft)
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (deleteConfirm !== id) {
      // First click: arm
      setDeleteConfirm(id)
      setTimeout(() => setDeleteConfirm(null), 3000)
      return
    }
    await deleteConnection(id)
    setDeleteConfirm(null)
  }

  return (
    <div className="h-full overflow-auto">
      <div className="mx-auto max-w-4xl px-6 py-8">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
            <p className="mt-1 text-sm text-[var(--color-muted-foreground)]">
              Saved MySQL / MariaDB databases. Passwords are encrypted by the OS keychain.
            </p>
          </div>
          <Button onClick={handleAdd}>
            <Plus />
            Add connection
          </Button>
        </div>

        {/* List */}
        <div className="mt-8 flex flex-col gap-3">
          {!connectionsLoaded && (
            <p className="text-sm text-[var(--color-muted-foreground)]">Loading…</p>
          )}

          {connectionsLoaded && connections.length === 0 && (
            <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center">
              <p className="text-sm text-[var(--color-muted-foreground)]">
                No connections yet. Click{' '}
                <button
                  onClick={handleAdd}
                  className="font-medium text-[var(--color-foreground)] underline underline-offset-2"
                >
                  Add connection
                </button>{' '}
                to save your first one.
              </p>
            </div>
          )}

          {connections.map((conn) => (
            <div key={conn.id} className="relative">
              {deleteConfirm === conn.id && (
                <div className="absolute -top-2 right-0 z-10 rounded-md border border-[var(--color-destructive)] bg-[var(--color-card)] px-3 py-1.5 text-xs text-[var(--color-destructive)] shadow-md">
                  Click delete again to confirm — this cannot be undone
                </div>
              )}
              <ConnectionCard
                connection={conn}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onTest={testConnection}
              />
            </div>
          ))}
        </div>

        <ConnectionForm
          open={formOpen}
          onOpenChange={setFormOpen}
          editing={editing}
          onSave={handleSave}
        />
      </div>
    </div>
  )
}
