import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

assert.match(
  source,
  /replaceWith\(root\.ownerDocument\.createTextNode\(href\)\)|replaceWith\(.*createTextNode\(href\).*/,
  'Toutiao export should replace unsupported anchors with inline text nodes, not keep anchor elements that may be pasted as separate blocks',
)

console.log('toutiao inline link text handling ok')
