import { Database, GitCompare, Network, Workflow } from 'lucide-react'
import * as React from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'

import { api } from '@renderer/lib/api'
import { useShortcut } from '@renderer/hooks/useShortcut'
import { cn } from '@renderer/lib/utils'

const navItems = [
  { to: '/connections', label: 'Connections', icon: Network },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/result', label: 'Result', icon: Database },
  { to: '/erd', label: 'ERD', icon: Workflow }
] as const

export function Layout(): React.JSX.Element {
  const navigate = useNavigate()
  const [updateVersion, setUpdateVersion] = React.useState<string | null>(null)
  const [updateReady, setUpdateReady] = React.useState(false)
  const [installing, setInstalling] = React.useState(false)

  React.useEffect(() => {
    api.update.onAvailable((v) => setUpdateVersion(v))
    api.update.onDownloaded(() => setUpdateReady(true))
  }, [])

  // Global navigation shortcuts
  useShortcut([
    { key: ',', ctrl: true, handler: () => navigate('/connections') }
  ])

  async function handleInstall(): Promise<void> {
    setInstalling(true)
    await api.update.install()
  }

  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 shrink-0 items-center gap-1 border-b border-[var(--color-border)] px-4">
        <span className="font-mono font-semibold tracking-tight">zaptar</span>
        <span className="ml-2 text-xs text-[var(--color-muted-foreground)]">schema diff</span>
        <nav className="ml-6 flex items-center gap-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                cn(
                  'inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors',
                  isActive
                    ? 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
                    : 'text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                )
              }
            >
              <Icon className="size-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Update banner — right side of header */}
        {updateReady ? (
          <button
            onClick={handleInstall}
            disabled={installing}
            className="ml-auto rounded-md bg-[var(--color-diff-added-bg)] px-3 py-1 text-xs font-medium text-[var(--color-diff-added)] transition-opacity hover:opacity-80 disabled:opacity-50"
          >
            {installing ? 'Restarting…' : '↑ Restart to update'}
          </button>
        ) : updateVersion ? (
          <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
            Downloading update {updateVersion}…
          </span>
        ) : null}
      </header>

      <main className="min-h-0 flex-1 overflow-hidden">
        <Outlet />
      </main>
    </div>
  )
}
