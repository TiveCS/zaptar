export type DialectId = 'mysql' | 'mariadb'

export type Connection = {
  id: string
  label: string
  dialect: DialectId
  host: string
  port: number
  username: string
  database: string
  ssl?: { rejectUnauthorized: boolean }
  createdAt: string
  updatedAt: string
}

export type ConnectionDraft = Omit<Connection, 'id' | 'createdAt' | 'updatedAt'> & {
  password: string
}

export type ConnectionTestResult = {
  ok: boolean
  error?: string
  serverVersion?: string
}
