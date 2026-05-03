import { ArrowRight } from 'lucide-react'

import { Button } from '@renderer/components/ui/button'

export function ComparePage(): React.JSX.Element {
  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      <h1 className="text-2xl font-semibold tracking-tight">Compare schemas</h1>
      <p className="text-sm text-[var(--color-muted-foreground)]">
        Pick the newer database (source) and the older database (target). The target is the one that
        will receive the migration.
      </p>

      <div className="mt-8 grid grid-cols-[1fr_auto_1fr] items-center gap-6">
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Source (newer)
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Connection picker — Milestone 2.
          </div>
        </div>
        <ArrowRight className="size-5 text-[var(--color-muted-foreground)]" />
        <div className="rounded-lg border border-[var(--color-border)] p-4">
          <div className="text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
            Target (older)
          </div>
          <div className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Connection picker — Milestone 2.
          </div>
        </div>
      </div>

      <div className="mt-8 flex justify-end">
        <Button disabled>Run compare</Button>
      </div>
    </div>
  )
}
