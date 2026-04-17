import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const source = readFileSync(new URL('../src/components/Preview.tsx', import.meta.url), 'utf8')

assert.match(
  source,
  /relativeMediaMap/,
  'Preview should subscribe to relativeMediaMap so directory-authorized images re-hydrate immediately after directory selection',
)

assert.match(
  source,
  /\[html, format, isDark, accent, localMediaMap, relativeMediaMap\]/,
  'renderContent dependencies should include relativeMediaMap',
)

console.log('relative image preview reactivity ok')
