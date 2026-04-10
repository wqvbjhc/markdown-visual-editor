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
  /removeAttribute\('target'\)/,
  'Toutiao export should normalize target handling for external links',
)

assert.match(
  toutiaoSource,
  /removeAttribute\('rel'\)/,
  'Toutiao export should normalize rel handling for external links',
)

assert.match(
  toutiaoSource,
  /setAttribute\('title', href\)/,
  'Toutiao export should preserve the URL as title metadata',
)

console.log('toutiao link copy handling ok')
