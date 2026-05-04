import mysql from 'mysql2/promise'

import type { Connection } from '../../../shared/types'

export async function testMysqlConnection(
  conn: Connection,
  password: string
): Promise<{ ok: boolean; serverVersion?: string; error?: string }> {
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
    const [rows] = await client.execute<mysql.RowDataPacket[]>('SELECT VERSION() AS version')
    return { ok: true, serverVersion: rows[0]?.version as string | undefined }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) }
  } finally {
    await client?.end().catch(() => undefined)
  }
}
