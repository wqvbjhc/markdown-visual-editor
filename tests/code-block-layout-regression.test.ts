import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

assert.match(
  css,
  /\.code-block-lines\s*\{[^}]*padding:\s*0;?/is,
  'line number column should not add vertical padding that stretches the code block row height',
)

console.log('code block layout regression ok')
