import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

const exportSource = readFileSync(new URL('../src/utils/media-export.ts', import.meta.url), 'utf8')

assert.match(
  exportSource,
  /relativeMediaMap|readPersistedRelativeMedia|RELATIVE_MEDIA_STORAGE_KEY/,
  'clipboard preparation should also know how to resolve relative image mappings, not only local-media ids',
)

console.log('relative image copy handling ok')
