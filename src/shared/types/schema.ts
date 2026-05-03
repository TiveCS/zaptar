import type { DialectId } from './connection'

export type Schema = {
  dialect: DialectId
  databaseName: string
  tables: Table[]
}

export type Table = {
  name: string
  engine: string
  charset: string
  collation: string
  comment: string
  columns: Column[]
  indexes: Index[]
  foreignKeys: ForeignKey[]
  checkConstraints: CheckConstraint[]
  options: Record<string, string>
}

export type Column = {
  name: string
  ordinal: number
  dataType: string
  nullable: boolean
  default: string | null
  extra: string
  charset: string | null
  collation: string | null
  comment: string
  generationExpression: string | null
}

export type Index = {
  name: string
  kind: IndexKind
  columns: IndexColumn[]
  comment: string
  using: 'BTREE' | 'HASH' | null
}

export type IndexKind = 'primary' | 'unique' | 'index' | 'fulltext' | 'spatial'

export type IndexColumn = {
  columnName: string
  subPart: number | null
  expression: string | null
}

export type ForeignKey = {
  name: string
  columns: string[]
  referencedTable: string
  referencedColumns: string[]
  onUpdate: FkAction
  onDelete: FkAction
}

export type FkAction = 'CASCADE' | 'SET NULL' | 'SET DEFAULT' | 'RESTRICT' | 'NO ACTION'

export type CheckConstraint = {
  name: string
  expression: string
  enforced: boolean
}
