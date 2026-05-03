import { defineConfig } from 'vitest/config'
import { resolve } from 'path'

export default defineConfig({
  test: {
    include: ['src/**/*.{test,spec}.ts', 'tests/unit/**/*.{test,spec}.ts'],
    environment: 'node',
    globals: false
  },
  resolve: {
    alias: {
      '@shared': resolve('src/shared')
    }
  }
})
