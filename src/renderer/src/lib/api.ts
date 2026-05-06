import type {
  Connection,
  ConnectionDraft,
  ConnectionTestResult,
  DataTableDiff,
  MigrationScript,
  SchemaDiff
} from '@shared/types'
import type { Table } from '@shared/types/schema'

export type ZaptarApi = {
  connection: {
    list(): Promise<Connection[]>
    create(draft: ConnectionDraft): Promise<Connection>
    update(id: string, patch: Partial<ConnectionDraft>): Promise<Connection>
    delete(id: string): Promise<void>
    test(id: string): Promise<ConnectionTestResult>
    testDraft(draft: ConnectionDraft): Promise<ConnectionTestResult>
  }
  compare: {
    listTables(id: string): Promise<{ tables: string[] }>
    run(
      sourceId: string,
      targetId: string,
      tables?: string[]
    ): Promise<{ diff: SchemaDiff; script: MigrationScript }>
    table(connectionId: string, tableName: string): Promise<Table | null>
  }
  script: {
    save(script: MigrationScript): Promise<{ path: string | null }>
    copy(script: MigrationScript): Promise<void>
  }
  update: {
    onAvailable(cb: (version: string) => void): void
    onDownloaded(cb: () => void): void
    install(): Promise<void>
  }
  data: {
    compare(
      sourceId: string,
      targetId: string,
      tableName: string,
      keyColumns: string[],
      limit: number
    ): Promise<DataTableDiff>
  }
}

export const api: ZaptarApi = window.zaptar
