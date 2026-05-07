import type { Connection, ConnectionDraft, ConnectionTestResult } from './connection'
import type { DataTableDiff } from './data'
import type { SchemaDiff } from './diff'
import type { MigrationScript } from './script'
import type { Table } from './schema'

export type IpcChannelMap = {
  'connection:list': { req: void; res: Connection[] }
  'connection:create': { req: ConnectionDraft; res: Connection }
  'connection:update': {
    req: { id: string; patch: Partial<ConnectionDraft> }
    res: Connection
  }
  'connection:delete': { req: { id: string }; res: void }
  'connection:test': { req: { id: string }; res: ConnectionTestResult }
  'connection:test-draft': { req: ConnectionDraft; res: ConnectionTestResult }

  'compare:list-tables': { req: { id: string }; res: { tables: string[] } }
  'compare:run': {
    req: { sourceId: string; targetId: string; tables?: string[] }
    res: { diff: SchemaDiff; script: MigrationScript }
  }
  'compare:table': {
    req: { connectionId: string; tableName: string }
    res: Table | null
  }

  'script:save': { req: { script: MigrationScript }; res: { path: string | null } }
  'script:copy': { req: { script: MigrationScript }; res: void }

  'update:install': { req: void; res: void }

  'data:compare': {
    req: {
      sourceId: string
      targetId: string
      tableName: string
      keyColumns: string[]
      limit: number
    }
    res: DataTableDiff
  }

  // Save data sync SQL (INSERT/UPDATE/DELETE) — kept distinct from script:save
  // so the two never share a code path. Schema and data scripts are different
  // tooling with different review semantics.
  'data:save-sql': {
    req: { sql: string; defaultName: string }
    res: { path: string | null }
  }
}

export type IpcChannel = keyof IpcChannelMap
export type IpcRequest<C extends IpcChannel> = IpcChannelMap[C]['req']
export type IpcResponse<C extends IpcChannel> = IpcChannelMap[C]['res']
