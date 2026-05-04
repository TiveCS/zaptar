import { app } from 'electron'
import { mkdirSync } from 'fs'
import { JSONFileSyncPreset } from 'lowdb/node'
import { join } from 'path'

import type { Connection } from '../shared/types'

export type StoredConnection = Connection & { _encryptedPassword: string }

type DbData = {
  connections: StoredConnection[]
}

const defaultData: DbData = { connections: [] }

let _db: ReturnType<typeof JSONFileSyncPreset<DbData>> | null = null

export function getDb(): ReturnType<typeof JSONFileSyncPreset<DbData>> {
  if (!_db) {
    const dir = join(app.getPath('userData'), 'zaptar')
    mkdirSync(dir, { recursive: true })
    _db = JSONFileSyncPreset<DbData>(join(dir, 'connections.json'), defaultData)
    _db.read()
  }
  return _db
}
