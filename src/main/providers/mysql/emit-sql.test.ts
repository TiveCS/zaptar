import { describe, expect, it } from 'vitest'

import type { Column, ForeignKey, Index, Table } from '../../../shared/types/schema'
import type { SchemaDiff, TableDiff } from '../../../shared/types/diff'
import { emitSql } from './emit-sql'

// ── Fixture helpers ───────────────────────────────────────────────────────────

function col(name: string, dataType = 'varchar(255)'): Column {
  return {
    name,
    ordinal: 1,
    dataType,
    nullable: false,
    default: null,
    extra: '',
    charset: null,
    collation: null,
    comment: '',
    generationExpression: null
  }
}

function tbl(name: string, cols: Column[] = []): Table {
  return {
    name,
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_general_ci',
    comment: '',
    columns: cols,
    indexes: [],
    foreignKeys: [],
    checkConstraints: [],
    options: {}
  }
}

function emptyDiff(): SchemaDiff {
  return {
    source: { databaseName: 'src', dialect: 'mysql' },
    target: { databaseName: 'tgt', dialect: 'mysql' },
    addedTables: [],
    removedTables: [],
    modifiedTables: [],
    unchangedTables: []
  }
}

function emptyTableDiff(name: string): TableDiff {
  return {
    name,
    sourceTable: {
      name,
      engine: 'InnoDB',
      charset: 'utf8mb4',
      collation: 'utf8mb4_general_ci',
      comment: '',
      columns: [],
      indexes: [],
      foreignKeys: [],
      checkConstraints: [],
      options: {}
    },
    columns: [],
    indexes: [],
    foreignKeys: [],
    checkConstraints: [],
    optionChanges: []
  }
}

function fk(name: string, table: string): ForeignKey {
  return {
    name,
    columns: ['id'],
    referencedTable: table,
    referencedColumns: ['id'],
    onUpdate: 'CASCADE',
    onDelete: 'CASCADE'
  }
}

function idx(name: string): Index {
  return {
    name,
    kind: 'index',
    columns: [{ columnName: 'id', subPart: null, expression: null }],
    comment: '',
    using: 'BTREE'
  }
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('emitSql', () => {
  // 1. preamble/postamble always present
  it('always emits a preamble as the first statement and postamble as the last', () => {
    const result = emitSql(emptyDiff())
    expect(result.statements.length).toBeGreaterThanOrEqual(2)
    expect(result.statements[0].kind).toBe('preamble')
    expect(result.statements[result.statements.length - 1].kind).toBe('postamble')
  })

  // 2. preamble contains SET FOREIGN_KEY_CHECKS = 0
  it('preamble sql contains SET FOREIGN_KEY_CHECKS = 0', () => {
    const result = emitSql(emptyDiff())
    expect(result.statements[0].sql).toContain('SET FOREIGN_KEY_CHECKS = 0')
  })

  // 3. postamble contains SET FOREIGN_KEY_CHECKS = 1
  it('postamble sql contains SET FOREIGN_KEY_CHECKS = 1', () => {
    const result = emitSql(emptyDiff())
    const last = result.statements[result.statements.length - 1]
    expect(last.sql).toContain('SET FOREIGN_KEY_CHECKS = 1')
  })

  // 4. added table produces a create_table statement with CREATE TABLE
  it('emits a create_table statement for an added table', () => {
    const diff: SchemaDiff = { ...emptyDiff(), addedTables: [tbl('users', [col('id', 'int')])] }
    const result = emitSql(diff)
    const createStmts = result.statements.filter((s) => s.kind === 'create_table')
    expect(createStmts).toHaveLength(1)
    expect(createStmts[0].sql).toContain('CREATE TABLE')
  })

  // 5. added table with FK: create_table comes before alter_table_add_foreign_key
  it('emits create_table before alter_table_add_foreign_key for an added table with a FK', () => {
    const newTable = { ...tbl('orders', [col('id', 'int')]), foreignKeys: [fk('fk_user', 'users')] }
    const diff: SchemaDiff = { ...emptyDiff(), addedTables: [newTable] }
    const result = emitSql(diff)
    const createIdx = result.statements.findIndex((s) => s.kind === 'create_table')
    const addFkIdx = result.statements.findIndex((s) => s.kind === 'alter_table_add_foreign_key')
    expect(createIdx).toBeGreaterThanOrEqual(0)
    expect(addFkIdx).toBeGreaterThanOrEqual(0)
    expect(createIdx).toBeLessThan(addFkIdx)
  })

  // 6. removed table produces a drop_table statement
  it('emits a drop_table statement for a removed table', () => {
    const diff: SchemaDiff = { ...emptyDiff(), removedTables: [tbl('old_table')] }
    const result = emitSql(diff)
    const dropStmts = result.statements.filter((s) => s.kind === 'drop_table')
    expect(dropStmts).toHaveLength(1)
  })

  // 7. drop_table statement is destructive
  it('drop_table statement has destructive: true', () => {
    const diff: SchemaDiff = { ...emptyDiff(), removedTables: [tbl('old_table')] }
    const result = emitSql(diff)
    const dropStmt = result.statements.find((s) => s.kind === 'drop_table')
    expect(dropStmt).toBeDefined()
    expect(dropStmt!.destructive).toBe(true)
  })

  // 8. removed table adds a danger warning
  it('adds a danger-level warning when a table is dropped', () => {
    const diff: SchemaDiff = { ...emptyDiff(), removedTables: [tbl('old_table')] }
    const result = emitSql(diff)
    const dangerWarnings = result.warnings.filter((w) => w.level === 'danger')
    expect(dangerWarnings.length).toBeGreaterThanOrEqual(1)
  })

  // 9. drop_foreign_key appears before drop_table in statements
  it('emits drop_foreign_key before drop_table', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('orders'),
      foreignKeys: [{ kind: 'removed', before: fk('fk_user', 'users') }]
    }
    const diff: SchemaDiff = {
      ...emptyDiff(),
      removedTables: [tbl('orders')],
      modifiedTables: [modifiedTable]
    }
    const result = emitSql(diff)
    const dropFkIdx = result.statements.findIndex((s) => s.kind === 'drop_foreign_key')
    const dropTblIdx = result.statements.findIndex((s) => s.kind === 'drop_table')
    expect(dropFkIdx).toBeGreaterThanOrEqual(0)
    expect(dropTblIdx).toBeGreaterThanOrEqual(0)
    expect(dropFkIdx).toBeLessThan(dropTblIdx)
  })

  // 10. add column produces alter_table_add_column
  it('emits alter_table_add_column for a modified table with an added column', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      columns: [{ kind: 'added', after: col('email') }]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const addColStmts = result.statements.filter((s) => s.kind === 'alter_table_add_column')
    expect(addColStmts).toHaveLength(1)
  })

  // 11. drop column produces alter_table_drop_column, is destructive, and adds a warning
  it('emits destructive alter_table_drop_column and a warning for a removed column', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      columns: [{ kind: 'removed', before: col('old_col') }]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const dropColStmt = result.statements.find((s) => s.kind === 'alter_table_drop_column')
    expect(dropColStmt).toBeDefined()
    expect(dropColStmt!.destructive).toBe(true)
    const dangerWarnings = result.warnings.filter((w) => w.level === 'danger')
    expect(dangerWarnings.length).toBeGreaterThanOrEqual(1)
  })

  // 12. modify column produces alter_table_modify_column
  it('emits alter_table_modify_column for a modified column', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      columns: [
        {
          kind: 'modified',
          before: col('age', 'int'),
          after: col('age', 'bigint'),
          fieldDiffs: [{ field: 'dataType', from: 'int', to: 'bigint' }]
        }
      ]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const modifyStmts = result.statements.filter((s) => s.kind === 'alter_table_modify_column')
    expect(modifyStmts).toHaveLength(1)
  })

  // 13. modify column with dataType change is destructive
  it('alter_table_modify_column is destructive when dataType changes', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      columns: [
        {
          kind: 'modified',
          before: col('age', 'int'),
          after: col('age', 'bigint'),
          fieldDiffs: [{ field: 'dataType', from: 'int', to: 'bigint' }]
        }
      ]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const modifyStmt = result.statements.find((s) => s.kind === 'alter_table_modify_column')
    expect(modifyStmt).toBeDefined()
    expect(modifyStmt!.destructive).toBe(true)
  })

  // 14. modify column with only comment change is not destructive
  it('alter_table_modify_column is not destructive when only comment changes', () => {
    const before = col('name', 'varchar(255)')
    const after: Column = { ...col('name', 'varchar(255)'), comment: 'A user name' }
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      columns: [
        {
          kind: 'modified',
          before,
          after,
          fieldDiffs: [{ field: 'comment', from: '', to: 'A user name' }]
        }
      ]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const modifyStmt = result.statements.find((s) => s.kind === 'alter_table_modify_column')
    expect(modifyStmt).toBeDefined()
    expect(modifyStmt!.destructive).toBe(false)
  })

  // 15. add index produces alter_table_add_index
  it('emits alter_table_add_index for an added index on a modified table', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      indexes: [{ kind: 'added', after: idx('idx_email') }]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const addIdxStmts = result.statements.filter((s) => s.kind === 'alter_table_add_index')
    expect(addIdxStmts).toHaveLength(1)
  })

  // 16. drop index comes before add column in statement ordering within alter table operations
  it('emits alter_table_drop_index before alter_table_add_column', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      columns: [{ kind: 'added', after: col('email') }],
      indexes: [{ kind: 'removed', before: idx('idx_old') }]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const dropIdxIdx = result.statements.findIndex((s) => s.kind === 'alter_table_drop_index')
    const addColIdx = result.statements.findIndex((s) => s.kind === 'alter_table_add_column')
    expect(dropIdxIdx).toBeGreaterThanOrEqual(0)
    expect(addColIdx).toBeGreaterThanOrEqual(0)
    expect(dropIdxIdx).toBeLessThan(addColIdx)
  })

  // 17. FK added to modified table produces alter_table_add_foreign_key
  it('emits alter_table_add_foreign_key for an FK added to a modified table', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('orders'),
      foreignKeys: [{ kind: 'added', after: fk('fk_user', 'users') }]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const addFkStmts = result.statements.filter((s) => s.kind === 'alter_table_add_foreign_key')
    expect(addFkStmts).toHaveLength(1)
  })

  // 18. all statement IDs are unique
  it('all statement ids are unique', () => {
    const diff: SchemaDiff = {
      ...emptyDiff(),
      addedTables: [tbl('a', [col('id', 'int')]), tbl('b', [col('id', 'int')])],
      removedTables: [tbl('c'), tbl('d')],
      modifiedTables: [
        {
          ...emptyTableDiff('e'),
          columns: [
            { kind: 'added', after: col('x') },
            { kind: 'removed', before: col('y') }
          ]
        }
      ]
    }
    const result = emitSql(diff)
    const ids = result.statements.map((s) => s.id)
    const uniqueIds = new Set(ids)
    expect(uniqueIds.size).toBe(ids.length)
  })

  // 19. table option change (ENGINE) produces alter_table_options
  it('emits alter_table_options with ALTER TABLE for an ENGINE option change', () => {
    const modifiedTable: TableDiff = {
      ...emptyTableDiff('users'),
      optionChanges: [{ key: 'ENGINE', from: 'InnoDB', to: 'MyISAM' }]
    }
    const diff: SchemaDiff = { ...emptyDiff(), modifiedTables: [modifiedTable] }
    const result = emitSql(diff)
    const optStmts = result.statements.filter((s) => s.kind === 'alter_table_options')
    expect(optStmts).toHaveLength(1)
    expect(optStmts[0].sql).toContain('ALTER TABLE')
  })

  // 20. metadata — generatedAt, source.databaseName, target.databaseName
  it('metadata fields match the input diff', () => {
    const result = emitSql(emptyDiff())
    expect(result.generatedAt).toBeTruthy()
    expect(typeof result.generatedAt).toBe('string')
    expect(result.source.databaseName).toBe('src')
    expect(result.target.databaseName).toBe('tgt')
  })
})
