export type DataRow = Record<string, string | number | boolean | null>

export type DataTableDiff = {
  tableName: string
  keyColumns: string[]
  columns: string[] // ordered column names for rendering
  added: DataRow[]
  removed: DataRow[]
  modified: { key: DataRow; before: DataRow; after: DataRow }[]
  rowsFetched: { source: number; target: number }
  capped: boolean // true if either side hit the row limit
  limit: number
}
