import mysql from 'mysql2/promise'

import type { Connection } from '../../../shared/types'
import type { DataRow, DataTableDiff } from '../../../shared/types/data'

// ── Row fetching ─────────────────────────────────────────────────────────────

export async function fetchTableRows(
  conn: Connection,
  password: string,
  tableName: string,
  limit: number
): Promise<{ rows: DataRow[]; capped: boolean }> {
  let client: mysql.Connection | null = null
  try {
    client = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.username,
      password,
      database: conn.database,
      ssl: conn.ssl ? { rejectUnauthorized: conn.ssl.rejectUnauthorized } : undefined,
      connectTimeout: 30_000,
      multipleStatements: false,
      dateStrings: true
    })

    // Fetch limit+1 so we can detect if the table exceeds the cap
    const [rows] = await client.execute<mysql.RowDataPacket[]>(
      `SELECT * FROM \`${tableName}\` LIMIT ?`,
      [limit + 1]
    )

    const capped = rows.length > limit
    const trimmed = capped ? rows.slice(0, limit) : rows

    return {
      rows: trimmed.map((r) => r as DataRow),
      capped
    }
  } finally {
    await client?.end().catch(() => undefined)
  }
}

// ── Row diff ─────────────────────────────────────────────────────────────────

function rowKey(row: DataRow, keyColumns: string[]): string {
  return JSON.stringify(keyColumns.map((k) => row[k] ?? null))
}

function rowsEqual(a: DataRow, b: DataRow, columns: string[]): boolean {
  return columns.every((col) => String(a[col] ?? '') === String(b[col] ?? ''))
}

export function diffTableData(
  tableName: string,
  sourceRows: DataRow[],
  targetRows: DataRow[],
  keyColumns: string[],
  limit: number,
  sourceCapped: boolean,
  targetCapped: boolean
): DataTableDiff {
  // Derive ordered column list from first available row
  const columns = Object.keys(sourceRows[0] ?? targetRows[0] ?? {})

  // Index target rows by key for O(n) lookup
  const targetMap = new Map<string, DataRow>()
  for (const row of targetRows) {
    targetMap.set(rowKey(row, keyColumns), row)
  }

  const added: DataRow[] = []
  const modified: { key: DataRow; before: DataRow; after: DataRow }[] = []
  const seenKeys = new Set<string>()

  for (const srcRow of sourceRows) {
    const key = rowKey(srcRow, keyColumns)
    seenKeys.add(key)
    const tgtRow = targetMap.get(key)

    if (!tgtRow) {
      added.push(srcRow)
    } else if (!rowsEqual(srcRow, tgtRow, columns)) {
      const keyRow: DataRow = {}
      for (const k of keyColumns) keyRow[k] = srcRow[k] ?? null
      modified.push({ key: keyRow, before: tgtRow, after: srcRow })
    }
    // else: unchanged — skip
  }

  // Rows in target but not in source → removed
  const removed: DataRow[] = []
  for (const [key, tgtRow] of targetMap) {
    if (!seenKeys.has(key)) removed.push(tgtRow)
  }

  return {
    tableName,
    keyColumns,
    columns,
    added,
    removed,
    modified,
    rowsFetched: { source: sourceRows.length, target: targetRows.length },
    capped: sourceCapped || targetCapped,
    limit
  }
}
