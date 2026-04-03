import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wechatSource = readFileSync(new URL('../src/formats/wechat.ts', import.meta.url), 'utf8')
const toutiaoSource = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

function expectExplicitOrderedListMarkers(name: string, source: string) {
  assert.match(
    source,
    /listStyleType\s*=\s*'decimal'|listStyle\s*=\s*'decimal'/i,
    `${name} export should keep explicit decimal markers for ordered lists`,
  )
}

expectExplicitOrderedListMarkers('wechat', wechatSource)
expectExplicitOrderedListMarkers('toutiao', toutiaoSource)

console.log('ordered list export markers preserved')
