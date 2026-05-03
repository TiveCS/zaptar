import type { Schema, Table } from '../types/schema'
import type { SchemaDiff, TableDiff } from '../types/diff'

/**
 * Pure schema diff engine.
 *
 * Implementation lands in Milestone 3. This stub returns an empty diff so the
 * IPC contract and UI scaffolding can compile and run end-to-end.
 */
export function diff(source: Schema, target: Schema): SchemaDiff {
  return {
    source: { databaseName: source.databaseName, dialect: source.dialect },
    target: { databaseName: target.databaseName, dialect: target.dialect },
    addedTables: [],
    removedTables: [],
    modifiedTables: [],
    unchangedTables: source.tables.map((t: Table) => t.name)
  }
}

export type { TableDiff }
