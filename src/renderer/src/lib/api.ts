import type {
  Connection,
  ConnectionDraft,
  ConnectionTestResult,
  MigrationScript,
  SchemaDiff
} from '@shared/types'

export type ZaptarApi = {
  connection: {
    list(): Promise<Connection[]>
    create(draft: ConnectionDraft): Promise<Connection>
    update(id: string, patch: Partial<ConnectionDraft>): Promise<Connection>
    delete(id: string): Promise<void>
    test(id: string): Promise<ConnectionTestResult>
  }
  compare: {
    listTables(id: string): Promise<{ tables: string[] }>
    run(
      sourceId: string,
      targetId: string,
      tables?: string[]
    ): Promise<{ diff: SchemaDiff; script: MigrationScript }>
  }
  script: {
    save(script: MigrationScript): Promise<{ path: string | null }>
    copy(script: MigrationScript): Promise<void>
  }
}

export const api: ZaptarApi = window.zaptar
