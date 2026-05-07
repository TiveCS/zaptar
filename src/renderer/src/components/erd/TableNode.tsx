import { Handle, Position, type NodeProps } from '@xyflow/react'
import { Key, Link2 } from 'lucide-react'
import * as React from 'react'

import type { Table } from '@shared/types/schema'
import { cn } from '@renderer/lib/utils'

/**
 * Custom React Flow node that renders a database table.
 *
 * Layout: header bar with table name → one row per column.
 * Each FK column gets its own React Flow `<Handle>` on the right edge so
 * edges originate from the exact column row, not the generic node center.
 * Each PK column gets a target handle on the left so incoming FKs connect to
 * the referenced column visually.
 *
 * Width is computed by `tableNodeWidth()` based on the longest content (table
 * name vs. longest "column + type + flags" line) so long-named tables don't
 * truncate to ellipsis.
 */

export type TableNodeData = {
  table: Table
  pkColumns: Set<string>
  fkColumns: Set<string>
  width: number
}

export const TABLE_NODE_HEADER_HEIGHT = 32
export const TABLE_NODE_ROW_HEIGHT = 24

const MIN_WIDTH = 260
const MAX_WIDTH = 460
// Estimated px per monospace character at the body font size (text-xs).
const CHAR_PX = 7
// Header font is slightly larger.
const HEADER_CHAR_PX = 8.5
// Reserved space for icons + padding + gap on each row.
const ROW_CHROME_PX = 60
const HEADER_CHROME_PX = 60

/** Format the type+flags suffix shown on the right side of each column row. */
export function formatTypeSuffix(col: Table['columns'][number]): string {
  let s = col.dataType
  if (col.nullable) s += ' ?'
  if (col.default !== null) s += ` = ${col.default}`
  return s
}

/** Pick a width that fits the longest header / row content for this table. */
export function tableNodeWidth(table: Table): number {
  const headerPx = table.name.length * HEADER_CHAR_PX + HEADER_CHROME_PX
  const rowPx = Math.max(
    0,
    ...table.columns.map((c) => (c.name.length + formatTypeSuffix(c).length) * CHAR_PX)
  ) + ROW_CHROME_PX
  return Math.max(MIN_WIDTH, Math.min(MAX_WIDTH, Math.max(headerPx, rowPx)))
}

export function tableNodeHeight(table: Table): number {
  return TABLE_NODE_HEADER_HEIGHT + table.columns.length * TABLE_NODE_ROW_HEIGHT
}

export function TableNode({ data }: NodeProps): React.JSX.Element {
  const { table, pkColumns, fkColumns, width } = data as unknown as TableNodeData

  return (
    <div
      style={{ width }}
      className="overflow-hidden rounded-md border border-[var(--color-border)] bg-[var(--color-card)] shadow-sm"
    >
      {/* Header — full table name, no ellipsis. Width is sized so it fits. */}
      <div
        style={{ height: TABLE_NODE_HEADER_HEIGHT }}
        className="flex items-center gap-2 border-b border-[var(--color-border)] bg-[var(--color-accent)]/40 px-3 text-sm font-semibold"
        title={table.comment || undefined}
      >
        <span className="font-mono">{table.name}</span>
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
          const tooltip = [
            `${col.name} ${col.dataType}`,
            col.nullable ? 'NULL' : 'NOT NULL',
            col.default !== null ? `DEFAULT ${col.default}` : null,
            col.comment ? `// ${col.comment}` : null
          ]
            .filter(Boolean)
            .join(' · ')
          return (
            <li
              key={col.name}
              style={{ height: TABLE_NODE_ROW_HEIGHT }}
              className={cn(
                'relative flex items-center gap-1.5 border-b border-[var(--color-border)]/40 px-3 last:border-b-0',
                isPk && 'bg-[var(--color-diff-modified-bg)]/30'
              )}
              title={tooltip}
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
              {/* Target handle on the left edge of PK rows */}
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
              <span className="font-mono">{col.name}</span>
              <span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-[var(--color-muted-foreground)]">
                <span>{col.dataType}</span>
                {col.nullable && (
                  <span
                    title="Nullable"
                    className="rounded-sm bg-[var(--color-muted)] px-1 text-[9px] font-semibold text-[var(--color-muted-foreground)]"
                  >
                    NULL
                  </span>
                )}
                {col.default !== null && (
                  <span
                    title={`DEFAULT ${col.default}`}
                    className="max-w-[80px] truncate rounded-sm bg-[var(--color-diff-added-bg)]/40 px-1 text-[9px] font-semibold text-[var(--color-diff-added)]"
                  >
                    = {col.default}
                  </span>
                )}
              </span>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
