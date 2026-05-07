import dagre from '@dagrejs/dagre'
import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider
} from '@xyflow/react'
import * as React from 'react'

import type { Table } from '@shared/types/schema'

import {
  TABLE_NODE_WIDTH,
  TableNode,
  type TableNodeData,
  tableNodeHeight
} from './TableNode'

import '@xyflow/react/dist/style.css'

type Props = {
  tables: Table[]
  selectedTables: Set<string>
}

/**
 * Run dagre layout on the visible table set. Produces an `{x, y}` per table.
 *
 * `rankdir: 'LR'` lays out FKs left-to-right (referenced tables on the left,
 * referencing tables on the right) which mirrors common ERD convention. We use
 * the actual rendered node height per table so dagre's `ranksep` and `nodesep`
 * give visually balanced spacing regardless of table column count.
 */
function layoutTables(tables: Table[]): Map<string, { x: number; y: number }> {
  const g = new dagre.graphlib.Graph()
  g.setGraph({ rankdir: 'LR', nodesep: 60, ranksep: 140 })
  g.setDefaultEdgeLabel(() => ({}))

  const tableNames = new Set(tables.map((t) => t.name))

  for (const t of tables) {
    g.setNode(t.name, { width: TABLE_NODE_WIDTH, height: tableNodeHeight(t) })
  }
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      // Skip self-references and edges to filtered-out tables — dagre would
      // otherwise place them in odd ranks.
      if (fk.referencedTable === t.name) continue
      if (!tableNames.has(fk.referencedTable)) continue
      // Edge direction: from referenced (PK side) to referencing (FK side)
      // so dagre puts parent tables on the left rank.
      g.setEdge(fk.referencedTable, t.name)
    }
  }

  dagre.layout(g)
  return new Map(g.nodes().map((n) => [n, g.node(n) as { x: number; y: number }]))
}

const NODE_TYPES = { table: TableNode }

function buildGraph(tables: Table[], selectedTables: Set<string>): { nodes: Node[]; edges: Edge[] } {
  const visible = tables.filter((t) => selectedTables.has(t.name))
  const positions = layoutTables(visible)
  const visibleNames = new Set(visible.map((t) => t.name))

  const nodes: Node[] = visible.map((table) => {
    const pos = positions.get(table.name) ?? { x: 0, y: 0 }
    const pkColumns = new Set<string>(
      (table.indexes.find((i) => i.kind === 'primary')?.columns ?? []).map((c) => c.columnName)
    )
    const fkColumns = new Set<string>(table.foreignKeys.flatMap((fk) => fk.columns))
    const data: TableNodeData = { table, pkColumns, fkColumns }
    return {
      id: table.name,
      type: 'table',
      // Dagre returns the node center; React Flow positions by top-left.
      position: { x: pos.x - TABLE_NODE_WIDTH / 2, y: pos.y - tableNodeHeight(table) / 2 },
      data: data as unknown as Record<string, unknown>
    }
  })

  const edges: Edge[] = []
  for (const t of visible) {
    for (const fk of t.foreignKeys) {
      if (!visibleNames.has(fk.referencedTable)) continue
      // One edge per (table, fk). Use first column on each side for the handle
      // since multi-column FKs are rare in app schemas; the visual edge still
      // reads correctly.
      const sourceCol = fk.columns[0]
      const targetCol = fk.referencedColumns[0]
      edges.push({
        id: `${t.name}.${fk.name}`,
        source: t.name,
        sourceHandle: sourceCol ? `${sourceCol}-source` : undefined,
        target: fk.referencedTable,
        targetHandle: targetCol ? `${targetCol}-target` : undefined,
        label: fk.onDelete !== 'NO ACTION' ? `ON DELETE ${fk.onDelete}` : undefined,
        labelStyle: { fontSize: 10, fill: 'var(--color-muted-foreground)' },
        labelBgStyle: { fill: 'var(--color-card)' },
        style: { stroke: 'var(--color-muted-foreground)', strokeWidth: 1.5 }
      })
    }
  }

  return { nodes, edges }
}

export function ErdCanvas({ tables, selectedTables }: Props): React.JSX.Element {
  // Recompute graph whenever the selection or schema changes. layout is fast
  // enough for hundreds of tables; if performance becomes an issue switch to
  // an incremental layout (dagre-incremental).
  const { nodes, edges } = React.useMemo(
    () => buildGraph(tables, selectedTables),
    [tables, selectedTables]
  )

  if (nodes.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-[var(--color-muted-foreground)]">
        No tables selected.
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={16} size={1} />
        <Controls position="bottom-left" />
        <MiniMap
          position="bottom-right"
          pannable
          zoomable
          nodeColor="var(--color-accent)"
          maskColor="rgb(0 0 0 / 0.5)"
        />
      </ReactFlow>
    </ReactFlowProvider>
  )
}
