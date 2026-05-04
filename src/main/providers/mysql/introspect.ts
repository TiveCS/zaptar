import mysql from 'mysql2/promise'

import type { Connection } from '../../../shared/types'
import type {
  CheckConstraint,
  Column,
  FkAction,
  ForeignKey,
  Index,
  IndexKind,
  Schema,
  Table
} from '../../../shared/types/schema'

export async function listTables(conn: Connection, password: string): Promise<string[]> {
  let client: mysql.Connection | null = null
  try {
    client = await mysql.createConnection({
      host: conn.host,
      port: conn.port,
      user: conn.username,
      password,
      database: conn.database,
      ssl: conn.ssl ? { rejectUnauthorized: conn.ssl.rejectUnauthorized } : undefined,
      connectTimeout: 10_000,
      multipleStatements: false,
      dateStrings: true
    })
    const [rows] = await client.execute<mysql.RowDataPacket[]>(
      `SELECT TABLE_NAME
       FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = ? AND TABLE_TYPE = 'BASE TABLE'
       ORDER BY TABLE_NAME`,
      [conn.database]
    )
    return rows.map((r) => r.TABLE_NAME as string)
  } finally {
    await client?.end().catch(() => undefined)
  }
}

export async function introspectSchema(
  conn: Connection,
  password: string,
  tables?: string[]
): Promise<Schema> {
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

    const db = conn.database
    const tf = tables && tables.length > 0 ? tables : null
    const ph = (n: number): string => Array(n).fill('?').join(', ')

    // ── TABLES ──────────────────────────────────────────────────────────
    const tblBase = `
      SELECT t.TABLE_NAME,
             COALESCE(t.ENGINE, 'InnoDB')                  AS ENGINE,
             COALESCE(ccsa.CHARACTER_SET_NAME, '')          AS CHARSET,
             COALESCE(t.TABLE_COLLATION, '')                AS COLLATION,
             COALESCE(t.TABLE_COMMENT, '')                  AS TABLE_COMMENT,
             COALESCE(CAST(t.AUTO_INCREMENT AS CHAR), '')   AS AUTO_INCREMENT,
             COALESCE(t.ROW_FORMAT, '')                     AS ROW_FORMAT
      FROM information_schema.TABLES t
      LEFT JOIN information_schema.COLLATION_CHARACTER_SET_APPLICABILITY ccsa
        ON ccsa.COLLATION_NAME = t.TABLE_COLLATION
      WHERE t.TABLE_SCHEMA = ?
        AND t.TABLE_TYPE = 'BASE TABLE'`
    const tblParams: string[] = [db]
    const tblSql = tf
      ? `${tblBase} AND t.TABLE_NAME IN (${ph(tf.length)}) ORDER BY t.TABLE_NAME`
      : `${tblBase} ORDER BY t.TABLE_NAME`
    if (tf) tblParams.push(...tf)
    const [tblRows] = await client.execute<mysql.RowDataPacket[]>(tblSql, tblParams)

    // ── COLUMNS ─────────────────────────────────────────────────────────
    const colBase = `
      SELECT TABLE_NAME, COLUMN_NAME, ORDINAL_POSITION,
             COLUMN_DEFAULT, IS_NULLABLE, COLUMN_TYPE,
             CHARACTER_SET_NAME, COLLATION_NAME, EXTRA,
             COALESCE(COLUMN_COMMENT, '')          AS COLUMN_COMMENT,
             COALESCE(GENERATION_EXPRESSION, '')   AS GENERATION_EXPRESSION
      FROM information_schema.COLUMNS
      WHERE TABLE_SCHEMA = ?`
    const colParams: string[] = [db]
    const colSql = tf
      ? `${colBase} AND TABLE_NAME IN (${ph(tf.length)}) ORDER BY TABLE_NAME, ORDINAL_POSITION`
      : `${colBase} ORDER BY TABLE_NAME, ORDINAL_POSITION`
    if (tf) colParams.push(...tf)
    const [colRows] = await client.execute<mysql.RowDataPacket[]>(colSql, colParams)

    // ── STATISTICS ───────────────────────────────────────────────────────
    const stBase = `
      SELECT TABLE_NAME, INDEX_NAME, NON_UNIQUE, INDEX_TYPE,
             COALESCE(INDEX_COMMENT, '') AS INDEX_COMMENT,
             SEQ_IN_INDEX, COLUMN_NAME, SUB_PART, EXPRESSION
      FROM information_schema.STATISTICS
      WHERE TABLE_SCHEMA = ?`
    const stParams: string[] = [db]
    const stSql = tf
      ? `${stBase} AND TABLE_NAME IN (${ph(tf.length)}) ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
      : `${stBase} ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`
    if (tf) stParams.push(...tf)
    const [stRows] = await client.execute<mysql.RowDataPacket[]>(stSql, stParams)

    // ── FOREIGN KEYS ─────────────────────────────────────────────────────
    const fkBase = `
      SELECT kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.COLUMN_NAME,
             kcu.ORDINAL_POSITION, kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
             rc.UPDATE_RULE, rc.DELETE_RULE
      FROM information_schema.KEY_COLUMN_USAGE kcu
      JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
        ON rc.CONSTRAINT_SCHEMA = kcu.TABLE_SCHEMA
        AND rc.CONSTRAINT_NAME  = kcu.CONSTRAINT_NAME
        AND rc.TABLE_NAME       = kcu.TABLE_NAME
      WHERE kcu.TABLE_SCHEMA = ?
        AND kcu.REFERENCED_TABLE_NAME IS NOT NULL`
    const fkParams: string[] = [db]
    const fkSql = tf
      ? `${fkBase} AND kcu.TABLE_NAME IN (${ph(tf.length)}) ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`
      : `${fkBase} ORDER BY kcu.TABLE_NAME, kcu.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`
    if (tf) fkParams.push(...tf)
    const [fkRows] = await client.execute<mysql.RowDataPacket[]>(fkSql, fkParams)

    // ── CHECK CONSTRAINTS ────────────────────────────────────────────────
    let ckRows: mysql.RowDataPacket[] = []
    try {
      const ckBase = `
        SELECT tc.TABLE_NAME, cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE,
               COALESCE(cc.ENFORCED, 'YES') AS ENFORCED
        FROM information_schema.CHECK_CONSTRAINTS cc
        JOIN information_schema.TABLE_CONSTRAINTS tc
          ON tc.CONSTRAINT_SCHEMA = cc.CONSTRAINT_SCHEMA
          AND tc.CONSTRAINT_NAME  = cc.CONSTRAINT_NAME
        WHERE cc.CONSTRAINT_SCHEMA = ?`
      const ckParams: string[] = [db]
      const ckSql = tf
        ? `${ckBase} AND tc.TABLE_NAME IN (${ph(tf.length)}) ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME`
        : `${ckBase} ORDER BY tc.TABLE_NAME, cc.CONSTRAINT_NAME`
      if (tf) ckParams.push(...tf)
      const [rows] = await client.execute<mysql.RowDataPacket[]>(ckSql, ckParams)
      ckRows = rows
    } catch {
      // CHECK_CONSTRAINTS absent on older MySQL / MariaDB versions — safe to skip
    }

    return buildSchema(conn, tblRows, colRows, stRows, fkRows, ckRows)
  } finally {
    await client?.end().catch(() => undefined)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function groupBy(rows: mysql.RowDataPacket[], key: string): Record<string, mysql.RowDataPacket[]> {
  const out: Record<string, mysql.RowDataPacket[]> = {}
  for (const r of rows) {
    const k = r[key] as string
    ;(out[k] ??= []).push(r)
  }
  return out
}

function buildIndexes(rows: mysql.RowDataPacket[]): Index[] {
  const map = new Map<string, { row: mysql.RowDataPacket; cols: mysql.RowDataPacket[] }>()
  for (const r of rows) {
    const n = r.INDEX_NAME as string
    const entry = map.get(n)
    if (entry) entry.cols.push(r)
    else map.set(n, { row: r, cols: [r] })
  }
  return Array.from(map.values()).map(({ row, cols }) => {
    const name = row.INDEX_NAME as string
    const type = (row.INDEX_TYPE ?? 'BTREE') as string
    let kind: IndexKind
    if (name === 'PRIMARY') kind = 'primary'
    else if (row.NON_UNIQUE === 0 || row.NON_UNIQUE === '0') kind = 'unique'
    else if (type === 'FULLTEXT') kind = 'fulltext'
    else if (type === 'SPATIAL') kind = 'spatial'
    else kind = 'index'
    return {
      name,
      kind,
      columns: cols.map((c) => ({
        columnName: c.COLUMN_NAME as string,
        subPart: (c.SUB_PART ?? null) as number | null,
        expression: (c.EXPRESSION ?? null) as string | null
      })),
      comment: (row.INDEX_COMMENT ?? '') as string,
      using: type === 'BTREE' ? 'BTREE' : type === 'HASH' ? 'HASH' : null
    } satisfies Index
  })
}

function buildForeignKeys(rows: mysql.RowDataPacket[]): ForeignKey[] {
  const map = new Map<string, { row: mysql.RowDataPacket; cols: { col: string; ref: string }[] }>()
  for (const r of rows) {
    const n = r.CONSTRAINT_NAME as string
    const entry = map.get(n)
    const pair = { col: r.COLUMN_NAME as string, ref: r.REFERENCED_COLUMN_NAME as string }
    if (entry) entry.cols.push(pair)
    else map.set(n, { row: r, cols: [pair] })
  }
  return Array.from(map.values()).map(({ row, cols }) => ({
    name: row.CONSTRAINT_NAME as string,
    columns: cols.map((c) => c.col),
    referencedTable: row.REFERENCED_TABLE_NAME as string,
    referencedColumns: cols.map((c) => c.ref),
    onUpdate: (row.UPDATE_RULE ?? 'RESTRICT') as FkAction,
    onDelete: (row.DELETE_RULE ?? 'RESTRICT') as FkAction
  }))
}

function buildSchema(
  conn: Connection,
  tblRows: mysql.RowDataPacket[],
  colRows: mysql.RowDataPacket[],
  stRows: mysql.RowDataPacket[],
  fkRows: mysql.RowDataPacket[],
  ckRows: mysql.RowDataPacket[]
): Schema {
  const colsByTbl = groupBy(colRows, 'TABLE_NAME')
  const stByTbl = groupBy(stRows, 'TABLE_NAME')
  const fkByTbl = groupBy(fkRows, 'TABLE_NAME')
  const ckByTbl = groupBy(ckRows, 'TABLE_NAME')

  const tables: Table[] = tblRows.map((tr) => {
    const name = tr.TABLE_NAME as string

    const columns: Column[] = (colsByTbl[name] ?? []).map((cr) => ({
      name: cr.COLUMN_NAME as string,
      ordinal: cr.ORDINAL_POSITION as number,
      dataType: cr.COLUMN_TYPE as string,
      nullable: cr.IS_NULLABLE === 'YES',
      default: (cr.COLUMN_DEFAULT ?? null) as string | null,
      extra: (cr.EXTRA ?? '') as string,
      charset: (cr.CHARACTER_SET_NAME ?? null) as string | null,
      collation: (cr.COLLATION_NAME ?? null) as string | null,
      comment: (cr.COLUMN_COMMENT ?? '') as string,
      generationExpression: (cr.GENERATION_EXPRESSION as string) || null
    }))

    const options: Record<string, string> = {}
    if (tr.AUTO_INCREMENT) options['AUTO_INCREMENT'] = tr.AUTO_INCREMENT as string
    if (tr.ROW_FORMAT) options['ROW_FORMAT'] = tr.ROW_FORMAT as string

    return {
      name,
      engine: (tr.ENGINE ?? 'InnoDB') as string,
      charset: (tr.CHARSET ?? '') as string,
      collation: (tr.COLLATION ?? '') as string,
      comment: (tr.TABLE_COMMENT ?? '') as string,
      columns,
      indexes: buildIndexes(stByTbl[name] ?? []),
      foreignKeys: buildForeignKeys(fkByTbl[name] ?? []),
      checkConstraints: (ckByTbl[name] ?? []).map(
        (ck) =>
          ({
            name: ck.CONSTRAINT_NAME as string,
            expression: ck.CHECK_CLAUSE as string,
            enforced: ck.ENFORCED !== 'NO'
          }) satisfies CheckConstraint
      ),
      options
    } satisfies Table
  })

  return { dialect: conn.dialect, databaseName: conn.database, tables }
}
