import type { Connection, ConnectionDraft, ConnectionTestResult } from './connection'
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
}

export type IpcChannel = keyof IpcChannelMap
export type IpcRequest<C extends IpcChannel> = IpcChannelMap[C]['req']
export type IpcResponse<C extends IpcChannel> = IpcChannelMap[C]['res']
