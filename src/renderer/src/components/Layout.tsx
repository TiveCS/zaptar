import { Database, GitCompare, Network } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'

import { cn } from '@renderer/lib/utils'

const navItems = [
  { to: '/connections', label: 'Connections', icon: Network },
  { to: '/compare', label: 'Compare', icon: GitCompare },
  { to: '/result', label: 'Result', icon: Database }
] as const

export function Layout(): React.JSX.Element {
  return (
    <div className="flex h-full flex-col">
      <header className="flex h-12 items-center gap-1 border-b border-[var(--color-border)] px-4">
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
      </header>
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  )
}
