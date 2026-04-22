import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const wechatSource = readFileSync(new URL('../src/formats/wechat.ts', import.meta.url), 'utf8')
const toutiaoSource = readFileSync(new URL('../src/formats/toutiao.ts', import.meta.url), 'utf8')

assert.match(
  wechatSource,
  /listStyleType\s*=\s*'decimal'|listStyle\s*=\s*'decimal'/i,
  'wechat export should keep explicit decimal markers for ordered lists',
)

assert.match(
  toutiaoSource,
  /data-toutiao-ordered-list|createElement\('span'\)[\s\S]*textContent = `\$\{current\}\. `/,
  'toutiao export should render explicit ordered-list numbering using export structure instead of native markers',
)

console.log('ordered list export behavior preserved')
