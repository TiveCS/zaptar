import { describe, expect, it } from 'vitest'

import type { Schema } from '../types/schema'
import { diff } from './engine'

const emptySchema = (databaseName: string): Schema => ({
  dialect: 'mysql',
  databaseName,
  tables: []
})

describe('diff engine (stub)', () => {
  it('returns an empty diff for two empty schemas', () => {
    const result = diff(emptySchema('dev'), emptySchema('prod'))
    expect(result.addedTables).toEqual([])
    expect(result.removedTables).toEqual([])
    expect(result.modifiedTables).toEqual([])
    expect(result.unchangedTables).toEqual([])
    expect(result.source.databaseName).toBe('dev')
    expect(result.target.databaseName).toBe('prod')
  })
})
