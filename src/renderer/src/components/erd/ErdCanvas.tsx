import dagre from '@dagrejs/dagre'
import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow
} from '@xyflow/react'
import * as React from 'react'

import type { Table } from '@shared/types/schema'

import {
  TableNode,
  type TableNodeData,
  tableNodeHeight,
  tableNodeWidth
} from './TableNode'

import '@xyflow/react/dist/style.css'

type Props = {
  tables: Table[]
  selectedTables: Set<string>
  /** When this changes, center the canvas on the matching table node. */
  focusTable?: string | null
}

/**
 * Cardinality of an FK relationship.
 *
 * Determined by inspecting the referencing (child) table's indexes:
 *  - If the FK column set is covered by a UNIQUE / PRIMARY index → 1:1
 *    (each child row maps to at most one parent and vice versa)
 *  - Otherwise                                                   → N:1
 *    (many child rows can reference the same parent row)
 *
 * The parent (referenced) side is always 1 because FK constraints reference
 * a unique key.
 */
type Cardinality = 'one-to-one' | 'many-to-one'

function detectCardinality(child: Table, fkColumns: string[]): Cardinality {
  const covered = child.indexes.some(
    (idx) =>
      (idx.kind === 'primary' || idx.kind === 'unique') &&
      idx.columns.length === fkColumns.length &&
      idx.columns.every((c, i) => c.columnName === fkColumns[i])
  )
  return covered ? 'one-to-one' : 'many-to-one'
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
  g.setGraph({ rankdir: 'LR', nodesep: 80, ranksep: 200 })
  g.setDefaultEdgeLabel(() => ({}))

  const tableNames = new Set(tables.map((t) => t.name))

  for (const t of tables) {
    // Per-table width — dagre uses this to compute spacing so wide tables
    // don't overlap their neighbors.
    g.setNode(t.name, { width: tableNodeWidth(t), height: tableNodeHeight(t) })
  }
  for (const t of tables) {
    for (const fk of t.foreignKeys) {
      if (fk.referencedTable === t.name) continue
      if (!tableNames.has(fk.referencedTable)) continue
      g.setEdge(fk.referencedTable, t.name)
    }
  }

  dagre.layout(g)
  return new Map(g.nodes().map((n) => [n, g.node(n) as { x: number; y: number }]))
}

const NODE_TYPES = { table: TableNode }

// Edge color palette — different relations get slightly different shades so
// overlapping lines are easier to follow. We hash the source.target pair into
// the palette to keep the assignment stable across re-renders.
const EDGE_COLORS = [
  '#60a5fa', // blue
  '#a78bfa', // violet
  '#34d399', // emerald
  '#fbbf24', // amber
  '#f472b6', // pink
  '#22d3ee', // cyan
  '#fb923c'  // orange
]

function colorFor(key: string): string {
  let hash = 0
  for (let i = 0; i < key.length; i++) hash = (hash * 31 + key.charCodeAt(i)) | 0
  return EDGE_COLORS[Math.abs(hash) % EDGE_COLORS.length]
}

/**
 * Stable info needed to build an edge object — derived once per
 * tables/selection change, then re-styled cheaply on hover.
 */
type EdgeBlueprint = {
  id: string
  source: string
  sourceHandle: string | undefined
  target: string
  targetHandle: string | undefined
  childMarker: string
  parentMarker: string
  baseColor: string
  cardLabel: string
  onDelete: string
}

function buildNodes(tables: Table[], selectedTables: Set<string>): Node[] {
  const visible = tables.filter((t) => selectedTables.has(t.name))
  const positions = layoutTables(visible)
  return visible.map((table) => {
    const pos = positions.get(table.name) ?? { x: 0, y: 0 }
    const pkColumns = new Set<string>(
      (table.indexes.find((i) => i.kind === 'primary')?.columns ?? []).map((c) => c.columnName)
    )
    const fkColumns = new Set<string>(table.foreignKeys.flatMap((fk) => fk.columns))
    const width = tableNodeWidth(table)
    const data: TableNodeData = { table, pkColumns, fkColumns, width }
    return {
      id: table.name,
      type: 'table',
      // Dagre returns node center; React Flow positions by top-left.
      position: { x: pos.x - width / 2, y: pos.y - tableNodeHeight(table) / 2 },
      data: data as unknown as Record<string, unknown>
    }
  })
}

function buildBlueprints(tables: Table[], selectedTables: Set<string>): EdgeBlueprint[] {
  const visible = tables.filter((t) => selectedTables.has(t.name))
  const visibleNames = new Set(visible.map((t) => t.name))
  const out: EdgeBlueprint[] = []
  for (const t of visible) {
    for (const fk of t.foreignKeys) {
      if (!visibleNames.has(fk.referencedTable)) continue
      const id = `${t.name}.${fk.name}`
      const cardinality = detectCardinality(t, fk.columns)
      const childCard = cardinality === 'one-to-one' ? '1' : 'N'
      out.push({
        id,
        source: t.name,
        sourceHandle: fk.columns[0] ? `${fk.columns[0]}-source` : undefined,
        target: fk.referencedTable,
        targetHandle: fk.referencedColumns[0] ? `${fk.referencedColumns[0]}-target` : undefined,
        childMarker: cardinality === 'one-to-one' ? 'erd-one' : 'erd-many',
        parentMarker: 'erd-one',
        baseColor: colorFor(id),
        cardLabel: `${childCard} ${t.name} → 1 ${fk.referencedTable}`,
        onDelete: fk.onDelete
      })
    }
  }
  return out
}

function styleEdges(blueprints: EdgeBlueprint[], hoveredEdge: string | null): Edge[] {
  return blueprints.map((b) => {
    const isHovered = hoveredEdge === b.id
    const isFaded = hoveredEdge !== null && !isHovered
    const stroke = isFaded ? 'var(--color-border)' : isHovered ? '#ef4444' : b.baseColor

    return {
      id: b.id,
      source: b.source,
      sourceHandle: b.sourceHandle,
      target: b.target,
      targetHandle: b.targetHandle,
      type: 'smoothstep',
      // Animate hovered edges so the user can pick out a specific relation
      // even when many overlap.
      animated: isHovered,
      // markerStart attaches to the source side, markerEnd to the target.
      // In our edges source = referencing (child), target = referenced (parent).
      markerStart: b.childMarker,
      markerEnd: b.parentMarker,
      // Always show the compact cardinality label. On hover, append the
      // ON DELETE action if it's not the default — keeps the label short
      // even on long table names.
      label: isFaded
        ? undefined
        : isHovered && b.onDelete !== 'NO ACTION'
          ? `${b.cardLabel}  ·  ON DELETE ${b.onDelete}`
          : b.cardLabel,
      labelStyle: { fontSize: isHovered ? 11 : 10, fontWeight: 600, fill: stroke },
      labelBgStyle: { fill: 'var(--color-card)', fillOpacity: 0.95 },
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
      style: {
        stroke,
        strokeWidth: isHovered ? 2.5 : 1.5,
        opacity: isFaded ? 0.25 : 1
      },
      // zIndex bumps hovered edges to front so they aren't visually buried
      // by adjacent overlapping lines.
      zIndex: isHovered ? 1000 : 0
    }
  })
}

/**
 * Custom SVG markers for crow's foot notation. Defined once at canvas root
 * and referenced by edge `markerStart` / `markerEnd` IDs.
 *
 *  erd-one  — single perpendicular bar (||)            → "exactly one"
 *  erd-many — three-pronged crow's foot                → "many"
 */
function CardinalityMarkers(): React.JSX.Element {
  // SVG2 `context-stroke` makes the marker inherit the stroke color of the
  // path that uses it. Without this, `currentColor` falls back to the document
  // text color (which would make every crow's foot the same color regardless
  // of which edge it belongs to).
  //
  // refX positions the marker so it sits just outside the node edge — too
  // small a value clips the marker behind the table; too large floats it
  // away from the node.
  const strokeAttr = { stroke: 'context-stroke', strokeWidth: 2, fill: 'none' } as const
  return (
    <svg
      style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, overflow: 'visible' }}
      aria-hidden
    >
      <defs>
        <marker
          id="erd-one"
          viewBox="0 0 24 24"
          refX="22"
          refY="12"
          markerWidth="24"
          markerHeight="24"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <line x1="14" y1="4" x2="14" y2="20" {...strokeAttr} />
          <line x1="20" y1="4" x2="20" y2="20" {...strokeAttr} />
        </marker>
        <marker
          id="erd-many"
          viewBox="0 0 24 24"
          refX="22"
          refY="12"
          markerWidth="24"
          markerHeight="24"
          markerUnits="userSpaceOnUse"
          orient="auto-start-reverse"
        >
          <line x1="4" y1="12" x2="22" y2="12" {...strokeAttr} />
          <line x1="4" y1="12" x2="22" y2="4" {...strokeAttr} />
          <line x1="4" y1="12" x2="22" y2="20" {...strokeAttr} />
        </marker>
      </defs>
    </svg>
  )
}

/**
 * Inner component that lives inside <ReactFlowProvider> so it can use
 * `useReactFlow`. Watches the `focusTable` prop and centers the viewport on
 * the matching node when it changes.
 */
function FocusController({
  focusTable,
  nodes
}: {
  focusTable: string | null | undefined
  nodes: Node[]
}): null {
  const rf = useReactFlow()

  // Hold `nodes` in a ref so the effect doesn't re-fire when the array
  // reference changes for unrelated reasons (e.g. an edge hover triggers a
  // graph rebuild). Without this, hovering an edge after jumping to a table
  // re-runs the effect and snaps the viewport back to the last focused node.
  const nodesRef = React.useRef(nodes)
  nodesRef.current = nodes

  // Effect depends ONLY on focusTable — the nonce in the prop string ensures
  // a new jump request triggers a re-render with a fresh value. Same string
  // means "no new jump request"; we don't recenter.
  React.useEffect(() => {
    if (!focusTable) return
    const tableName = focusTable.split('#')[0]
    const node = nodesRef.current.find((n) => n.id === tableName)
    if (!node) return
    const w = (node.width ?? 260) as number
    const h = (node.height ?? 100) as number
    rf.setCenter(node.position.x + w / 2, node.position.y + h / 2, {
      zoom: 1.2,
      duration: 400
    })
  }, [focusTable, rf])

  return null
}

export function ErdCanvas({ tables, selectedTables, focusTable }: Props): React.JSX.Element {
  const [hoveredEdge, setHoveredEdge] = React.useState<string | null>(null)

  // Nodes depend only on schema/selection — hover state must NOT trigger a
  // node rebuild because that re-runs dagre layout and re-mounts every
  // <TableNode>, causing a visible blink/flash.
  const nodes = React.useMemo(
    () => buildNodes(tables, selectedTables),
    [tables, selectedTables]
  )

  // Edge blueprints likewise depend only on schema/selection. Hovering an
  // edge only re-derives the cheap styling pass below.
  const blueprints = React.useMemo(
    () => buildBlueprints(tables, selectedTables),
    [tables, selectedTables]
  )

  // Hover-driven re-style is a simple `.map` over stable blueprints. No
  // layout work, no node remount, no flash.
  const edges = React.useMemo(
    () => styleEdges(blueprints, hoveredEdge),
    [blueprints, hoveredEdge]
  )

  if (nodes.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-center">
        <p className="text-sm font-medium">No tables shown</p>
        <p className="max-w-xs text-xs text-[var(--color-muted-foreground)]">
          Pick tables from the sidebar to render them on the canvas. Click the branch icon
          on a table to add it together with its FK neighbors.
        </p>
      </div>
    )
  }

  return (
    <ReactFlowProvider>
      <CardinalityMarkers />
      <div
        className="h-full w-full"
        // Belt-and-braces hover cleanup. React Flow's onEdgeMouseLeave can miss
        // events when overlapping edges or rapid cursor moves cause enter/leave
        // to fire out of order. Mouse leaving the entire wrapper resets state.
        onMouseLeave={() => setHoveredEdge(null)}
      >
        <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={NODE_TYPES}
          fitView
          minZoom={0.1}
          maxZoom={2}
          // colorMode="dark" applies React Flow's built-in dark theme to
          // Controls, MiniMap, and Background. Without this they ship as
          // bright-white widgets that look broken on a dark canvas. Custom
          // CSS overrides in main.css fine-tune colors to match the app.
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          onEdgeMouseEnter={(_, edge) => setHoveredEdge(edge.id)}
          onEdgeMouseLeave={() => setHoveredEdge(null)}
          // onPaneMouseMove was removed — it fires on every mousemove inside
          // the React Flow pane (including over edges), which made the hover
          // state revert immediately after onEdgeMouseEnter set it. The
          // wrapper's onMouseLeave + onPaneClick already cover the rare case
          // where onEdgeMouseLeave misses.
          onPaneClick={() => setHoveredEdge(null)}
          defaultEdgeOptions={{ type: 'smoothstep' }}
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
          <FocusController focusTable={focusTable ?? null} nodes={nodes} />
        </ReactFlow>
      </div>
    </ReactFlowProvider>
  )
}
