import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

assert.doesNotMatch(
  source,
  /display:flex;align-items:flex-start/,
  'Toutiao ordered-list top-level rows should not rely on flex row layout for keeping marker and正文 on the same line after paste',
)

assert.match(
  source,
  /firstParagraph\.prepend\(root\.ownerDocument\.createTextNode\(`\$\{current\}\. `\)\)/,
  'Toutiao ordered-list top-level rows should prepend the marker into the first existing paragraph so marker and正文 stay in one text flow',
)

console.log('toutiao inline number row handling ok')
