import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const css = readFileSync(new URL('../src/index.css', import.meta.url), 'utf8')

assert.match(
  css,
  /\.prose-container\s+ol\s*\{[^}]*list-style-type:\s*decimal;?/is,
  'default/mobile preview should restore decimal markers for ordered lists',
)

assert.match(
  css,
  /\.prose-container\s+ul\s*\{[^}]*list-style-type:\s*disc;?/is,
  'default/mobile preview should restore disc markers for unordered lists',
)

console.log('preview list styles preserved')
