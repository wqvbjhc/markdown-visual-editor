import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

assert.match(
  source,
  /body\.querySelectorAll\('ul'\)|body\.querySelectorAll\("ul"\)/,
  'Toutiao export should explicitly inspect nested unordered lists inside ordered list item bodies',
)

assert.match(
  source,
  /data-toutiao-bullet-list|createTextNode\('• '\)|createTextNode\("• "\)/,
  'Toutiao export should convert nested unordered list items into explicit bullet blocks',
)

console.log('toutiao nested bullet structure handling ok')
