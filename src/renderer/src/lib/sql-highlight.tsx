import * as React from 'react'

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

interface Token {
  type: TokenType
  value: string
}

export function tokenizeSql(code: string): Token[] {
  const out: Token[] = []
  let i = 0
  while (i < code.length) {
    if (code[i] === '-' && code[i + 1] === '-') {
      const end = code.indexOf('\n', i)
      const v = end === -1 ? code.slice(i) : code.slice(i, end)
      out.push({ type: 'comment', value: v }); i += v.length; continue
    }
    if (code[i] === '/' && code[i + 1] === '*') {
      const end = code.indexOf('*/', i + 2)
      const v = end === -1 ? code.slice(i) : code.slice(i, end + 2)
      out.push({ type: 'comment', value: v }); i += v.length; continue
    }
    if (code[i] === "'") {
      let j = i + 1
      while (j < code.length) { if (code[j] === "'" && code[j - 1] !== '\\') { j++; break }; j++ }
      out.push({ type: 'string', value: code.slice(i, j) }); i = j; continue
    }
    if (code[i] === '`') {
      const end = code.indexOf('`', i + 1)
      const v = end === -1 ? code.slice(i) : code.slice(i, end + 1)
      out.push({ type: 'identifier', value: v }); i += v.length; continue
    }
    if (/[0-9]/.test(code[i])) {
      let j = i
      while (j < code.length && /[0-9.]/.test(code[j])) j++
      out.push({ type: 'number', value: code.slice(i, j) }); i = j; continue
    }
    if (/[a-zA-Z_]/.test(code[i])) {
      let j = i
      while (j < code.length && /[a-zA-Z0-9_]/.test(code[j])) j++
      const word = code.slice(i, j)
      const up = word.toUpperCase()
      const type: TokenType = KEYWORDS.has(up) ? 'keyword' : TYPES.has(up) ? 'type' : 'default'
      out.push({ type, value: word }); i = j; continue
    }
    out.push({ type: 'default', value: code[i] }); i++
  }
  return out
}

// VS Code Dark+ palette
const TOKEN_COLOR: Record<TokenType, string> = {
  keyword:    '#569CD6',
  type:       '#4EC9B0',
  string:     '#CE9178',
  number:     '#B5CEA8',
  comment:    '#6A9955',
  identifier: '#9CDCFE',
  default:    '#9E9E9E'
}

export function SqlCode({ code }: { code: string }): React.JSX.Element {
  const tokens = React.useMemo(() => tokenizeSql(code), [code])
  return (
    <pre className="min-w-max px-4 pb-3 pt-0 font-mono text-xs leading-relaxed">
      {tokens.map((tok, i) => (
        <span key={i} style={{ color: TOKEN_COLOR[tok.type] }}>{tok.value}</span>
      ))}
    </pre>
  )
}
