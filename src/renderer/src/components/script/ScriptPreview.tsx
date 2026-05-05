import { AlertTriangle, ChevronDown, ChevronRight, Copy, Save } from 'lucide-react'
import * as React from 'react'

import type { MigrationScript, Statement } from '@shared/types'
import { Button } from '@renderer/components/ui/button'
import { api } from '@renderer/lib/api'
import { cn } from '@renderer/lib/utils'

const KIND_LABEL: Record<Statement['kind'], string> = {
  preamble: 'Preamble',
  postamble: 'Postamble',
  drop_foreign_key: 'Drop FK',
  drop_table: 'Drop Table',
  drop_index: 'Drop Index',
  create_table: 'Create Table',
  alter_table_add_column: 'Add Column',
  alter_table_drop_column: 'Drop Column',
  alter_table_modify_column: 'Modify Column',
  alter_table_add_index: 'Add Index',
  alter_table_drop_index: 'Drop Index',
  alter_table_add_foreign_key: 'Add FK',
  alter_table_options: 'Table Options',
  alter_table_check_add: 'Add Check',
  alter_table_check_drop: 'Drop Check'
}

// ── SQL syntax tokenizer ─────────────────────────────────────────────────────

type TokenType = 'keyword' | 'type' | 'string' | 'number' | 'comment' | 'identifier' | 'default'

const KEYWORDS = new Set([
  'ADD', 'ALL', 'ALTER', 'AND', 'AS', 'AUTO_INCREMENT',
  'BEGIN', 'BETWEEN', 'BY',
  'CASCADE', 'CASE', 'CHARACTER', 'CHARSET', 'CHECK', 'COLLATE', 'COLUMN',
  'COMMENT', 'COMMIT', 'CONSTRAINT', 'CREATE', 'CROSS',
  'DATABASE', 'DEFAULT', 'DELETE', 'DISTINCT', 'DROP',
  'EACH', 'ELSE', 'END', 'ENGINE', 'EXISTS',
  'FOR', 'FOREIGN', 'FROM', 'FULL', 'FUNCTION',
  'GROUP',
  'HAVING',
  'IF', 'IN', 'INDEX', 'INNER', 'INSERT', 'INTO', 'IS',
  'JOIN',
  'KEY',
  'LEFT', 'LIKE', 'LIMIT', 'LOCK',
  'MODIFY',
  'NO', 'NOT', 'NULL',
  'OFFSET', 'ON', 'OR', 'ORDER', 'OUTER',
  'PARTITION', 'PRIMARY', 'PROCEDURE',
  'REFERENCES', 'RENAME', 'RESTRICT', 'RETURN', 'RETURNS', 'RIGHT', 'ROLLBACK',
  'ROW_FORMAT',
  'SCHEMA', 'SELECT', 'SET', 'SHOW',
  'TABLE', 'TABLES', 'THEN', 'TO', 'TRANSACTION', 'TRIGGER',
  'UNION', 'UNIQUE', 'UNSIGNED', 'UPDATE', 'USE', 'USING',
  'VALUES', 'VIEW',
  'WHEN', 'WHERE', 'WITH',
  'ZEROFILL'
])

const TYPES = new Set([
  'BIGINT', 'BINARY', 'BIT', 'BLOB', 'BOOL', 'BOOLEAN',
  'CHAR', 'DATE', 'DATETIME', 'DECIMAL', 'DOUBLE',
  'ENUM', 'FLOAT', 'GEOMETRY',
  'INT', 'INTEGER', 'JSON',
  'LINESTRING', 'LONGBLOB', 'LONGTEXT',
  'MEDIUMBLOB', 'MEDIUMINT', 'MEDIUMTEXT',
  'NUMERIC', 'POINT', 'POLYGON',
  'SMALLINT', 'TEXT', 'TIME', 'TIMESTAMP', 'TINYBLOB',
  'TINYINT', 'TINYTEXT',
  'VARBINARY', 'VARCHAR', 'YEAR'
])

interface Token { type: TokenType; value: string }

function tokenizeSql(code: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < code.length) {
    // -- line comment
    if (code[i] === '-' && code[i + 1] === '-') {
      const end = code.indexOf('\n', i)
      const v = end === -1 ? code.slice(i) : code.slice(i, end)
      out.push({ type: 'comment', value: v }); i += v.length; continue
    }
    // /* block comment */
    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const v = end === -1 ? code.slice(i) : code.slice(i, end + 2)
      out.push({ type: 'comment', value: v }); i += v.length; continue
    }
    // 'string'
    if (code[i] === "'") {
      let j = i + 1
      while (j < code.length) { if (code[j] === "'" && code[j - 1] !== '\\') { j++; break }; j++ }
      out.push({ type: 'string', value: code.slice(i, j) }); i = j; continue
    }
    // `identifier`
    if (code[i] === '`') {
      const end = code.indexOf('`', i + 1)
      const v = end === -1 ? code.slice(i) : code.slice(i, end + 1)
      out.push({ type: 'identifier', value: v }); i += v.length; continue
    }
    // number
    if (/[0-9]/.test(code[i])) {
      let j = i
      while (j < code.length && /[0-9.]/.test(code[j])) j++
      out.push({ type: 'number', value: code.slice(i, j) }); i = j; continue
    }
    // word → keyword / type / plain
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++
      const word = code.slice(i, j)
      const up = word.toUpperCase()
      const type: TokenType = KEYWORDS.has(up) ? 'keyword' : TYPES.has(up) ? 'type' : 'default'
      out.push({ type, value: word }); i = j; continue
    }
    // everything else (punctuation, whitespace, newlines)
    out.push({ type: 'default', value: code[i] }); i++
  }
  return out
}

// VS Code Dark+ matching colors
const TOKEN_COLOR: Record<TokenType, string> = {
  keyword:    '#569CD6',
  type:       '#4EC9B0',
  string:     '#CE9178',
  number:     '#B5CEA8',
  comment:    '#6A9955',
  identifier: '#9CDCFE',
  default:    '#9E9E9E'
}

function SqlCode({ code }: { code: string }): React.JSX.Element {
  const tokens = React.useMemo(() => tokenizeSql(code), [code])
  return (
    <pre className="overflow-x-auto px-4 pb-3 pt-0 font-mono text-xs leading-relaxed">
      {tokens.map((tok, i) => (
        <span key={i} style={{ color: TOKEN_COLOR[tok.type] }}>{tok.value}</span>
      ))}
    </pre>
  )
}

// ── Main component ───────────────────────────────────────────────────────────

type Props = {
  script: MigrationScript
}

export function ScriptPreview({ script }: Props): React.JSX.Element {
  const [copyDone, setCopyDone] = React.useState(false)
  const [saveMsg, setSaveMsg] = React.useState<string | null>(null)
  const [warningsOpen, setWarningsOpen] = React.useState(false)

  const dangerous = script.statements.filter((s) => s.destructive)
  const mainStatements = script.statements.filter(
    (s) => s.kind !== 'preamble' && s.kind !== 'postamble'
  )

  async function handleCopy(): Promise<void> {
    await api.script.copy(script)
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2000)
  }

  async function handleSave(): Promise<void> {
    const result = await api.script.save(script)
    if (result.path) {
      setSaveMsg(`Saved to ${result.path}`)
      setTimeout(() => setSaveMsg(null), 4000)
    }
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-3 border-b border-[var(--color-border)] px-6 py-3">
        <div className="flex flex-1 items-center gap-2">
          <span className="text-sm font-semibold">Migration Script</span>
          <span className="rounded-full bg-[var(--color-diff-modified-bg)] px-1.5 py-0.5 text-xs font-medium text-[var(--color-diff-modified)]">
            {mainStatements.length} statement{mainStatements.length !== 1 ? 's' : ''}
          </span>
          {dangerous.length > 0 && (
            <span className="rounded-full bg-[var(--color-destructive)]/15 px-1.5 py-0.5 text-xs font-medium text-[var(--color-destructive)]">
              {dangerous.length} destructive
            </span>
          )}
        </div>
        {saveMsg && <span className="text-xs text-[var(--color-diff-added)]">{saveMsg}</span>}
        <Button variant="outline" size="sm" onClick={handleSave}>
          <Save className="size-3.5" />
          Save .sql
        </Button>
        <Button variant="outline" size="sm" onClick={handleCopy}>
          <Copy className="size-3.5" />
          {copyDone ? 'Copied!' : 'Copy'}
        </Button>
      </div>

      {/* Warnings — collapsible */}
      {script.warnings.length > 0 && (
        <div className="shrink-0 border-b border-[var(--color-border)]">
          <button
            onClick={() => setWarningsOpen((v) => !v)}
            className="flex w-full items-center gap-2 bg-[var(--color-destructive)]/8 px-6 py-2.5 text-left transition-colors hover:bg-[var(--color-destructive)]/12"
          >
            <AlertTriangle className="size-3.5 shrink-0 text-[var(--color-destructive)]" />
            <span className="flex-1 text-xs font-semibold text-[var(--color-destructive)]">
              {script.warnings.length} warning{script.warnings.length > 1 ? 's' : ''} — review
              before running
            </span>
            {warningsOpen ? (
              <ChevronDown className="size-3.5 shrink-0 text-[var(--color-destructive)]" />
            ) : (
              <ChevronRight className="size-3.5 shrink-0 text-[var(--color-destructive)]" />
            )}
          </button>
          {warningsOpen && (
            <div className="max-h-48 overflow-y-auto bg-[var(--color-destructive)]/5 px-6 py-2">
              {script.warnings.map((w, i) => (
                <p key={i} className="py-0.5 text-xs text-[var(--color-destructive)]/80">
                  {w.message}
                </p>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Statement list */}
      <div className="flex-1 overflow-auto">
        {script.statements.map((stmt) => (
          <div
            key={stmt.id}
            className={cn(
              'border-b border-[var(--color-border)]/50',
              stmt.destructive && 'bg-[var(--color-destructive)]/5',
              (stmt.kind === 'preamble' || stmt.kind === 'postamble') &&
                'bg-[var(--color-muted)]/40'
            )}
          >
            {/* Statement header */}
            <div className="flex items-center gap-2 px-4 py-1.5">
              <span
                className={cn(
                  'rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                  stmt.destructive
                    ? 'bg-[var(--color-destructive)]/15 text-[var(--color-destructive)]'
                    : stmt.kind === 'preamble' || stmt.kind === 'postamble'
                      ? 'bg-[var(--color-muted)] text-[var(--color-muted-foreground)]'
                      : 'bg-[var(--color-accent)] text-[var(--color-accent-foreground)]'
                )}
              >
                {KIND_LABEL[stmt.kind]}
              </span>
              {stmt.tableName && (
                <span className="font-mono text-xs text-[var(--color-muted-foreground)]">
                  {stmt.tableName}
                </span>
              )}
              {stmt.destructive && (
                <span className="ml-auto text-xs font-semibold text-[var(--color-destructive)]">
                  ⚠ destructive
                </span>
              )}
              {stmt.note && !stmt.destructive && (
                <span className="ml-auto text-xs text-[var(--color-muted-foreground)]">
                  {stmt.note}
                </span>
              )}
            </div>
            {/* SQL with syntax highlighting */}
            <SqlCode code={stmt.sql} />
          </div>
        ))}
      </div>
    </div>
  )
}
