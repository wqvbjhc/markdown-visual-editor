import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/utils/media-export.ts', import.meta.url), 'utf8')

assert.match(
  source,
  /querySelectorAll<HTMLElement>\('pre code'\)/,
  'clipboard preparation should inspect pre > code blocks before serialization',
)

assert.match(
  source,
  /normalizeCodeBlockText\(/,
  'clipboard preparation should reuse code block newline normalization before copy serialization',
)

console.log('toolbar copy code block handling ok')
