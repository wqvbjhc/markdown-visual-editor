import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const toutiaoSource = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

assert.match(
  toutiaoSource,
  /querySelectorAll\('a'\)/,
  'Toutiao export should inspect anchor nodes explicitly before returning HTML',
)

assert.match(
  toutiaoSource,
  /replaceWith\(root\.ownerDocument\.createTextNode\(href\)\)/,
  'Toutiao export should replace unsupported anchors with inline URL text so paste does not introduce an extra line break',
)

console.log('toutiao link copy handling ok')
