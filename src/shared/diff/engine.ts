import type { Column, CheckConstraint, ForeignKey, Index, Table } from '../types/schema'
import type { Change, FieldDiff, OptionChange, SchemaDiff, TableDiff } from '../types/diff'
import type { Schema } from '../types/schema'

export function diff(source: Schema, target: Schema): SchemaDiff {
  const srcMap = new Map(source.tables.map((t) => [t.name, t]))
  const tgtMap = new Map(target.tables.map((t) => [t.name, t]))

  const addedTables: Table[] = []
  const removedTables: Table[] = []
  const modifiedTables: TableDiff[] = []
  const unchangedTables: string[] = []

  // In source, not in target → will be ADDED to target
  for (const [name, tbl] of srcMap) {
    if (!tgtMap.has(name)) addedTables.push(tbl)
  }

  // In target, not in source → will be REMOVED from target
  for (const [name, tbl] of tgtMap) {
    if (!srcMap.has(name)) removedTables.push(tbl)
  }

  // In both → diff each
  for (const [name, src] of srcMap) {
    const tgt = tgtMap.get(name)
    if (!tgt) continue
    const td = diffTable(src, tgt)
    if (hasChanges(td)) modifiedTables.push(td)
    else unchangedTables.push(name)
  }

  return {
    source: { databaseName: source.databaseName, dialect: source.dialect },
    target: { databaseName: target.databaseName, dialect: target.dialect },
    addedTables,
    removedTables,
    modifiedTables,
    unchangedTables
  }
}

function diffTable(src: Table, tgt: Table): TableDiff {
  return {
    name: src.name,
    columns: diffByName(src.columns, tgt.columns, diffColumn),
    indexes: diffByName(src.indexes, tgt.indexes, diffIndex),
    foreignKeys: diffByName(src.foreignKeys, tgt.foreignKeys, diffFk),
    checkConstraints: diffByName(src.checkConstraints, tgt.checkConstraints, diffCheck),
    optionChanges: diffTableOptions(src, tgt)
  }
}

function hasChanges(td: TableDiff): boolean {
  return (
    td.columns.length > 0 ||
    td.indexes.length > 0 ||
    td.foreignKeys.length > 0 ||
    td.checkConstraints.length > 0 ||
    td.optionChanges.length > 0
  )
}

// ── Generic by-name diff ─────────────────────────────────────────────────────

function diffByName<T extends { name: string }>(
  srcList: T[],
  tgtList: T[],
  compareFn: (a: T, b: T) => Change<T>
): Change<T>[] {
  const srcMap = new Map(srcList.map((x) => [x.name, x]))
  const tgtMap = new Map(tgtList.map((x) => [x.name, x]))
  const changes: Change<T>[] = []

  for (const [name, src] of srcMap) {
    const tgt = tgtMap.get(name)
    if (!tgt) {
      changes.push({ kind: 'added', after: src })
    } else {
      const ch = compareFn(src, tgt)
      if (ch.kind === 'modified') {
        const fieldDiffs = (
          ch as { kind: 'modified'; before: T; after: T; fieldDiffs: FieldDiff[] }
        ).fieldDiffs
        if (fieldDiffs.length > 0) changes.push(ch)
      } else {
        changes.push(ch)
      }
    }
  }

  for (const [name, tgt] of tgtMap) {
    if (!srcMap.has(name)) changes.push({ kind: 'removed', before: tgt })
  }

  return changes
}

// ── Per-type comparators ─────────────────────────────────────────────────────

function diffColumn(src: Column, tgt: Column): Change<Column> {
  const fields: FieldDiff[] = []
  const check = <K extends keyof Column>(key: K): void => {
    if (src[key] !== tgt[key]) fields.push({ field: key, from: tgt[key], to: src[key] })
  }
  check('dataType')
  check('nullable')
  check('default')
  check('extra')
  check('charset')
  check('collation')
  check('comment')
  check('generationExpression')
  return { kind: 'modified', before: tgt, after: src, fieldDiffs: fields }
}

function diffIndex(src: Index, tgt: Index): Change<Index> {
  const fields: FieldDiff[] = []
  if (src.kind !== tgt.kind) fields.push({ field: 'kind', from: tgt.kind, to: src.kind })
  if (src.using !== tgt.using) fields.push({ field: 'using', from: tgt.using, to: src.using })
  const srcCols = JSON.stringify(src.columns)
  const tgtCols = JSON.stringify(tgt.columns)
  if (srcCols !== tgtCols) fields.push({ field: 'columns', from: tgtCols, to: srcCols })
  return { kind: 'modified', before: tgt, after: src, fieldDiffs: fields }
}

function diffFk(src: ForeignKey, tgt: ForeignKey): Change<ForeignKey> {
  const fields: FieldDiff[] = []
  const check = <K extends keyof ForeignKey>(key: K): void => {
    const a = JSON.stringify(src[key])
    const b = JSON.stringify(tgt[key])
    if (a !== b) fields.push({ field: key, from: tgt[key], to: src[key] })
  }
  check('columns')
  check('referencedTable')
  check('referencedColumns')
  check('onUpdate')
  check('onDelete')
  return { kind: 'modified', before: tgt, after: src, fieldDiffs: fields }
}

function diffCheck(src: CheckConstraint, tgt: CheckConstraint): Change<CheckConstraint> {
  const fields: FieldDiff[] = []
  if (src.expression !== tgt.expression)
    fields.push({ field: 'expression', from: tgt.expression, to: src.expression })
  if (src.enforced !== tgt.enforced)
    fields.push({ field: 'enforced', from: tgt.enforced, to: src.enforced })
  return { kind: 'modified', before: tgt, after: src, fieldDiffs: fields }
}

function diffTableOptions(src: Table, tgt: Table): OptionChange[] {
  const changes: OptionChange[] = []
  const check = (key: string, a: string, b: string): void => {
    if (a !== b) changes.push({ key, from: b || null, to: a || null })
  }
  check('ENGINE', src.engine, tgt.engine)
  check('CHARSET', src.charset, tgt.charset)
  check('COLLATION', src.collation, tgt.collation)
  check('COMMENT', src.comment, tgt.comment)
  // Extra options (AUTO_INCREMENT, ROW_FORMAT, etc.)
  const allKeys = new Set([...Object.keys(src.options), ...Object.keys(tgt.options)])
  for (const k of allKeys) {
    const a = src.options[k] ?? ''
    const b = tgt.options[k] ?? ''
    // Skip AUTO_INCREMENT differences — they're expected to diverge
    if (k === 'AUTO_INCREMENT') continue
    if (a !== b) changes.push({ key: k, from: b || null, to: a || null })
  }
  return changes
}

export type { TableDiff }
