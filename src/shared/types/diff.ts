import type { DialectId } from './connection'
import type { CheckConstraint, Column, ForeignKey, Index, Table } from './schema'

export type SchemaDiff = {
  source: { databaseName: string; dialect: DialectId }
  target: { databaseName: string; dialect: DialectId }
  addedTables: Table[]
  removedTables: Table[]
  modifiedTables: TableDiff[]
  unchangedTables: string[]
}

export type TableDiff = {
  name: string
  sourceTable: Table
  columns: Change<Column>[]
  indexes: Change<Index>[]
  foreignKeys: Change<ForeignKey>[]
  checkConstraints: Change<CheckConstraint>[]
  optionChanges: OptionChange[]
}

export type OptionChange = {
  key: string
  from: string | null
  to: string | null
}

export type Change<T> =
  | { kind: 'added'; after: T }
  | { kind: 'removed'; before: T }
  | { kind: 'modified'; before: T; after: T; fieldDiffs: FieldDiff[] }
  | { kind: 'renamed'; before: T; after: T }

export type FieldDiff = {
  field: string
  from: unknown
  to: unknown
}
