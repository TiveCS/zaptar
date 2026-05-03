import { Plus } from 'lucide-react'

import { Button } from '@renderer/components/ui/button'

export function ConnectionsPage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Connections</h1>
          <p className="text-sm text-[var(--color-muted-foreground)]">
            Saved MySQL / MariaDB databases. Credentials are encrypted at rest via the OS keychain.
          </p>
        </div>
        <Button>
          <Plus />
          Add connection
        </Button>
      </div>

      <div className="mt-8 rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center">
        <p className="text-sm text-[var(--color-muted-foreground)]">
          No connections yet. Click <span className="font-medium">Add connection</span> to save your
          first one.
        </p>
        <p className="mt-2 text-xs text-[var(--color-muted-foreground)]">Coming in Milestone 1.</p>
      </div>
    </div>
  )
}
