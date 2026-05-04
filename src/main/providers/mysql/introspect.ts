import mysql from 'mysql2/promise'

import type { Connection } from '../../../shared/types'

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
