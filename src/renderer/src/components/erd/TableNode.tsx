import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Key, Link2 } from 'lucide-react'
import * as React from 'react'

import type { Table } from '@shared/types/schema'
import { cn } from '@renderer/lib/utils'

/**
 * Custom React Flow node that renders a database table.
 *
 * Layout: header bar with table name → one row per column.
 * Each FK column gets its own React Flow `<Handle>` on the left edge so
 * edges originate from / terminate at the exact column row, not the
 * generic node center. PK column rows get a key icon.
 *
 * Handle ID convention: `${columnName}-source` and `${columnName}-target`.
 * The canvas builds edges using these IDs; if a referenced column doesn't
 * exist on the target table, the edge gracefully falls back to the table's
 * default node-center handle.
 */

export type TableNodeData = {
  table: Table
  pkColumns: Set<string>
  fkColumns: Set<string>
}

export const TABLE_NODE_WIDTH = 240
export const TABLE_NODE_HEADER_HEIGHT = 32
export const TABLE_NODE_ROW_HEIGHT = 22

export function tableNodeHeight(table: Table): number {
  return TABLE_NODE_HEADER_HEIGHT + table.columns.length * TABLE_NODE_ROW_HEIGHT
}

// Custom node receives data as React Flow's `NodeProps['data']` which is `unknown`
// in the v12 typings; we cast at the boundary for cleanliness.
export function TableNode({ data }: NodeProps): React.JSX.Element {
  const { table, pkColumns, fkColumns } = data as unknown as TableNodeData

  return (
    <div
      style={{ width: TABLE_NODE_WIDTH }}
      className="rounded-md border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm overflow-hidden"
    >
      {/* Header */}
      <div
        style={{ height: TABLE_NODE_HEADER_HEIGHT }}
        className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-accent)]/40 px-3 text-sm font-semibold"
        title={table.comment || undefined}
      >
        <span className="truncate font-mono">{table.name}</span>
        {table.engine && (
          <span className="ml-auto text-[10px] font-normal uppercase tracking-wide text-[var(--color-muted-foreground)]">
            {table.engine}
          </span>
        )}
      </div>

      {/* Column rows */}
      <ul className="text-xs">
        {table.columns.map((col) => {
          const isPk = pkColumns.has(col.name)
          const isFk = fkColumns.has(col.name)
          return (
            <li
              key={col.name}
              style={{ height: TABLE_NODE_ROW_HEIGHT }}
              className={cn(
                'relative flex items-center gap-1.5 border-b border-[var(--color-border)]/40 px-3 last:border-b-0',
                isPk && 'bg-[var(--color-diff-modified-bg)]/30'
              )}
              title={`${col.name} ${col.dataType}${col.nullable ? '' : ' NOT NULL'}`}
            >
              {/* FK source handle on the right edge of FK rows */}
              {isFk && (
                <Handle
                  type="source"
                  position={Position.Right}
                  id={`${col.name}-source`}
                  style={{ top: '50%', right: -4, width: 8, height: 8 }}
                />
              )}
              {/* Target handle on the left edge of PK rows so incoming FKs
                  attach to the referenced column */}
              {isPk && (
                <Handle
                  type="target"
                  position={Position.Left}
                  id={`${col.name}-target`}
                  style={{ top: '50%', left: -4, width: 8, height: 8 }}
                />
              )}

              {isPk ? (
                <Key className="size-3 shrink-0 text-[var(--color-diff-modified)]" />
              ) : isFk ? (
                <Link2 className="size-3 shrink-0 text-[var(--color-diff-added)]" />
              ) : (
                <span className="size-3 shrink-0" />
              )}
              <span className="truncate font-mono">{col.name}</span>
              <span className="ml-auto truncate font-mono text-[10px] text-[var(--color-muted-foreground)]">
                {col.dataType}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
