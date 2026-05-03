export function ResultPage(): React.JSX.Element {
  return (
    <div className="grid h-full grid-cols-[280px_1fr]">
      <aside className="overflow-auto border-r border-[var(--color-border)]">
        <div className="border-b border-[var(--color-border)] px-3 py-2 text-xs uppercase tracking-wide text-[var(--color-muted-foreground)]">
          Tables
        </div>
        <div className="px-3 py-4 text-sm text-[var(--color-muted-foreground)]">
          Run a compare to see results here.
        </div>
      </aside>
      <section className="overflow-auto p-6">
        <div className="rounded-lg border border-dashed border-[var(--color-border)] p-12 text-center">
          <h2 className="text-lg font-semibold">Side-by-side diff lands in Milestone 5</h2>
          <p className="mt-2 text-sm text-[var(--color-muted-foreground)]">
            Once the diff engine and SQL emitter are in place, this panel will render the git-style
            comparison and the migration script.
          </p>
        </div>
      </section>
    </div>
  )
}
