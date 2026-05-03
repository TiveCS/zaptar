import { create } from 'zustand'

import type { Connection, MigrationScript, SchemaDiff } from '@shared/types'

type Status = 'idle' | 'loading' | 'success' | 'error'

type ConnectionsSlice = {
  connections: Connection[]
  loadingConnections: boolean
}

type ComparisonSlice = {
  sourceId: string | null
  targetId: string | null
  selectedTables: Set<string>
  status: Status
  diff: SchemaDiff | null
  script: MigrationScript | null
  error: string | null
}

type UiSlice = {
  selectedTable: string | null
  activeSection: 'columns' | 'indexes' | 'fks' | 'checks' | 'options'
  showUnchanged: boolean
  diffFilter: string
  setSelectedTable: (name: string | null) => void
  setActiveSection: (section: UiSlice['activeSection']) => void
  setShowUnchanged: (show: boolean) => void
  setDiffFilter: (filter: string) => void
}

export type AppStore = ConnectionsSlice & ComparisonSlice & UiSlice

export const useStore = create<AppStore>((set) => ({
  connections: [],
  loadingConnections: false,

  sourceId: null,
  targetId: null,
  selectedTables: new Set(),
  status: 'idle',
  diff: null,
  script: null,
  error: null,

  selectedTable: null,
  activeSection: 'columns',
  showUnchanged: false,
  diffFilter: '',
  setSelectedTable: (name) => set({ selectedTable: name }),
  setActiveSection: (section) => set({ activeSection: section }),
  setShowUnchanged: (show) => set({ showUnchanged: show }),
  setDiffFilter: (filter) => set({ diffFilter: filter })
}))
