export type MigrationScript = {
  generatedAt: string
  source: { databaseName: string }
  target: { databaseName: string }
  statements: Statement[]
  warnings: Warning[]
}

export type Statement = {
  id: string
  kind: StatementKind
  sql: string
  destructive: boolean
  tableName: string
  note?: string
}

export type StatementKind =
  | 'drop_foreign_key'
  | 'drop_index'
  | 'drop_table'
  | 'create_table'
  | 'alter_table_add_column'
  | 'alter_table_drop_column'
  | 'alter_table_modify_column'
  | 'alter_table_add_index'
  | 'alter_table_drop_index'
  | 'alter_table_add_foreign_key'
  | 'alter_table_options'
  | 'alter_table_check_add'
  | 'alter_table_check_drop'
  | 'preamble'
  | 'postamble'

export type Warning = {
  level: 'info' | 'warn' | 'danger'
  message: string
  statementId?: string
}
