import { contextBridge, ipcRenderer } from 'electron'

import type {
  Connection,
  ConnectionDraft,
  ConnectionTestResult,
  MigrationScript,
  SchemaDiff
} from '../shared/types'
import type { Table } from '../shared/types/schema'

const zaptar = {
  connection: {
    list: (): Promise<Connection[]> => ipcRenderer.invoke('connection:list'),
    create: (draft: ConnectionDraft): Promise<Connection> =>
      ipcRenderer.invoke('connection:create', draft),
    update: (id: string, patch: Partial<ConnectionDraft>): Promise<Connection> =>
      ipcRenderer.invoke('connection:update', { id, patch }),
    delete: (id: string): Promise<void> => ipcRenderer.invoke('connection:delete', { id }),
    test: (id: string): Promise<ConnectionTestResult> =>
      ipcRenderer.invoke('connection:test', { id }),
    testDraft: (draft: ConnectionDraft): Promise<ConnectionTestResult> =>
      ipcRenderer.invoke('connection:test-draft', draft)
  },
  compare: {
    listTables: (id: string): Promise<{ tables: string[] }> =>
      ipcRenderer.invoke('compare:list-tables', { id }),
    run: (
      sourceId: string,
      targetId: string,
      tables?: string[]
    ): Promise<{ diff: SchemaDiff; script: MigrationScript }> =>
      ipcRenderer.invoke('compare:run', { sourceId, targetId, tables }),
    table: (connectionId: string, tableName: string): Promise<Table | null> =>
      ipcRenderer.invoke('compare:table', { connectionId, tableName })
  },
  script: {
    save: (script: MigrationScript): Promise<{ path: string | null }> =>
      ipcRenderer.invoke('script:save', { script }),
    copy: (script: MigrationScript): Promise<void> => ipcRenderer.invoke('script:copy', { script })
  },
  update: {
    onAvailable: (cb: (version: string) => void): void => {
      ipcRenderer.on('update:available', (_, info: { version: string }) => cb(info.version))
    },
    onDownloaded: (cb: () => void): void => {
      ipcRenderer.on('update:downloaded', () => cb())
    },
    install: (): Promise<void> => ipcRenderer.invoke('update:install')
  }
} as const

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('zaptar', zaptar)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore window typing handled in index.d.ts
  window.zaptar = zaptar
}

export type ZaptarBridge = typeof zaptar
