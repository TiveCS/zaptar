import type { Connection, DialectId } from './types/connection'
import type { SchemaDiff } from './types/diff'
import type { CheckConstraint, Column, ForeignKey, Index, Schema, Table } from './types/schema'
import type { MigrationScript } from './types/script'

export interface SchemaProvider {
  id: DialectId
  displayName: string

  introspect(conn: Connection, password: string, opts: { tables?: string[] }): Promise<Schema>

  emitSql(diff: SchemaDiff, opts: EmitOptions): MigrationScript

  formatDdl(unit: FormatUnit, ctx: FormatCtx): string
}

export type FormatUnit =
  | { type: 'column'; data: Column; tableName: string }
  | { type: 'index'; data: Index; tableName: string }
  | { type: 'foreignKey'; data: ForeignKey; tableName: string }
  | { type: 'checkConstraint'; data: CheckConstraint; tableName: string }
  | { type: 'table'; data: Table }

export type FormatCtx = Record<string, never>

export type EmitOptions = {
  wrapForeignKeyChecks: boolean
  generateIfExistsIfNotExists: boolean
  emitTableOptionAlters: boolean
}

export const defaultEmitOptions: EmitOptions = {
  wrapForeignKeyChecks: true,
  generateIfExistsIfNotExists: true,
  emitTableOptionAlters: true
}
