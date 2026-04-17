import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/pipeline/plugins/rehype-image.ts', import.meta.url), 'utf8')

assert.match(
  source,
  /'data-original-src': node\.properties\.src|\['data-original-src'\]: node\.properties\.src/,
  'rehype-image should preserve the original image src so hydration can recover relative paths before fallback replaces src',
)

console.log('relative image original src handling ok')
