import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const toolbarSource = readFileSync(new URL('../src/components/Toolbar.tsx', import.meta.url), 'utf8')

assert.match(
  toolbarSource,
  /扩展链接/,
  'Toutiao copy flow should mention the native 扩展链接 path when external links may not survive paste',
)

console.log('toutiao link warning handling ok')
