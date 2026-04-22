import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

assert.match(
  source,
  /replaceWith\(wrapper\)|list\.replaceWith\(wrapper\)/,
  'Toutiao ordered list export should replace the top-level ordered list node with an explicit block wrapper',
)

assert.match(
  source,
  /createElement\('div'\)[\s\S]*createElement\('span'\)[\s\S]*createElement\('div'\)/,
  'Toutiao ordered list export should build a block structure with marker + content containers',
)

console.log('toutiao ordered list structure handling ok')
