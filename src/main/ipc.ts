import { clipboard, dialog, ipcMain, type IpcMainInvokeEvent } from 'electron'
import { v4 as uuidv4 } from 'uuid'

import type { IpcChannel, IpcChannelMap } from '../shared/types'
import { testMysqlConnection } from './providers/mysql/connection'
import { listTables } from './providers/mysql/introspect'
import { decryptPassword, encryptPassword } from './secrets'
import { getDb } from './store'

type Handler<C extends IpcChannel> = (
  payload: IpcChannelMap[C]['req'],
  event: IpcMainInvokeEvent
) => Promise<IpcChannelMap[C]['res']> | IpcChannelMap[C]['res']

function handle<C extends IpcChannel>(channel: C, handler: Handler<C>): void {
  ipcMain.handle(channel, async (event, payload) => handler(payload as never, event))
}

export function registerIpc(): void {
  // ── connection:list ────────────────────────────────────────────────────
  handle('connection:list', () => {
    const db = getDb()
    return db.data.connections.map(({ _encryptedPassword: _, ...conn }) => conn)
  })

  // ── connection:create ──────────────────────────────────────────────────
  handle('connection:create', ({ password, ...rest }) => {
    const db = getDb()
    const now = new Date().toISOString()
    const conn = { ...rest, id: uuidv4(), createdAt: now, updatedAt: now }
    db.data.connections.push({ ...conn, _encryptedPassword: encryptPassword(password) })
    db.write()
    return conn
  })

  // ── connection:update ──────────────────────────────────────────────────
  handle('connection:update', ({ id, patch }) => {
    const db = getDb()
    const idx = db.data.connections.findIndex((c) => c.id === id)
    if (idx === -1) throw new Error(`Connection not found: ${id}`)

    const existing = db.data.connections[idx]
    const { password, ...rest } = patch
    const updated = {
      ...existing,
      ...rest,
      updatedAt: new Date().toISOString(),
      _encryptedPassword:
        password !== undefined ? encryptPassword(password) : existing._encryptedPassword
    }
    db.data.connections[idx] = updated
    db.write()
    const { _encryptedPassword: _, ...conn } = updated
    return conn
  })

  // ── connection:delete ──────────────────────────────────────────────────
  handle('connection:delete', ({ id }) => {
    const db = getDb()
    db.data.connections = db.data.connections.filter((c) => c.id !== id)
    db.write()
  })

  // ── connection:test ────────────────────────────────────────────────────
  handle('connection:test', async ({ id }) => {
    const db = getDb()
    const stored = db.data.connections.find((c) => c.id === id)
    if (!stored) throw new Error(`Connection not found: ${id}`)
    const password = decryptPassword(stored._encryptedPassword)
    const { _encryptedPassword: _, ...conn } = stored
    return testMysqlConnection(conn, password)
  })

  // ── compare:list-tables ────────────────────────────────────────────────
  handle('compare:list-tables', async ({ id }) => {
    const db = getDb()
    const stored = db.data.connections.find((c) => c.id === id)
    if (!stored) throw new Error(`Connection not found: ${id}`)
    const password = decryptPassword(stored._encryptedPassword)
    const { _encryptedPassword: _, ...conn } = stored
    const tables = await listTables(conn, password)
    return { tables }
  })

  // ── compare:run ────────────────────────────────────────────────────────
  handle('compare:run', () => {
    throw new Error('compare:run not implemented yet (Milestone 3-4)')
  })

  // ── script:save ────────────────────────────────────────────────────────
  handle('script:save', async ({ script }) => {
    const result = await dialog.showSaveDialog({
      title: 'Save migration script',
      defaultPath: `migration-${Date.now()}.sql`,
      filters: [{ name: 'SQL files', extensions: ['sql'] }]
    })
    if (result.canceled || !result.filePath) return { path: null }
    const { writeFileSync } = await import('fs')
    const sql = script.statements.map((s) => s.sql).join('\n\n')
    writeFileSync(result.filePath, sql, 'utf8')
    return { path: result.filePath }
  })

  // ── script:copy ────────────────────────────────────────────────────────
  handle('script:copy', ({ script }) => {
    const sql = script.statements.map((s) => s.sql).join('\n\n')
    clipboard.writeText(sql)
  })
}
