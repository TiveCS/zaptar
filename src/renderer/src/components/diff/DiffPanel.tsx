import * as React from 'react'

import type { Change, FieldDiff, SchemaDiff, TableDiff } from '@shared/types'
import type { CheckConstraint, Column, ForeignKey, Index, Table } from '@shared/types/schema'
import { cn } from '@renderer/lib/utils'

type Section = 'columns' | 'indexes' | 'fks' | 'checks' | 'options'

// ── Cell coloring ────────────────────────────────────────────────────────────

type ChangeKind = 'added' | 'removed' | 'modified' | 'unchanged'

const ROW_BG: Record<ChangeKind, string> = {
  added: 'bg-[var(--color-diff-added-bg)]',
  removed: 'bg-[var(--color-destructive)]/8',
  modified: 'bg-[var(--color-diff-modified-bg)]',
  unchanged: ''
}
const ROW_TEXT: Record<ChangeKind, string> = {
  added: 'text-[var(--color-diff-added)]',
  removed: 'text-[var(--color-diff-removed)]',
  modified: 'text-[var(--color-diff-modified)]',
  unchanged: 'text-[var(--color-muted-foreground)]'
}

// ── Formatters ───────────────────────────────────────────────────────────────

function fmtColumn(c: Column): string {
  const parts = [c.dataType]
  parts.push(c.nullable ? 'NULL' : 'NOT NULL')
  if (c.default !== null) parts.push(`DEFAULT ${c.default}`)
  if (c.extra) parts.push(c.extra)
  if (c.comment) parts.push(`/* ${c.comment} */`)
  return parts.join('  ')
}

function fmtIndex(idx: Index): string {
  const cols = idx.columns
    .map((c) => `${c.columnName}${c.subPart ? `(${c.subPart})` : ''}`)
    .join(', ')
  const kindLabel = idx.kind === 'primary' ? 'PRIMARY' : idx.kind.toUpperCase()
  return `${kindLabel}  (${cols})${idx.using ? `  USING ${idx.using}` : ''}`
}

function fmtFk(fk: ForeignKey): string {
  return `(${fk.columns.join(', ')}) → ${fk.referencedTable}(${fk.referencedColumns.join(', ')})  ON UPDATE ${fk.onUpdate}  ON DELETE ${fk.onDelete}`
}

function fmtCheck(cc: CheckConstraint): string {
  return `${cc.expression}${cc.enforced ? '' : '  [NOT ENFORCED]'}`
}

// ── Shared diff-row component ────────────────────────────────────────────────

function DiffRow({
  name,
  kind,
  srcText,
  tgtText,
  fieldDiffs
}: {
  name: string
  kind: ChangeKind
  srcText: string
  tgtText: string
  fieldDiffs?: FieldDiff[]
}): React.JSX.Element {
  const hasFields = fieldDiffs && fieldDiffs.length > 0
  return (
    <tr className={cn('border-b border-[var(--color-border)]/50', ROW_BG[kind])}>
      <td
        className={cn(
          'w-32 shrink-0 py-1.5 pl-3 pr-2 font-mono text-xs font-semibold',
          ROW_TEXT[kind]
        )}
      >
        {name}
      </td>
      <td className="py-1.5 pr-2 font-mono text-xs">
        {srcText ? (
          <span className={cn(kind === 'added' ? ROW_TEXT['added'] : '')}>{srcText}</span>
        ) : (
          <span className="text-[var(--color-muted-foreground)]/40">—</span>
        )}
      </td>
      <td className="py-1.5 pr-3 font-mono text-xs">
        {tgtText ? (
          <span
            className={cn(
              kind === 'removed'
                ? ROW_TEXT['removed']
                : kind === 'modified'
                  ? 'line-through opacity-60'
                  : ''
            )}
          >
            {tgtText}
          </span>
        ) : (
          <span className="text-[var(--color-muted-foreground)]/40">—</span>
        )}
        {hasFields && (
          <span className="ml-2 rounded bg-[var(--color-diff-modified-bg)] px-1 py-0.5 text-[10px] text-[var(--color-diff-modified)]">
            {fieldDiffs!.map((fd) => fd.field).join(', ')}
          </span>
        )}
      </td>
    </tr>
  )
}

function DiffTable({ children }: { children: React.ReactNode }): React.JSX.Element {
  return (
    <div className="overflow-x-auto rounded-md border border-[var(--color-border)]">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-[var(--color-border)] bg-[var(--color-muted)]/40">
            <th className="py-1.5 pl-3 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-muted-foreground)]">
              Name
            </th>
            <th className="py-1.5 pr-2 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-diff-added)]">
              Source (new)
            </th>
            <th className="py-1.5 pr-3 text-left text-xs font-semibold uppercase tracking-wide text-[var(--color-diff-removed)]">
              Target (old)
            </th>
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  )
}

// ── Section renderers ────────────────────────────────────────────────────────

function ColumnsSection({ changes }: { changes: Change<Column>[] }): React.JSX.Element {
  // Merge: all names that appear in either side, preserving order
  const names = new Map<string, Change<Column>>()
  for (const ch of changes) {
    const name =
      ch.kind === 'added' ? ch.after.name : ch.kind === 'removed' ? ch.before.name : ch.before.name
    names.set(name, ch)
  }

  if (names.size === 0) {
    return (
      <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
        No column changes
      </p>
    )
  }

  return (
    <DiffTable>
      {Array.from(names.entries()).map(([name, ch]) => {
        if (ch.kind === 'added')
          return (
            <DiffRow key={name} name={name} kind="added" srcText={fmtColumn(ch.after)} tgtText="" />
          )
        if (ch.kind === 'removed')
          return (
            <DiffRow
              key={name}
              name={name}
              kind="removed"
              srcText=""
              tgtText={fmtColumn(ch.before)}
            />
          )
        // modified
        return (
          <DiffRow
            key={name}
            name={name}
            kind="modified"
            srcText={fmtColumn(ch.after)}
            tgtText={fmtColumn(ch.before)}
            fieldDiffs={ch.kind === 'modified' ? ch.fieldDiffs : undefined}
          />
        )
      })}
    </DiffTable>
  )
}

function IndexesSection({ changes }: { changes: Change<Index>[] }): React.JSX.Element {
  if (changes.length === 0)
    return (
      <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
        No index changes
      </p>
    )

  return (
    <DiffTable>
      {changes.map((ch) => {
        if (ch.kind === 'added')
          return (
            <DiffRow
              key={ch.after.name}
              name={ch.after.name}
              kind="added"
              srcText={fmtIndex(ch.after)}
              tgtText=""
            />
          )
        if (ch.kind === 'removed')
          return (
            <DiffRow
              key={ch.before.name}
              name={ch.before.name}
              kind="removed"
              srcText=""
              tgtText={fmtIndex(ch.before)}
            />
          )
        return (
          <DiffRow
            key={ch.before.name}
            name={ch.before.name}
            kind="modified"
            srcText={fmtIndex(ch.after)}
            tgtText={fmtIndex(ch.before)}
            fieldDiffs={ch.kind === 'modified' ? ch.fieldDiffs : undefined}
          />
        )
      })}
    </DiffTable>
  )
}

function FksSection({ changes }: { changes: Change<ForeignKey>[] }): React.JSX.Element {
  if (changes.length === 0)
    return (
      <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
        No foreign key changes
      </p>
    )

  return (
    <DiffTable>
      {changes.map((ch) => {
        if (ch.kind === 'added')
          return (
            <DiffRow
              key={ch.after.name}
              name={ch.after.name}
              kind="added"
              srcText={fmtFk(ch.after)}
              tgtText=""
            />
          )
        if (ch.kind === 'removed')
          return (
            <DiffRow
              key={ch.before.name}
              name={ch.before.name}
              kind="removed"
              srcText=""
              tgtText={fmtFk(ch.before)}
            />
          )
        return (
          <DiffRow
            key={ch.before.name}
            name={ch.before.name}
            kind="modified"
            srcText={fmtFk(ch.after)}
            tgtText={fmtFk(ch.before)}
            fieldDiffs={ch.kind === 'modified' ? ch.fieldDiffs : undefined}
          />
        )
      })}
    </DiffTable>
  )
}

function ChecksSection({ changes }: { changes: Change<CheckConstraint>[] }): React.JSX.Element {
  if (changes.length === 0)
    return (
      <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
        No check constraint changes
      </p>
    )

  return (
    <DiffTable>
      {changes.map((ch) => {
        if (ch.kind === 'added')
          return (
            <DiffRow
              key={ch.after.name}
              name={ch.after.name}
              kind="added"
              srcText={fmtCheck(ch.after)}
              tgtText=""
            />
          )
        if (ch.kind === 'removed')
          return (
            <DiffRow
              key={ch.before.name}
              name={ch.before.name}
              kind="removed"
              srcText=""
              tgtText={fmtCheck(ch.before)}
            />
          )
        return (
          <DiffRow
            key={ch.before.name}
            name={ch.before.name}
            kind="modified"
            srcText={fmtCheck(ch.after)}
            tgtText={fmtCheck(ch.before)}
            fieldDiffs={ch.kind === 'modified' ? ch.fieldDiffs : undefined}
          />
        )
      })}
    </DiffTable>
  )
}

function OptionsSection({ td }: { td: TableDiff }): React.JSX.Element {
  if (td.optionChanges.length === 0)
    return (
      <p className="py-4 text-center text-sm text-[var(--color-muted-foreground)]">
        No table option changes
      </p>
    )

  return (
    <DiffTable>
      {td.optionChanges.map((oc) => (
        <DiffRow
          key={oc.key}
          name={oc.key}
          kind="modified"
          srcText={oc.to ?? ''}
          tgtText={oc.from ?? ''}
        />
      ))}
    </DiffTable>
  )
}

// ── Whole-table display for added/removed tables ─────────────────────────────

function TableSnapshot({
  table,
  kind
}: {
  table: Table
  kind: 'added' | 'removed'
}): React.JSX.Element {
  return (
    <div className="space-y-4">
      <DiffTable>
        {table.columns.map((col) => (
          <DiffRow
            key={col.name}
            name={col.name}
            kind={kind}
            srcText={kind === 'added' ? fmtColumn(col) : ''}
            tgtText={kind === 'removed' ? fmtColumn(col) : ''}
          />
        ))}
      </DiffTable>
    </div>
  )
}

// ── Main DiffPanel ───────────────────────────────────────────────────────────

type Props = {
  diff: SchemaDiff
  tableName: string
}

const SECTIONS: { key: Section; label: string }[] = [
  { key: 'columns', label: 'Columns' },
  { key: 'indexes', label: 'Indexes' },
  { key: 'fks', label: 'Foreign Keys' },
  { key: 'checks', label: 'Check Constraints' },
  { key: 'options', label: 'Table Options' }
]

export function DiffPanel({ diff, tableName }: Props): React.JSX.Element {
  const [section, setSection] = React.useState<Section>('columns')

  // Classify the table
  const addedTable = diff.addedTables.find((t) => t.name === tableName)
  const removedTable = diff.removedTables.find((t) => t.name === tableName)
  const modifiedTable = diff.modifiedTables.find((t) => t.name === tableName)
  const isUnchanged = diff.unchangedTables.includes(tableName)

  const changeKind: ChangeKind = addedTable
    ? 'added'
    : removedTable
      ? 'removed'
      : modifiedTable
        ? 'modified'
        : 'unchanged'

  const kindLabel: Record<ChangeKind, string> = {
    added: 'Added',
    removed: 'Removed',
    modified: 'Modified',
    unchanged: 'Unchanged'
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Title bar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-3">
        <span className="font-mono font-semibold">{tableName}</span>
        <span
          className={cn(
            'rounded-full px-2 py-0.5 text-xs font-medium',
            ROW_BG[changeKind],
            ROW_TEXT[changeKind]
          )}
        >
          {kindLabel[changeKind]}
        </span>
        {modifiedTable && (
          <span className="text-xs text-[var(--color-muted-foreground)]">
            {[
              modifiedTable.columns.length > 0 &&
                `${modifiedTable.columns.length} column change${modifiedTable.columns.length > 1 ? 's' : ''}`,
              modifiedTable.indexes.length > 0 &&
                `${modifiedTable.indexes.length} index change${modifiedTable.indexes.length > 1 ? 's' : ''}`,
              modifiedTable.foreignKeys.length > 0 &&
                `${modifiedTable.foreignKeys.length} FK change${modifiedTable.foreignKeys.length > 1 ? 's' : ''}`
            ]
              .filter(Boolean)
              .join(' · ')}
          </span>
        )}
      </div>

      {/* Section tabs (only for modified) */}
      {modifiedTable && (
        <div className="flex gap-0 border-b border-[var(--color-border)]">
          {SECTIONS.map(({ key, label }) => {
            const count =
              key === 'columns'
                ? modifiedTable.columns.length
                : key === 'indexes'
                  ? modifiedTable.indexes.length
                  : key === 'fks'
                    ? modifiedTable.foreignKeys.length
                    : key === 'checks'
                      ? modifiedTable.checkConstraints.length
                      : modifiedTable.optionChanges.length
            return (
              <button
                key={key}
                onClick={() => setSection(key)}
                className={cn(
                  'flex items-center gap-1.5 border-b-2 px-4 py-2 text-sm transition-colors',
                  section === key
                    ? 'border-[var(--color-foreground)] font-medium text-[var(--color-foreground)]'
                    : 'border-transparent text-[var(--color-muted-foreground)] hover:text-[var(--color-foreground)]'
                )}
              >
                {label}
                {count > 0 && (
                  <span
                    className={cn(
                      'rounded-full px-1.5 py-0.5 text-xs',
                      section === key ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-muted)]'
                    )}
                  >
                    {count}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto p-6">
        {addedTable && (
          <div>
            <p className="mb-3 text-sm text-[var(--color-muted-foreground)]">
              This table is new in source — it will be created in target.
            </p>
            <TableSnapshot table={addedTable} kind="added" />
          </div>
        )}
        {removedTable && (
          <div>
            <p className="mb-3 text-sm text-[var(--color-destructive)]">
              ⚠ This table exists in target but not in source — it will be dropped.
            </p>
            <TableSnapshot table={removedTable} kind="removed" />
          </div>
        )}
        {modifiedTable && (
          <>
            {section === 'columns' && <ColumnsSection changes={modifiedTable.columns} />}
            {section === 'indexes' && <IndexesSection changes={modifiedTable.indexes} />}
            {section === 'fks' && <FksSection changes={modifiedTable.foreignKeys} />}
            {section === 'checks' && <ChecksSection changes={modifiedTable.checkConstraints} />}
            {section === 'options' && <OptionsSection td={modifiedTable} />}
          </>
        )}
        {isUnchanged && (
          <p className="py-8 text-center text-sm text-[var(--color-muted-foreground)]">
            This table is identical in both databases — no changes.
          </p>
        )}
      </div>
    </div>
  )
}
