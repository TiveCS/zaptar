import { describe, expect, it } from 'vitest'

import type {
  Column,
  CheckConstraint,
  ForeignKey,
  Index,
  Schema,
  Table
} from '@shared/types/schema'
import { diff } from './engine'

// ── Fixture helpers ──────────────────────────────────────────────────────────

function makeSchema(
  databaseName: string,
  tables: Table[] = [],
  dialect: Schema['dialect'] = 'mysql'
): Schema {
  return { dialect, databaseName, tables }
}

function makeTable(name: string, overrides: Partial<Table> = {}): Table {
  return {
    name,
    engine: 'InnoDB',
    charset: 'utf8mb4',
    collation: 'utf8mb4_unicode_ci',
    comment: '',
    columns: [],
    indexes: [],
    foreignKeys: [],
    checkConstraints: [],
    options: {},
    ...overrides
  }
}

function makeColumn(name: string, overrides: Partial<Column> = {}): Column {
  return {
    name,
    ordinal: 1,
    dataType: 'int',
    nullable: false,
    default: null,
    extra: '',
    charset: null,
    collation: null,
    comment: '',
    generationExpression: null,
    ...overrides
  }
}

function makeIndex(name: string, overrides: Partial<Index> = {}): Index {
  return {
    name,
    kind: 'index',
    columns: [{ columnName: 'id', subPart: null, expression: null }],
    comment: '',
    using: 'BTREE',
    ...overrides
  }
}

function makeFk(name: string, overrides: Partial<ForeignKey> = {}): ForeignKey {
  return {
    name,
    columns: ['user_id'],
    referencedTable: 'users',
    referencedColumns: ['id'],
    onUpdate: 'NO ACTION',
    onDelete: 'NO ACTION',
    ...overrides
  }
}

function makeCheck(name: string, overrides: Partial<CheckConstraint> = {}): CheckConstraint {
  return {
    name,
    expression: 'price > 0',
    enforced: true,
    ...overrides
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('diff engine', () => {
  // ── 1. Empty schemas ───────────────────────────────────────────────────────
  describe('empty schemas', () => {
    it('returns empty diff arrays when both schemas have no tables', () => {
      const result = diff(makeSchema('dev'), makeSchema('prod'))
      expect(result.addedTables).toEqual([])
      expect(result.removedTables).toEqual([])
      expect(result.modifiedTables).toEqual([])
      expect(result.unchangedTables).toEqual([])
    })
  })

  // ── 2. Metadata preserved ─────────────────────────────────────────────────
  describe('metadata', () => {
    it('preserves source and target databaseName in result', () => {
      const result = diff(makeSchema('source_db'), makeSchema('target_db'))
      expect(result.source.databaseName).toBe('source_db')
      expect(result.target.databaseName).toBe('target_db')
    })

    it('preserves source and target dialect in result', () => {
      const result = diff(makeSchema('a', [], 'mysql'), makeSchema('b', [], 'mariadb'))
      expect(result.source.dialect).toBe('mysql')
      expect(result.target.dialect).toBe('mariadb')
    })
  })

  // ── 3 & 4. Added / removed tables ─────────────────────────────────────────
  describe('table presence', () => {
    it('reports table in source-only as addedTables', () => {
      const products = makeTable('products')
      const result = diff(makeSchema('db', [products]), makeSchema('db', []))
      expect(result.addedTables).toHaveLength(1)
      expect(result.addedTables[0].name).toBe('products')
      expect(result.removedTables).toHaveLength(0)
      expect(result.modifiedTables).toHaveLength(0)
    })

    it('reports table in target-only as removedTables', () => {
      const orders = makeTable('orders')
      const result = diff(makeSchema('db', []), makeSchema('db', [orders]))
      expect(result.removedTables).toHaveLength(1)
      expect(result.removedTables[0].name).toBe('orders')
      expect(result.addedTables).toHaveLength(0)
      expect(result.modifiedTables).toHaveLength(0)
    })

    it('can report added and removed tables in the same diff', () => {
      const result = diff(
        makeSchema('db', [makeTable('products')]),
        makeSchema('db', [makeTable('orders')])
      )
      expect(result.addedTables.map((t) => t.name)).toContain('products')
      expect(result.removedTables.map((t) => t.name)).toContain('orders')
    })
  })

  // ── 5. Unchanged tables ───────────────────────────────────────────────────
  describe('unchanged tables', () => {
    it('puts identical tables into unchangedTables and not modifiedTables', () => {
      const table = makeTable('users', {
        columns: [makeColumn('id'), makeColumn('name', { dataType: 'varchar(255)' })]
      })
      const result = diff(makeSchema('db', [table]), makeSchema('db', [table]))
      expect(result.unchangedTables).toContain('users')
      expect(result.modifiedTables).toHaveLength(0)
    })
  })

  // ── 6–11. Column diffs ────────────────────────────────────────────────────
  describe('column diffs', () => {
    it('reports added column with kind "added"', () => {
      const base = makeColumn('id')
      const extra = makeColumn('email', { dataType: 'varchar(255)', ordinal: 2 })
      const result = diff(
        makeSchema('db', [makeTable('users', { columns: [base, extra] })]),
        makeSchema('db', [makeTable('users', { columns: [base] })])
      )
      expect(result.modifiedTables).toHaveLength(1)
      const colChanges = result.modifiedTables[0].columns
      const added = colChanges.find((c) => c.kind === 'added')
      expect(added).toBeDefined()
      expect((added as { kind: 'added'; after: Column }).after.name).toBe('email')
    })

    it('reports removed column with kind "removed"', () => {
      const base = makeColumn('id')
      const extra = makeColumn('email', { dataType: 'varchar(255)', ordinal: 2 })
      const result = diff(
        makeSchema('db', [makeTable('users', { columns: [base] })]),
        makeSchema('db', [makeTable('users', { columns: [base, extra] })])
      )
      expect(result.modifiedTables).toHaveLength(1)
      const colChanges = result.modifiedTables[0].columns
      const removed = colChanges.find((c) => c.kind === 'removed')
      expect(removed).toBeDefined()
      expect((removed as { kind: 'removed'; before: Column }).before.name).toBe('email')
    })

    it('reports modified dataType with kind "modified" and fieldDiff for dataType', () => {
      const srcCol = makeColumn('price', { dataType: 'decimal(10,2)' })
      const tgtCol = makeColumn('price', { dataType: 'float' })
      const result = diff(
        makeSchema('db', [makeTable('products', { columns: [srcCol] })]),
        makeSchema('db', [makeTable('products', { columns: [tgtCol] })])
      )
      expect(result.modifiedTables).toHaveLength(1)
      const colChanges = result.modifiedTables[0].columns
      expect(colChanges).toHaveLength(1)
      expect(colChanges[0].kind).toBe('modified')
      const mod = colChanges[0] as {
        kind: 'modified'
        fieldDiffs: { field: string; from: unknown; to: unknown }[]
      }
      const dtDiff = mod.fieldDiffs.find((f) => f.field === 'dataType')
      expect(dtDiff).toBeDefined()
      expect(dtDiff!.from).toBe('float')
      expect(dtDiff!.to).toBe('decimal(10,2)')
    })

    it('reports modified nullable with kind "modified" and fieldDiff for nullable', () => {
      const srcCol = makeColumn('status', { nullable: false })
      const tgtCol = makeColumn('status', { nullable: true })
      const result = diff(
        makeSchema('db', [makeTable('orders', { columns: [srcCol] })]),
        makeSchema('db', [makeTable('orders', { columns: [tgtCol] })])
      )
      const colChanges = result.modifiedTables[0].columns
      expect(colChanges).toHaveLength(1)
      expect(colChanges[0].kind).toBe('modified')
      const mod = colChanges[0] as {
        kind: 'modified'
        fieldDiffs: { field: string; from: unknown; to: unknown }[]
      }
      const nullDiff = mod.fieldDiffs.find((f) => f.field === 'nullable')
      expect(nullDiff).toBeDefined()
      expect(nullDiff!.from).toBe(true)
      expect(nullDiff!.to).toBe(false)
    })

    it('reports multiple fieldDiffs when both dataType and nullable change', () => {
      const srcCol = makeColumn('qty', { dataType: 'bigint', nullable: false })
      const tgtCol = makeColumn('qty', { dataType: 'int', nullable: true })
      const result = diff(
        makeSchema('db', [makeTable('items', { columns: [srcCol] })]),
        makeSchema('db', [makeTable('items', { columns: [tgtCol] })])
      )
      const colChanges = result.modifiedTables[0].columns
      expect(colChanges[0].kind).toBe('modified')
      const mod = colChanges[0] as { kind: 'modified'; fieldDiffs: { field: string }[] }
      const fields = mod.fieldDiffs.map((f) => f.field)
      expect(fields).toContain('dataType')
      expect(fields).toContain('nullable')
      expect(mod.fieldDiffs.length).toBeGreaterThanOrEqual(2)
    })

    it('excludes unchanged columns from the columns change array', () => {
      const unchanged1 = makeColumn('id', { ordinal: 1 })
      const unchanged2 = makeColumn('name', { dataType: 'varchar(100)', ordinal: 2 })
      const changedSrc = makeColumn('price', { dataType: 'decimal(10,2)', ordinal: 3 })
      const changedTgt = makeColumn('price', { dataType: 'float', ordinal: 3 })
      const result = diff(
        makeSchema('db', [
          makeTable('products', { columns: [unchanged1, unchanged2, changedSrc] })
        ]),
        makeSchema('db', [makeTable('products', { columns: [unchanged1, unchanged2, changedTgt] })])
      )
      const colChanges = result.modifiedTables[0].columns
      // Only the changed 'price' column should appear
      expect(colChanges).toHaveLength(1)
      expect(colChanges[0].kind).toBe('modified')
    })
  })

  // ── 12–14. Index diffs ────────────────────────────────────────────────────
  describe('index diffs', () => {
    it('reports added index with kind "added"', () => {
      const idxEmail: Index = makeIndex('idx_email', {
        kind: 'unique',
        columns: [{ columnName: 'email', subPart: null, expression: null }]
      })
      const result = diff(
        makeSchema('db', [makeTable('users', { indexes: [idxEmail] })]),
        makeSchema('db', [makeTable('users', { indexes: [] })])
      )
      expect(result.modifiedTables).toHaveLength(1)
      const idxChanges = result.modifiedTables[0].indexes
      const added = idxChanges.find((c) => c.kind === 'added')
      expect(added).toBeDefined()
      expect((added as { kind: 'added'; after: Index }).after.name).toBe('idx_email')
    })

    it('reports removed index with kind "removed"', () => {
      const idxEmail = makeIndex('idx_email', {
        kind: 'unique',
        columns: [{ columnName: 'email', subPart: null, expression: null }]
      })
      const result = diff(
        makeSchema('db', [makeTable('users', { indexes: [] })]),
        makeSchema('db', [makeTable('users', { indexes: [idxEmail] })])
      )
      const idxChanges = result.modifiedTables[0].indexes
      const removed = idxChanges.find((c) => c.kind === 'removed')
      expect(removed).toBeDefined()
      expect((removed as { kind: 'removed'; before: Index }).before.name).toBe('idx_email')
    })

    it('reports modified index kind with kind "modified" and fieldDiff for kind', () => {
      const srcIdx = makeIndex('idx_status', { kind: 'unique' })
      const tgtIdx = makeIndex('idx_status', { kind: 'index' })
      const result = diff(
        makeSchema('db', [makeTable('orders', { indexes: [srcIdx] })]),
        makeSchema('db', [makeTable('orders', { indexes: [tgtIdx] })])
      )
      const idxChanges = result.modifiedTables[0].indexes
      expect(idxChanges).toHaveLength(1)
      expect(idxChanges[0].kind).toBe('modified')
      const mod = idxChanges[0] as {
        kind: 'modified'
        fieldDiffs: { field: string; from: unknown; to: unknown }[]
      }
      const kindDiff = mod.fieldDiffs.find((f) => f.field === 'kind')
      expect(kindDiff).toBeDefined()
      expect(kindDiff!.from).toBe('index')
      expect(kindDiff!.to).toBe('unique')
    })
  })

  // ── 15–16. Foreign key diffs ──────────────────────────────────────────────
  describe('foreign key diffs', () => {
    it('reports added FK with kind "added"', () => {
      const fk = makeFk('fk_user_id')
      const result = diff(
        makeSchema('db', [makeTable('posts', { foreignKeys: [fk] })]),
        makeSchema('db', [makeTable('posts', { foreignKeys: [] })])
      )
      expect(result.modifiedTables).toHaveLength(1)
      const fkChanges = result.modifiedTables[0].foreignKeys
      const added = fkChanges.find((c) => c.kind === 'added')
      expect(added).toBeDefined()
      expect((added as { kind: 'added'; after: ForeignKey }).after.name).toBe('fk_user_id')
    })

    it('reports modified FK onDelete with kind "modified" and fieldDiff for onDelete', () => {
      const srcFk = makeFk('fk_user_id', { onDelete: 'CASCADE' })
      const tgtFk = makeFk('fk_user_id', { onDelete: 'RESTRICT' })
      const result = diff(
        makeSchema('db', [makeTable('posts', { foreignKeys: [srcFk] })]),
        makeSchema('db', [makeTable('posts', { foreignKeys: [tgtFk] })])
      )
      const fkChanges = result.modifiedTables[0].foreignKeys
      expect(fkChanges).toHaveLength(1)
      expect(fkChanges[0].kind).toBe('modified')
      const mod = fkChanges[0] as {
        kind: 'modified'
        fieldDiffs: { field: string; from: unknown; to: unknown }[]
      }
      const onDeleteDiff = mod.fieldDiffs.find((f) => f.field === 'onDelete')
      expect(onDeleteDiff).toBeDefined()
      expect(onDeleteDiff!.from).toBe('RESTRICT')
      expect(onDeleteDiff!.to).toBe('CASCADE')
    })
  })

  // ── 17. Check constraint diffs ────────────────────────────────────────────
  describe('check constraint diffs', () => {
    it('reports added check constraint with kind "added"', () => {
      const chk = makeCheck('chk_price')
      const result = diff(
        makeSchema('db', [makeTable('products', { checkConstraints: [chk] })]),
        makeSchema('db', [makeTable('products', { checkConstraints: [] })])
      )
      expect(result.modifiedTables).toHaveLength(1)
      const chkChanges = result.modifiedTables[0].checkConstraints
      const added = chkChanges.find((c) => c.kind === 'added')
      expect(added).toBeDefined()
      expect((added as { kind: 'added'; after: CheckConstraint }).after.name).toBe('chk_price')
    })

    it('reports removed check constraint with kind "removed"', () => {
      const chk = makeCheck('chk_stock', { expression: 'stock >= 0' })
      const result = diff(
        makeSchema('db', [makeTable('products', { checkConstraints: [] })]),
        makeSchema('db', [makeTable('products', { checkConstraints: [chk] })])
      )
      const chkChanges = result.modifiedTables[0].checkConstraints
      const removed = chkChanges.find((c) => c.kind === 'removed')
      expect(removed).toBeDefined()
      expect((removed as { kind: 'removed'; before: CheckConstraint }).before.name).toBe(
        'chk_stock'
      )
    })
  })

  // ── 18–19. Table option diffs ─────────────────────────────────────────────
  describe('table option diffs', () => {
    it('reports ENGINE change in optionChanges', () => {
      const srcTable = makeTable('logs', { engine: 'MyISAM' })
      const tgtTable = makeTable('logs', { engine: 'InnoDB' })
      const result = diff(makeSchema('db', [srcTable]), makeSchema('db', [tgtTable]))
      expect(result.modifiedTables).toHaveLength(1)
      const optChanges = result.modifiedTables[0].optionChanges
      const engineChange = optChanges.find((o) => o.key === 'ENGINE')
      expect(engineChange).toBeDefined()
      expect(engineChange!.from).toBe('InnoDB')
      expect(engineChange!.to).toBe('MyISAM')
    })

    it('reports CHARSET change in optionChanges', () => {
      const srcTable = makeTable('articles', { charset: 'latin1' })
      const tgtTable = makeTable('articles', { charset: 'utf8mb4' })
      const result = diff(makeSchema('db', [srcTable]), makeSchema('db', [tgtTable]))
      const optChanges = result.modifiedTables[0].optionChanges
      const charsetChange = optChanges.find((o) => o.key === 'CHARSET')
      expect(charsetChange).toBeDefined()
      expect(charsetChange!.from).toBe('utf8mb4')
      expect(charsetChange!.to).toBe('latin1')
    })

    it('excludes AUTO_INCREMENT differences from optionChanges', () => {
      const srcTable = makeTable('counters', { options: { AUTO_INCREMENT: '1000' } })
      const tgtTable = makeTable('counters', { options: { AUTO_INCREMENT: '1' } })
      const result = diff(makeSchema('db', [srcTable]), makeSchema('db', [tgtTable]))
      // AUTO_INCREMENT difference alone should not cause modification
      expect(result.modifiedTables).toHaveLength(0)
      expect(result.unchangedTables).toContain('counters')
    })

    it('reports extra option changes (non-AUTO_INCREMENT) in optionChanges', () => {
      const srcTable = makeTable('data', { options: { ROW_FORMAT: 'COMPRESSED' } })
      const tgtTable = makeTable('data', { options: { ROW_FORMAT: 'DYNAMIC' } })
      const result = diff(makeSchema('db', [srcTable]), makeSchema('db', [tgtTable]))
      const optChanges = result.modifiedTables[0].optionChanges
      const rowFmtChange = optChanges.find((o) => o.key === 'ROW_FORMAT')
      expect(rowFmtChange).toBeDefined()
      expect(rowFmtChange!.from).toBe('DYNAMIC')
      expect(rowFmtChange!.to).toBe('COMPRESSED')
    })
  })

  // ── 20. Round-trip ────────────────────────────────────────────────────────
  describe('round-trip', () => {
    it('diff(schema, schema) produces no modified tables and all tables as unchanged', () => {
      const schema = makeSchema('db', [
        makeTable('users', {
          columns: [
            makeColumn('id', { ordinal: 1 }),
            makeColumn('email', { dataType: 'varchar(255)', ordinal: 2 })
          ],
          indexes: [
            makeIndex('idx_email', {
              kind: 'unique',
              columns: [{ columnName: 'email', subPart: null, expression: null }]
            })
          ],
          foreignKeys: [],
          checkConstraints: [makeCheck('chk_email', { expression: 'email LIKE "%@%"' })],
          options: { ROW_FORMAT: 'DYNAMIC' }
        }),
        makeTable('orders', {
          columns: [
            makeColumn('id', { ordinal: 1 }),
            makeColumn('user_id', { ordinal: 2 }),
            makeColumn('total', { dataType: 'decimal(10,2)', ordinal: 3 })
          ],
          foreignKeys: [makeFk('fk_orders_user', { onDelete: 'CASCADE' })]
        })
      ])

      const result = diff(schema, schema)
      expect(result.modifiedTables).toHaveLength(0)
      expect(result.addedTables).toHaveLength(0)
      expect(result.removedTables).toHaveLength(0)
      expect(result.unchangedTables).toContain('users')
      expect(result.unchangedTables).toContain('orders')
      expect(result.unchangedTables).toHaveLength(2)
    })
  })
})
