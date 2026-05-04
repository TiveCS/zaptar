import { create } from 'zustand'

import type {
  Connection,
  ConnectionDraft,
  ConnectionTestResult,
  MigrationScript,
  SchemaDiff
} from '@shared/types'
import { api } from '@renderer/lib/api'

type Status = 'idle' | 'loading' | 'success' | 'error'

type AppStore = {
  // ── connections ──────────────────────────────────────────────────────
  connections: Connection[]
  connectionsLoaded: boolean
  loadConnections: () => Promise<void>
  createConnection: (draft: ConnectionDraft) => Promise<void>
  updateConnection: (id: string, patch: Partial<ConnectionDraft>) => Promise<void>
  deleteConnection: (id: string) => Promise<void>
  testConnection: (id: string) => Promise<ConnectionTestResult>

  // ── comparison ───────────────────────────────────────────────────────
  sourceId: string | null
  targetId: string | null
  selectedTables: Set<string>
  compareStatus: Status
  diff: SchemaDiff | null
  script: MigrationScript | null
  compareError: string | null
  setSourceId: (id: string | null) => void
  setTargetId: (id: string | null) => void
  toggleTable: (name: string) => void
  resetTables: () => void
  runCompare: () => Promise<void>

  // ── ui ───────────────────────────────────────────────────────────────
  selectedTable: string | null
  activeSection: 'columns' | 'indexes' | 'fks' | 'checks' | 'options'
  showUnchanged: boolean
  diffFilter: string
  setSelectedTable: (name: string | null) => void
  setActiveSection: (s: AppStore['activeSection']) => void
  setShowUnchanged: (v: boolean) => void
  setDiffFilter: (v: string) => void
}

export const useStore = create<AppStore>((set, get) => ({
  // ── connections ──────────────────────────────────────────────────────
  connections: [],
  connectionsLoaded: false,

  loadConnections: async () => {
    const connections = await api.connection.list()
    set({ connections, connectionsLoaded: true })
  },

  createConnection: async (draft) => {
    const conn = await api.connection.create(draft)
    set((s) => ({ connections: [...s.connections, conn] }))
  },

  updateConnection: async (id, patch) => {
    const conn = await api.connection.update(id, patch)
    set((s) => ({ connections: s.connections.map((c) => (c.id === id ? conn : c)) }))
  },

  deleteConnection: async (id) => {
    await api.connection.delete(id)
    set((s) => ({ connections: s.connections.filter((c) => c.id !== id) }))
  },

  testConnection: (id) => api.connection.test(id),

  // ── comparison ───────────────────────────────────────────────────────
  sourceId: null,
  targetId: null,
  selectedTables: new Set(),
  compareStatus: 'idle',
  diff: null,
  script: null,
  compareError: null,

  setSourceId: (id) => set({ sourceId: id }),
  setTargetId: (id) => set({ targetId: id }),
  toggleTable: (name) =>
    set((s) => {
      const next = new Set(s.selectedTables)
      next.has(name) ? next.delete(name) : next.add(name)
      return { selectedTables: next }
    }),
  resetTables: () => set({ selectedTables: new Set() }),

  runCompare: async () => {
    const { sourceId, targetId, selectedTables } = get()
    if (!sourceId || !targetId) return
    // Clear previous result and selection before starting
    set({
      compareStatus: 'loading',
      diff: null,
      script: null,
      compareError: null,
      selectedTable: null
    })
    try {
      const tables = selectedTables.size > 0 ? [...selectedTables] : undefined
      const result = await api.compare.run(sourceId, targetId, tables)
      // Auto-select the first changed table so the result page is immediately useful
      const d = result.diff
      const firstChanged =
        d.modifiedTables[0]?.name ?? d.addedTables[0]?.name ?? d.removedTables[0]?.name ?? null
      set({
        compareStatus: 'success',
        diff: d,
        script: result.script,
        selectedTable: firstChanged
      })
    } catch (err) {
      set({
        compareStatus: 'error',
        compareError: err instanceof Error ? err.message : String(err)
      })
    }
  },

  // ── ui ───────────────────────────────────────────────────────────────
  selectedTable: null,
  activeSection: 'columns',
  showUnchanged: false,
  diffFilter: '',
  setSelectedTable: (name) => set({ selectedTable: name }),
  setActiveSection: (s) => set({ activeSection: s }),
  setShowUnchanged: (v) => set({ showUnchanged: v }),
  setDiffFilter: (v) => set({ diffFilter: v })
}))
